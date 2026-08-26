import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import express from "express";

import { curvedForces, GRAVITY, planeForces } from "./public/calculations.js";

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
  "which way does the force act?",
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
    if (q.includes("side") || q.includes("direction") || q.includes("which way")) {
      const verticalDirection = r.angle >= 89.95 ? "" : ` and ${r.verticalDirection}`;
      return `For loading on the selected ${r.side} side, the resultant acts ${r.horizontalDirection}${verticalDirection}, normal to the plate. Switching to the other side reverses the force direction but does not change its magnitude or centre-of-pressure location.`;
    }
    if (q.includes("center") || q.includes("cp") || q.includes("pressure")) {
      if (context.mode === "challenge" && !context.answerRevealed) {
        return "Measure \\(y\\) along the plate and \\(h\\) vertically. Use \\(y_{CP}=\\bar y+\\frac{I_G}{\\bar yA}\\), where \\(\\bar y=h_t/\\sin\\theta+L/2\\). I will leave the numerical CP for you to calculate.";
      }
      return `The coordinate \\(y\\) follows the plate, while water depth is \\(h=y\\sin\\theta\\). Here, \\(\\bar y=${readable(r.centroidPosition)}\\;\\mathrm{m}\\), \\(\\bar h=${readable(r.centroidWaterDepth)}\\;\\mathrm{m}\\), and \\(y_{CP}=${readable(r.centerPressurePosition)}\\;\\mathrm{m}\\). Use \\(y_{CP}=\\bar y+\\frac{I_G}{\\bar yA}\\).`;
    }
    if (q.includes("angle") || q.includes("incline")) {
      return "The angle converts distance along the plate to vertical water depth through \\(h=y\\sin\\theta\\). The area remains \\(A=bL\\); use \\(\\bar h=\\bar y\\sin\\theta\\) when calculating the force.";
    }
    if (q.includes("hint") || q.includes("start")) {
      return "First find the along-plate coordinates \\(y_t=h_t/\\sin\\theta\\) and \\(\\bar y=y_t+L/2\\). Convert to water depth with \\(\\bar h=\\bar y\\sin\\theta\\), then use \\(F_R=\\rho g\\bar hA\\).";
    }
    if (context.mode === "challenge" && !context.answerRevealed) {
      return "Build the answer from centroid water depth and area. I will keep the final force hidden while the challenge is active.";
    }
    return `For this plate, \\(\\bar y=${readable(r.centroidPosition)}\\;\\mathrm{m}\\) along the surface and \\(\\bar h=${readable(r.centroidWaterDepth)}\\;\\mathrm{m}\\) vertically. Thus \\(F_R=${readable(r.forceKN)}\\;\\mathrm{kN}\\), with \\(y_{CP}=${readable(r.centerPressurePosition)}\\;\\mathrm{m}\\) along the plate from the free-surface origin.`;
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
    "Use exactly g = 9.8 N/kg in every calculation.",
    "For plane surfaces, y is measured along the plate and h is vertical water depth. Use h = y sin(theta), F_R = rho g h_bar A, and y_CP = y_bar + I_G/(y_bar A).",
    "For a plane surface, the force acts normal to and away from the selected loaded side; changing sides reverses direction without changing magnitude or center of pressure.",
    "For curved surfaces, teach F_H as the force on the vertical projection and F_V as the weight of the imaginary fluid above the curve.",
    "For the vertical component, always use F_V = rho g V_imaginary; never substitute an imaginary area for the fluid volume.",
    "Use the server-verified live state. Do not invent geometry or measurements.",
    "In Challenge mode, if the answer is not revealed, scaffold without stating the final resultant force or center-of-pressure values.",
    "Format every mathematical expression as TeX using \\( ... \\) for inline math or \\[ ... \\] for display math; do not use dollar-sign delimiters.",
    "Use TeX commands such as \\rho, \\bar y, \\bar h, subscripts, fractions, and \\mathrm{} for units. Keep ordinary prose outside math delimiters.",
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
      `Gravitational acceleration: ${GRAVITY} N/kg`,
      `Top-edge water depth h_t: ${r.topDepth} m`,
      `Plate length: ${r.length} m`,
      `Plate width: ${r.width} m`,
      `Inclination from horizontal: ${r.angle} degrees`,
      `Loaded side: ${r.side}`,
      `Force direction: ${r.horizontalDirection} and ${r.verticalDirection}, normal to the plate`,
      `Area: ${r.area} m^2`,
      `Top-edge position along plate y_t: ${r.topPositionAlongPlane} m`,
      `Centroid position along plate y_bar: ${r.centroidPosition} m`,
      `Centroid water depth h_bar: ${r.centroidWaterDepth} m`,
      `Resultant force: ${r.forceKN} kN`,
      `Center-of-pressure position along plate y_CP: ${r.centerPressurePosition} m`,
      `Center-of-pressure water depth h_CP: ${r.centerPressureWaterDepth} m`,
    ].join("\n");
  }
  return [
    `Surface: quarter-circle curved gate`,
    `Mode: ${context.mode}`,
    `Answer revealed: ${context.answerRevealed}`,
    `Density: ${r.density} kg/m^3`,
    `Gravitational acceleration: ${GRAVITY} N/kg`,
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
