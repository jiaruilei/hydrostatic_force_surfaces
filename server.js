import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import express from "express";

import { curvedForces, planeForces } from "./public/calculations.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const model = process.env.OPENAI_MODEL || "gpt-5.6-terra";
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const rateBuckets = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = Number(process.env.COACH_RATE_LIMIT) || 30;
const GUIDED_COACH_PROMPTS = new Set([
  "give me a hint",
  "why does angle matter?",
  "explain the centre of pressure",
  "explain the vertical projection",
  "which way do the components act?",
]);

app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(rootDir, "public")));

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-8)
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: cleanText(message?.content, 1000),
    }))
    .filter((message) => message.content);
}

function coachRateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || "unknown";
  const bucket = rateBuckets.get(key);

  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (bucket.count >= RATE_LIMIT) {
    return res.status(429).json({
      error: "Too many coach questions. Please try again in a few minutes.",
    });
  }
  bucket.count += 1;
  return next();
}

function verifiedContext(context = {}) {
  const surface = context.surface === "curved" ? "curved" : "plane";
  const result = surface === "curved"
    ? curvedForces(context.inputs)
    : planeForces(context.inputs);
  return {
    surface,
    mode: context.mode === "challenge" ? "challenge" : "explore",
    answerRevealed: Boolean(context.answerRevealed),
    result,
  };
}

function readable(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function ruleBasedReply(question, context) {
  const q = question.toLowerCase();
  const r = context.result;

  if (context.surface === "plane") {
    if (q.includes("center") || q.includes("cp") || q.includes("pressure")) {
      if (context.mode === "challenge" && !context.answerRevealed) {
        return "Use the line-of-action equation \\(y_{CP} = \\bar y + \\frac{I_G\\sin^2\\theta}{\\bar y A}\\). Keep vertical depth distinct from distance measured along the inclined plate; I will leave the numerical CP for you to calculate.";
      }
      return `Pressure increases linearly with vertical depth, so the center of pressure lies below the centroid. Here, \\(\\bar y = ${readable(r.centroidDepth)}\\;\\mathrm{m}\\) and \\(y_{CP} = ${readable(r.centerPressureDepth)}\\;\\mathrm{m}\\). Use \\(y_{CP} = \\bar y + \\frac{I_G\\sin^2\\theta}{\\bar y A}\\).`;
    }
    if (q.includes("angle") || q.includes("incline")) {
      return "The angle changes vertical depth through \\(L\\sin\\theta\\). The area remains \\(A=bL\\), but both the centroid depth and the center-of-pressure correction depend on the inclination.";
    }
    if (q.includes("hint") || q.includes("start")) {
      return "First find the centroid's vertical depth: \\(\\bar y = y_t + \\frac{L}{2}\\sin\\theta\\). Then use \\(F_R = \\rho g\\bar y A\\). Find the center of pressure only after the force magnitude.";
    }
    if (context.mode === "challenge" && !context.answerRevealed) {
      return "Build the answer from centroid depth and area. I will keep the final force hidden while the challenge is active.";
    }
    return `For this plate, \\(A = ${readable(r.area)}\\;\\mathrm{m^2}\\) and \\(\\bar y = ${readable(r.centroidDepth)}\\;\\mathrm{m}\\), giving \\(F_R = ${readable(r.forceKN)}\\;\\mathrm{kN}\\). Its line of action is at \\(y_{CP} = ${readable(r.centerPressureDepth)}\\;\\mathrm{m}\\) below the free surface.`;
  }

  if (q.includes("horizontal") || q.includes("projection")) {
    if (context.mode === "challenge" && !context.answerRevealed) {
      return `Replace the curved surface with its vertical rectangular projection, whose area is \\(A_v=bR\\). Find the horizontal force from \\(F_H=\\rho g\\bar yA_v\\), then use the projected-area inertia to calculate \\(y_{H,CP}\\). For the selected ${r.side} loading, \\(F_H\\) acts ${r.horizontalDirection}. The curved geometry is treated separately when calculating the vertical component.`;
    }
    return `Replace the curved surface with its vertical rectangular projection. Its area is \\(A_v=${readable(r.projectedArea)}\\;\\mathrm{m^2}\\) and its centroid depth is \\(\\bar y=${readable(r.projectedCentroidDepth)}\\;\\mathrm{m}\\), so \\(F_H=\\rho g\\bar yA_v=${readable(r.horizontalKN)}\\;\\mathrm{kN}\\). For the selected ${r.side} loading, this horizontal component acts ${r.horizontalDirection}. The curved geometry is treated separately when calculating the vertical component.`;
  }
  if (q.includes("vertical") || q.includes("weight") || q.includes("imaginary")) {
    if (context.mode === "challenge" && !context.answerRevealed) {
      return "Find \\(F_V\\) from the weight of the imaginary fluid. Its line of action passes through that volume's centre of mass, so calculate \\(x_V = \\sum V_i x_i/\\sum V_i\\). I will leave the numerical vertical CP hidden.";
    }
    return `The vertical component equals the weight of the imaginary fluid above the curve. The volume is \\(V = ${readable(r.imaginaryVolume)}\\;\\mathrm{m^3}\\), so \\(F_V = \\rho gV = ${readable(r.verticalKN)}\\;\\mathrm{kN}\\), acting ${r.verticalDirection}. Its line of action passes through the volume's centre of mass at \\(x_V = ${readable(r.verticalCenterX)}\\;\\mathrm{m}\\) from the left edge.`;
  }
  if (q.includes("side") || q.includes("direction")) {
    return `Every curved plate has two sides. The selected ${r.side} loading makes the horizontal component act ${r.horizontalDirection} and the vertical component act ${r.verticalDirection}; the magnitudes come from the same projection and imaginary-volume steps.`;
  }
  if (q.includes("hint") || q.includes("start")) {
    return "Start with the vertical projection: \\(A_v=bR\\) and \\(F_H=\\rho g\\bar yA_v\\). For the vertical component, find the complete imaginary-fluid volume and use \\(F_V=\\rho gV_{\\mathrm{imaginary}}\\), because it is a fluid weight rather than a pressure force on an area. Finally, combine the components with \\(F_R=\\sqrt{F_H^2+F_V^2}\\).";
  }
  if (context.mode === "challenge" && !context.answerRevealed) {
    return "Find F-H and F-V separately, then combine them. I will keep the final resultant hidden while the challenge is active.";
  }
  return `The components are \\(F_H = ${readable(r.horizontalKN)}\\;\\mathrm{kN}\\) and \\(F_V = ${readable(r.verticalKN)}\\;\\mathrm{kN}\\). The resultant is \\(F_R = ${readable(r.resultantKN)}\\;\\mathrm{kN}\\) at \\(${readable(r.resultantAngle, 1)}^\\circ\\) to the horizontal.`;
}

function coachInstructions() {
  return [
    "You are Prof. Gary's AI Proxy for a CE2134 hydrostatics learning platform.",
    "Teach forces on inclined plane surfaces and quarter-circle curved surfaces.",
    "For plane surfaces, use F_R = rho g y_bar A and y_CP = y_bar + I_G sin^2(theta)/(y_bar A).",
    "For curved surfaces, teach F_H as the force on the vertical projection and F_V as the weight of the imaginary fluid above the curve.",
    "For the vertical component, always use F_V = rho g V_imaginary; never substitute an imaginary area for the fluid volume.",
    "Use the server-verified live state. Do not invent geometry or measurements.",
    "In Challenge mode, if the answer is not revealed, scaffold without stating the final resultant force or center-of-pressure values.",
    "Format every mathematical expression as TeX using \\( ... \\) for inline math or \\[ ... \\] for display math; do not use dollar-sign delimiters.",
    "Use TeX commands such as \\rho, \\bar y, subscripts, fractions, and \\mathrm{} for units. Keep ordinary prose outside math delimiters.",
    "Keep replies classroom-friendly, accurate, and under 140 words. Avoid markdown tables and unnecessary blank lines between equations. Always finish with a complete sentence.",
  ].join("\n");
}

function formatContext(context) {
  const r = context.result;
  if (context.surface === "plane") {
    return [
      `Surface: plane`,
      `Mode: ${context.mode}`,
      `Answer revealed: ${context.answerRevealed}`,
      `Density: ${r.density} kg/m^3`,
      `Top-edge depth: ${r.topDepth} m`,
      `Plate length: ${r.length} m`,
      `Plate width: ${r.width} m`,
      `Inclination from horizontal: ${r.angle} degrees`,
      `Area: ${r.area} m^2`,
      `Centroid depth: ${r.centroidDepth} m`,
      `Resultant force: ${r.forceKN} kN`,
      `Center-of-pressure depth: ${r.centerPressureDepth} m`,
    ].join("\n");
  }
  return [
    `Surface: quarter-circle curved gate`,
    `Mode: ${context.mode}`,
    `Answer revealed: ${context.answerRevealed}`,
    `Density: ${r.density} kg/m^3`,
    `Depth to top of curve: ${r.topDepth} m`,
    `Radius: ${r.radius} m`,
    `Width: ${r.width} m`,
    `Loaded side: ${r.side}`,
    `Horizontal force: ${r.horizontalKN} kN, ${r.horizontalDirection}`,
    `Vertical force: ${r.verticalKN} kN, ${r.verticalDirection}`,
    `Vertical center of pressure: ${r.verticalCenterX} m from the left edge (center-of-mass line)`,
    `Resultant force: ${r.resultantKN} kN`,
    `Resultant angle: ${r.resultantAngle} degrees`,
  ].join("\n");
}

function outputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  for (const item of payload?.output || []) {
    for (const part of item?.content || []) {
      if (typeof part?.text === "string") return part.text.trim();
    }
  }
  return "";
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/coach/status", (_req, res) => {
  res.json({ apiConfigured: Boolean(process.env.OPENAI_API_KEY) });
});

app.post("/api/coach", coachRateLimit, async (req, res) => {
  const question = cleanText(req.body?.question, 1200);
  if (!question) return res.status(400).json({ error: "Please enter a question." });

  const context = verifiedContext(req.body?.context);
  const history = cleanHistory(req.body?.history);
  const apiKey = process.env.OPENAI_API_KEY;
  const guidedPrompt = GUIDED_COACH_PROMPTS.has(question.toLowerCase());
  if (!apiKey || guidedPrompt) {
    return res.json({
      reply: ruleBasedReply(question, context),
      source: "built-in",
      apiConfigured: Boolean(apiKey),
      guided: guidedPrompt,
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: coachInstructions(),
        input: [
          ...history,
          { role: "user", content: `Live state:\n${formatContext(context)}\n\nStudent question: ${question}` },
        ],
        max_output_tokens: 700,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI API returned ${response.status}`);
    const reply = outputText(await response.json());
    if (!reply) throw new Error("The AI coach returned an empty response.");
    return res.json({ reply, source: "openai", apiConfigured: true });
  } catch (error) {
    console.error("Coach request failed:", error.message);
    return res.json({
      reply: ruleBasedReply(question, context),
      source: "built-in",
      apiConfigured: true,
      fallback: true,
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(rootDir, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Hydrostatic force lab listening on http://localhost:${port}`);
});

