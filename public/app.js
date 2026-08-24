import { curvedForces, planeForces } from "./calculations.js";

const $ = (id) => document.getElementById(id);
const elements = {
  planeTab: $("planeTab"),
  curvedTab: $("curvedTab"),
  exploreMode: $("exploreMode"),
  challengeMode: $("challengeMode"),
  fluidPreset: $("fluidPreset"),
  density: $("density"),
  planeControls: $("planeControls"),
  curvedControls: $("curvedControls"),
  planeAngle: $("planeAngle"),
  planeAngleValue: $("planeAngleValue"),
  planeTopDepth: $("planeTopDepth"),
  planeTopDepthValue: $("planeTopDepthValue"),
  planeLength: $("planeLength"),
  planeLengthValue: $("planeLengthValue"),
  planeWidth: $("planeWidth"),
  planeWidthValue: $("planeWidthValue"),
  curveTopDepth: $("curveTopDepth"),
  curveTopDepthValue: $("curveTopDepthValue"),
  curveRadius: $("curveRadius"),
  curveRadiusValue: $("curveRadiusValue"),
  curveWidth: $("curveWidth"),
  curveWidthValue: $("curveWidthValue"),
  concaveSide: $("concaveSide"),
  convexSide: $("convexSide"),
  sideDirection: $("sideDirection"),
  resetButton: $("resetButton"),
  lessonKicker: $("lessonKicker"),
  lessonTitle: $("lessonTitle"),
  lessonSummary: $("lessonSummary"),
  readingBar: $("readingBar"),
  canvasTitle: $("canvasTitle"),
  forceCanvas: $("forceCanvas"),
  methodTitle: $("methodTitle"),
  methodSteps: $("methodSteps"),
  explorePanel: $("explorePanel"),
  resultTitle: $("resultTitle"),
  equationGrid: $("equationGrid"),
  challengePanel: $("challengePanel"),
  challengeTitle: $("challengeTitle"),
  challengePrompt: $("challengePrompt"),
  prediction: $("prediction"),
  checkPrediction: $("checkPrediction"),
  hintButton: $("hintButton"),
  revealButton: $("revealButton"),
  challengeFeedback: $("challengeFeedback"),
  coachStatus: $("coachStatus"),
  coachLog: $("coachLog"),
  coachChips: $("coachChips"),
  coachForm: $("coachForm"),
  coachQuestion: $("coachQuestion"),
};

const defaults = {
  plane: { density: 1000, angle: 60, topDepth: 1, length: 2, width: 2 },
  curved: { density: 1000, topDepth: 4, radius: 2, width: 1, side: "concave" },
};

const state = {
  surface: "plane",
  mode: "explore",
  answerRevealed: false,
  attempts: 0,
  hintsUsed: 0,
  history: [],
  side: "concave",
};

function number(value) {
  return Number(value);
}

function planeInput() {
  return {
    density: number(elements.density.value),
    angle: number(elements.planeAngle.value),
    topDepth: number(elements.planeTopDepth.value),
    length: number(elements.planeLength.value),
    width: number(elements.planeWidth.value),
  };
}

function curvedInput() {
  return {
    density: number(elements.density.value),
    topDepth: number(elements.curveTopDepth.value),
    radius: number(elements.curveRadius.value),
    width: number(elements.curveWidth.value),
    side: state.side,
  };
}

function currentResult() {
  return state.surface === "plane" ? planeForces(planeInput()) : curvedForces(curvedInput());
}

function currentInputs() {
  return state.surface === "plane" ? planeInput() : curvedInput();
}

function fmt(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function setPressed(button, active, attribute = "aria-pressed") {
  button.classList.toggle("active", active);
  button.setAttribute(attribute, String(active));
}

function resetChallenge() {
  state.answerRevealed = false;
  state.attempts = 0;
  state.hintsUsed = 0;
  elements.prediction.value = "";
  elements.challengeFeedback.textContent = "Work through the lecture method before checking.";
  elements.challengeFeedback.className = "challenge-feedback";
}

function syncControlLabels() {
  elements.planeAngleValue.textContent = `${fmt(elements.planeAngle.value, 0)}°`;
  elements.planeTopDepthValue.textContent = `${fmt(elements.planeTopDepth.value, 1)} m`;
  elements.planeLengthValue.textContent = `${fmt(elements.planeLength.value, 1)} m`;
  elements.planeWidthValue.textContent = `${fmt(elements.planeWidth.value, 1)} m`;
  elements.curveTopDepthValue.textContent = `${fmt(elements.curveTopDepth.value, 1)} m`;
  elements.curveRadiusValue.textContent = `${fmt(elements.curveRadius.value, 1)} m`;
  elements.curveWidthValue.textContent = `${fmt(elements.curveWidth.value, 1)} m`;
}

function readingCard(label, value, note, hidden = false) {
  return `<div class="reading${hidden ? " hidden-reading" : ""}">
    <span>${label}</span>
    <strong>${hidden ? "Hidden" : value}</strong>
    <small>${hidden ? "Make a prediction first" : note}</small>
  </div>`;
}

function renderReadings(result) {
  const challengeHidden = state.mode === "challenge" && !state.answerRevealed;
  elements.readingBar.classList.toggle("five-readings", state.surface === "curved");
  if (state.surface === "plane") {
    elements.readingBar.innerHTML = [
      readingCard("Centroid depth", `${fmt(result.centroidDepth)} m`, "below free surface"),
      readingCard("Resultant force", `${fmt(result.forceKN)} kN`, "normal to the plate", challengeHidden),
      readingCard("CP depth", `${fmt(result.centerPressureDepth)} m`, "below free surface"),
      readingCard("Bottom pressure", `${fmt(result.bottomPressureKPa)} kPa`, "gage pressure"),
    ].join("");
    return;
  }
  elements.readingBar.innerHTML = [
    readingCard("Horizontal", `${fmt(result.horizontalKN)} kN`, result.horizontalDirection),
    readingCard("Vertical", `${fmt(result.verticalKN)} kN`, result.verticalDirection),
    readingCard("Resultant", `${fmt(result.resultantKN)} kN`, `${fmt(result.resultantAngle, 1)}° to horizontal`, challengeHidden),
    readingCard("Horizontal CP", `${fmt(result.horizontalCenterDepth)} m`, "below free surface"),
    readingCard("Vertical CP", `${fmt(result.verticalCenterX)} m`, "CM line from left edge"),
  ].join("");
}

function methodStep(index, title, copy, formula) {
  return `<div class="method-step"><b>${index}</b><h4>${title}</h4><p>${copy}<span class="formula">${formula}</span></p></div>`;
}

function equationCard(label, equation) {
  return `<div class="equation-card"><span>${label}</span><p>${equation}</p></div>`;
}

async function typesetMath(targets) {
  try {
    await (window.mathJaxReady || Promise.resolve());
    if (window.MathJax?.typesetPromise) await window.MathJax.typesetPromise(targets);
  } catch (error) {
    console.warn("Math typesetting skipped:", error);
  }
}

let uiTypesetTimer;
function scheduleUiTypeset() {
  window.clearTimeout(uiTypesetTimer);
  uiTypesetTimer = window.setTimeout(() => {
    typesetMath([elements.methodSteps, elements.equationGrid]);
  }, 60);
}

function renderLesson(result) {
  if (window.MathJax?.typesetClear) {
    window.MathJax.typesetClear([elements.methodSteps, elements.equationGrid]);
  }
  if (state.surface === "plane") {
    elements.lessonKicker.textContent = "Plane surface";
    elements.lessonTitle.textContent = "Follow the pressure to its single resultant";
    elements.lessonSummary.textContent = "Change the plate geometry and watch the centroid, pressure distribution, resultant force, and centre of pressure move together.";
    elements.canvasTitle.textContent = "Inclined rectangular plate";
    elements.methodTitle.textContent = "Plane-surface workflow";
    elements.methodSteps.innerHTML = [
      methodStep(1, "Locate the centroid", "Use vertical depth, even when the plate is inclined.", "\\(\\bar y = y_t + \\frac{L}{2}\\sin\\theta\\)"),
      methodStep(2, "Integrate the pressure", "Average pressure at the centroid times the plate area gives the resultant.", "\\(F_R = \\rho g\\bar y A\\)"),
      methodStep(3, "Place the resultant", "The pressure gradient moves the line of action below the centroid.", "\\(y_{CP} = \\bar y + \\frac{I_G\\sin^2\\theta}{\\bar y A}\\)"),
    ].join("");
    elements.resultTitle.textContent = "From centroid depth to centre of pressure";
    elements.equationGrid.innerHTML = [
      equationCard("1 · Geometry", `\\(A = ${fmt(result.width)}\\times${fmt(result.length)} = \\mathbf{${fmt(result.area)}\\;\\mathrm{m^2}}\\)<br>\\(\\bar y = ${fmt(result.topDepth)} + \\frac{${fmt(result.length)}}{2}\\sin ${fmt(result.angle, 0)}^\\circ = \\mathbf{${fmt(result.centroidDepth)}\\;\\mathrm{m}}\\)`),
      equationCard("2 · Resultant", `\\(F_R = (${fmt(result.density, 0)})(9.81)(${fmt(result.centroidDepth)})(${fmt(result.area)})\\)<br>\\(F_R = \\mathbf{${fmt(result.forceKN)}\\;\\mathrm{kN}}\\)`),
      equationCard("3 · Line of action", `\\(I_G = \\frac{bL^3}{12} = ${fmt(result.centroidalInertia, 3)}\\;\\mathrm{m^4}\\)<br>\\(y_{CP} = \\mathbf{${fmt(result.centerPressureDepth)}\\;\\mathrm{m}}\\)`),
    ].join("");
    elements.challengeTitle.textContent = "Predict the plane-surface resultant";
    elements.challengePrompt.textContent = "Calculate the resultant hydrostatic force normal to the plate. A result within 2% counts as correct.";
    elements.coachQuestion.placeholder = "Why is the centre of pressure below the centroid?";
    return;
  }

  elements.lessonKicker.textContent = "Curved surface";
  elements.lessonTitle.textContent = "Resolve the force into projection and weight";
  elements.lessonSummary.textContent = "For a curved gate, find the horizontal force on the vertical projection and the vertical weight of the imaginary fluid above the curve.";
  elements.canvasTitle.textContent = "Quarter-circle curved gate";
  elements.methodTitle.textContent = "Curved-surface workflow";
  elements.methodSteps.innerHTML = [
    methodStep(1, "Project vertically", "The horizontal component equals the force on the vertical projection.", "\\(F_H = \\rho g\\bar y A_v\\)"),
    methodStep(2, "Weigh imaginary fluid", "The vertical component is the fluid weight and acts through that volume's centre of mass.", "\\(F_V = \\rho gV\\)"),
    methodStep(3, "Combine components", "The resultant passes through the intersection of the component lines of action.", "\\(F_R = \\sqrt{F_H^2 + F_V^2}\\)"),
  ].join("");
  elements.resultTitle.textContent = "Projection, imaginary volume, and resultant";
  elements.equationGrid.innerHTML = [
    equationCard("1 · Horizontal", `\\(A_v = bR = ${fmt(result.projectedArea)}\\;\\mathrm{m^2}\\)<br>\\(F_H = \\rho g\\bar y A_v = \\mathbf{${fmt(result.horizontalKN)}\\;\\mathrm{kN}}\\)`),
    equationCard("2 · Vertical", `\\(V = bdR + \\frac{1}{4}\\pi bR^2 = ${fmt(result.imaginaryVolume)}\\;\\mathrm{m^3}\\)<br>\\(F_V = \\rho gV = \\mathbf{${fmt(result.verticalKN)}\\;\\mathrm{kN}}\\)<br>\\(x_V = \\frac{V_r(R/2)+V_q(4R/3\\pi)}{V} = \\mathbf{${fmt(result.verticalCenterX)}\\;\\mathrm{m}}\\)`),
    equationCard("3 · Resultant", `\\(F_R = \\sqrt{${fmt(result.horizontalKN)}^2 + ${fmt(result.verticalKN)}^2}\\)<br>\\(F_R = \\mathbf{${fmt(result.resultantKN)}\\;\\mathrm{kN}},\\quad \\theta_R = ${fmt(result.resultantAngle, 1)}^\\circ\\)`),
  ].join("");
  elements.challengeTitle.textContent = "Predict the curved-surface resultant";
  elements.challengePrompt.textContent = "Combine the displayed horizontal and vertical components. A result within 2% counts as correct.";
  elements.coachQuestion.placeholder = "Why does the vertical component equal a fluid weight?";
}

function renderChips() {
  const prompts = state.surface === "plane"
    ? ["Give me a hint", "Why does angle matter?", "Explain the centre of pressure"]
    : ["Give me a hint", "Explain the vertical projection", "Which way do the components act?"];
  elements.coachChips.innerHTML = "";
  for (const prompt of prompts) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = prompt;
    button.addEventListener("click", () => askCoach(prompt));
    elements.coachChips.append(button);
  }
}

function arrow(ctx, x1, y1, x2, y2, color, width = 2, head = 8) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function boxedLabel(ctx, text, x, y, color = "#34445a", align = "left", weight = 700) {
  const paddingX = 5;
  const paddingY = 3;
  const canvasWidth = ctx.canvas.getBoundingClientRect().width;
  const canvasHeight = ctx.canvas.getBoundingClientRect().height;
  ctx.save();
  ctx.font = `${weight} 12px ui-sans-serif, system-ui, sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = 18;
  let left = x;
  if (align === "center") left -= boxWidth / 2;
  if (align === "right") left -= boxWidth;
  left = Math.min(canvasWidth - boxWidth - 5, Math.max(5, left));
  const top = Math.min(canvasHeight - boxHeight - 5, Math.max(5, y - 14 - paddingY));
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.strokeStyle = "rgba(203,213,225,.9)";
  ctx.lineWidth = 1;
  ctx.fillRect(left, top, boxWidth, boxHeight);
  ctx.strokeRect(left, top, boxWidth, boxHeight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  const textX = align === "center"
    ? left + boxWidth / 2
    : align === "right" ? left + boxWidth - paddingX : left + paddingX;
  ctx.fillText(text, textX, top + boxHeight - paddingY - 1);
  ctx.restore();
}

function marker(ctx, x, y, color, radius = 5) {
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function calloutMarker(ctx, x, y, color, text, labelX, labelY, align = "left") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(labelX, labelY - 5);
  ctx.stroke();
  ctx.restore();
  marker(ctx, x, y, color);
  boxedLabel(ctx, text, labelX, labelY, color, align, 800);
}

function prepareCanvas() {
  const canvas = elements.forceCanvas;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(320, rect.width);
  const height = Math.max(300, rect.height);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function drawTank(ctx, width, height, waterLine = 56) {
  const gradient = ctx.createLinearGradient(0, waterLine, 0, height);
  gradient.addColorStop(0, "rgba(125,211,252,.42)");
  gradient.addColorStop(1, "rgba(37,99,235,.18)");
  ctx.fillStyle = gradient;
  ctx.fillRect(34, waterLine, width - 68, height - waterLine - 32);
  ctx.strokeStyle = "#8ba1b9";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(34, waterLine);
  ctx.lineTo(34, height - 31);
  ctx.lineTo(width - 34, height - 31);
  ctx.lineTo(width - 34, waterLine);
  ctx.stroke();
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(34, waterLine);
  ctx.lineTo(width - 34, waterLine);
  ctx.stroke();
  boxedLabel(ctx, "free surface", 43, waterLine - 9, "#2563eb");
}

function drawPlane(result) {
  const { ctx, width, height } = prepareCanvas();
  const waterLine = 56;
  drawTank(ctx, width, height, waterLine);
  const horizontalLength = result.length * Math.cos(result.theta);
  const availableDepth = height - waterLine - 72;
  const depthScale = availableDepth / Math.max(result.bottomDepth + 0.5, 1);
  const widthScale = (width - 260) / Math.max(horizontalLength, 0.25);
  const scale = Math.max(24, Math.min(92, depthScale, widthScale));
  const x1 = Math.max(110, width * 0.34 - horizontalLength * scale / 2);
  const y1 = waterLine + result.topDepth * scale;
  const x2 = x1 + horizontalLength * scale;
  const y2 = y1 + result.length * result.sinTheta * scale;
  const tx = Math.cos(result.theta);
  const ty = result.sinTheta;
  const nx = -ty;
  const ny = tx;

  ctx.save();
  ctx.strokeStyle = "rgba(71,85,105,.5)";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, waterLine);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
  if (result.topDepth >= 0.15) {
    boxedLabel(ctx, `yₜ = ${fmt(result.topDepth, 1)} m`, x1 - 8, (waterLine + y1) / 2, "#51657d", "right");
  }

  ctx.save();
  ctx.strokeStyle = "#0b1930";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i < 6; i += 1) {
    const t = (i + 0.5) / 6;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    const depthRatio = (result.topDepth + t * result.length * result.sinTheta) / Math.max(result.bottomDepth, 0.2);
    const magnitude = 16 + 33 * depthRatio;
    arrow(ctx, px - nx * 4, py - ny * 4, px + nx * magnitude, py + ny * magnitude, "#1597cf", 1.8, 6);
  }

  const centroidT = 0.5;
  const cpT = result.centerPressureFromTop / result.length;
  const cx = x1 + (x2 - x1) * centroidT;
  const cy = y1 + (y2 - y1) * centroidT;
  const cpx = x1 + (x2 - x1) * cpT;
  const cpy = y1 + (y2 - y1) * cpT;
  calloutMarker(ctx, cx, cy, "#2563eb", "Centroid", cx - nx * 31, cy - ny * 31 - 18);
  calloutMarker(ctx, cpx, cpy, "#ef4444", "Centre of pressure", cpx - nx * 31, cpy - ny * 31 + 22);
  arrow(ctx, cpx, cpy, cpx + nx * 76, cpy + ny * 76, "#ef4444", 3, 10);
  boxedLabel(ctx, `Fᵣ ${fmt(result.forceKN)} kN`, cpx + nx * 85, cpy + ny * 85, "#b91c1c", nx < 0 ? "right" : "left", 800);

  const angleRadius = 36;
  ctx.save();
  ctx.strokeStyle = "#52667e";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + 48, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x1, y1, angleRadius, 0, result.theta);
  ctx.stroke();
  ctx.restore();
  boxedLabel(ctx, `${fmt(result.angle, 0)}°`, x1 + 42, y1 + 24, "#52667e");
}

function drawCurved(result) {
  const { ctx, width, height } = prepareCanvas();
  const waterLine = 50;
  drawTank(ctx, width, height, waterLine);
  const availableDepth = height - waterLine - 70;
  const depthScale = availableDepth / Math.max(result.topDepth + result.radius + 0.5, 1);
  const widthScale = (width - 280) / Math.max(result.radius, 0.5);
  const scale = Math.max(25, Math.min(82, depthScale, widthScale));
  const centerX = Math.max(130, width * 0.38);
  const centerY = waterLine + result.topDepth * scale;
  const radiusPx = result.radius * scale;

  ctx.save();
  ctx.fillStyle = "rgba(245,158,11,.20)";
  ctx.strokeStyle = "rgba(217,119,6,.65)";
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.rect(centerX, waterLine, radiusPx, Math.max(0, centerY - waterLine));
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + radiusPx, centerY);
  ctx.arc(centerX, centerY, radiusPx, 0, Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  boxedLabel(ctx, "imaginary fluid volume", centerX + radiusPx / 2, waterLine + 21, "#9a5b05", "center");

  ctx.save();
  ctx.strokeStyle = "rgba(71,85,105,.6)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(centerX + radiusPx, centerY);
  ctx.lineTo(centerX + radiusPx, centerY + radiusPx);
  ctx.stroke();
  ctx.restore();
  boxedLabel(ctx, "vertical projection", centerX + radiusPx + 10, centerY + radiusPx / 2, "#52667e");

  ctx.save();
  ctx.strokeStyle = "#0b1930";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radiusPx, 0, Math.PI / 2);
  ctx.stroke();
  ctx.restore();

  const direction = result.side === "concave" ? 1 : -1;
  for (let i = 0; i < 6; i += 1) {
    const phi = 0.12 + i * (Math.PI / 2 - 0.24) / 5;
    const px = centerX + radiusPx * Math.cos(phi);
    const py = centerY + radiusPx * Math.sin(phi);
    const dx = Math.cos(phi) * direction;
    const dy = Math.sin(phi) * direction;
    arrow(ctx, px - dx * 5, py - dy * 5, px + dx * 25, py + dy * 25, "#1597cf", 1.8, 6);
  }

  const ix = centerX + result.verticalCenterX * scale;
  const iy = waterLine + result.horizontalCenterDepth * scale;
  const centerMassY = waterLine + result.verticalCenterDepth * scale;
  ctx.save();
  ctx.strokeStyle = "rgba(245,158,11,.8)";
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(ix, waterLine + 24);
  ctx.lineTo(ix, Math.min(height - 42, centerY + radiusPx));
  ctx.moveTo(centerX - 28, iy);
  ctx.lineTo(Math.min(width - 42, centerX + radiusPx + 120), iy);
  ctx.stroke();
  ctx.restore();

  const hDirection = result.side === "concave" ? 1 : -1;
  const vDirection = result.side === "concave" ? 1 : -1;
  arrow(ctx, ix, iy, ix + hDirection * 78, iy, "#2563eb", 3, 10);
  arrow(ctx, ix, iy, ix, iy + vDirection * 78, "#f59e0b", 3, 10);
  arrow(ctx, ix, iy, ix + hDirection * 62, iy + vDirection * 62, "#ef4444", 3, 10);
  boxedLabel(ctx, "Fᴴ", ix + hDirection * 86, iy - 12, "#1d4ed8", hDirection > 0 ? "left" : "right", 800);
  boxedLabel(ctx, "Fⱽ", ix + 12, iy + vDirection * 88, "#b56805", "left", 800);
  boxedLabel(ctx, "Fᵣ", ix + hDirection * 69, iy + vDirection * 57, "#b91c1c", hDirection > 0 ? "left" : "right", 800);
  marker(ctx, ix, iy, "#ef4444", 4);
  calloutMarker(
    ctx,
    ix,
    centerMassY,
    "#b56805",
    "CM (vertical CP)",
    ix - 18,
    centerMassY - 12,
    "right",
  );
  if (result.topDepth >= 0.15) {
    boxedLabel(ctx, `d = ${fmt(result.topDepth, 1)} m`, centerX - 10, (waterLine + centerY) / 2, "#52667e", "right");
  }
}

function draw() {
  const result = currentResult();
  if (state.surface === "plane") drawPlane(result);
  else drawCurved(result);
}

function render() {
  syncControlLabels();
  const result = currentResult();
  setPressed(elements.planeTab, state.surface === "plane", "aria-selected");
  setPressed(elements.curvedTab, state.surface === "curved", "aria-selected");
  setPressed(elements.exploreMode, state.mode === "explore");
  setPressed(elements.challengeMode, state.mode === "challenge");
  setPressed(elements.concaveSide, state.side === "concave");
  setPressed(elements.convexSide, state.side === "convex");
  elements.planeControls.hidden = state.surface !== "plane";
  elements.curvedControls.hidden = state.surface !== "curved";
  elements.explorePanel.hidden = state.mode !== "explore";
  elements.challengePanel.hidden = state.mode !== "challenge";
  elements.readingBar.hidden = state.mode === "challenge";
  elements.sideDirection.textContent = `Force acts ${result.horizontalDirection} and ${result.verticalDirection}.`;
  renderReadings(result);
  renderLesson(result);
  renderChips();
  draw();
  scheduleUiTypeset();
}

function selectSurface(surface) {
  if (state.surface === surface) return;
  state.surface = surface;
  resetChallenge();
  render();
}

function selectMode(mode) {
  state.mode = mode;
  resetChallenge();
  render();
}

function resetExperiment() {
  const values = defaults[state.surface];
  elements.density.value = values.density;
  elements.fluidPreset.value = String(values.density);
  if (state.surface === "plane") {
    elements.planeAngle.value = values.angle;
    elements.planeTopDepth.value = values.topDepth;
    elements.planeLength.value = values.length;
    elements.planeWidth.value = values.width;
  } else {
    elements.curveTopDepth.value = values.topDepth;
    elements.curveRadius.value = values.radius;
    elements.curveWidth.value = values.width;
    state.side = values.side;
  }
  resetChallenge();
  render();
}

function handleInput() {
  resetChallenge();
  render();
}

function challengeAnswer() {
  const result = currentResult();
  return state.surface === "plane" ? result.forceKN : result.resultantKN;
}

function checkPrediction() {
  const prediction = number(elements.prediction.value);
  if (!Number.isFinite(prediction)) {
    elements.challengeFeedback.textContent = "Enter a numerical prediction in kN first.";
    elements.challengeFeedback.className = "challenge-feedback bad";
    return;
  }
  state.attempts += 1;
  const answer = challengeAnswer();
  const relativeError = Math.abs(prediction - answer) / answer;
  if (relativeError <= 0.02) {
    state.answerRevealed = true;
    elements.challengeFeedback.textContent = `Correct — ${fmt(answer)} kN. Your prediction is within 2%.`;
    elements.challengeFeedback.className = "challenge-feedback good";
    renderReadings(currentResult());
    return;
  }
  const direction = prediction < answer ? "low" : "high";
  elements.challengeFeedback.textContent = `Not yet. Your value is ${direction}; check the centroid depth, projected area, and units.`;
  elements.challengeFeedback.className = "challenge-feedback warn";
}

function showHint() {
  state.hintsUsed += 1;
  const result = currentResult();
  if (state.surface === "plane") {
    elements.challengeFeedback.textContent = `Use \\(A = ${fmt(result.area)}\\;\\mathrm{m^2}\\) and \\(\\bar y = ${fmt(result.centroidDepth)}\\;\\mathrm{m}\\) in \\(F_R = \\rho g\\bar y A\\). Divide newtons by 1000.`;
  } else {
    elements.challengeFeedback.textContent = `Combine \\(F_H = ${fmt(result.horizontalKN)}\\;\\mathrm{kN}\\) and \\(F_V = ${fmt(result.verticalKN)}\\;\\mathrm{kN}\\) using \\(F_R = \\sqrt{F_H^2 + F_V^2}\\).`;
  }
  elements.challengeFeedback.className = "challenge-feedback warn";
  typesetMath([elements.challengeFeedback]);
}

function revealAnswer() {
  state.answerRevealed = true;
  const answer = challengeAnswer();
  elements.challengeFeedback.textContent = `The resultant is ${fmt(answer)} kN. Change one control and try the next case without revealing it.`;
  elements.challengeFeedback.className = "challenge-feedback good";
  renderReadings(currentResult());
}

function addCoachMessage(role, text, extraClass = "") {
  const message = document.createElement("div");
  message.className = `coach-message ${role} ${extraClass}`.trim();
  message.textContent = text;
  elements.coachLog.append(message);
  elements.coachLog.scrollTop = elements.coachLog.scrollHeight;
  typesetMath([message]);
  return message;
}

async function askCoach(question) {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion) return;
  addCoachMessage("user", cleanQuestion);
  elements.coachQuestion.value = "";
  const pending = addCoachMessage("coach", "Thinking through the live geometry…", "pending");
  elements.coachStatus.textContent = "Working on your question";
  const historyForRequest = state.history.slice(-8);

  try {
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: cleanQuestion,
        history: historyForRequest,
        context: {
          surface: state.surface,
          mode: state.mode,
          answerRevealed: state.answerRevealed,
          inputs: currentInputs(),
        },
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Coach request failed.");
    pending.textContent = payload.reply;
    pending.classList.remove("pending");
    typesetMath([pending]);
    state.history.push(
      { role: "user", content: cleanQuestion },
      { role: "assistant", content: payload.reply },
    );
    state.history = state.history.slice(-8);
    elements.coachStatus.textContent = payload.source === "openai" ? "AI coaching active" : "Built-in guidance ready";
  } catch (error) {
    pending.textContent = error.message || "I could not answer just now. Try again in a moment.";
    pending.classList.remove("pending");
    elements.coachStatus.textContent = "Guidance temporarily unavailable";
  }
}

elements.planeTab.addEventListener("click", () => selectSurface("plane"));
elements.curvedTab.addEventListener("click", () => selectSurface("curved"));
elements.exploreMode.addEventListener("click", () => selectMode("explore"));
elements.challengeMode.addEventListener("click", () => selectMode("challenge"));
elements.concaveSide.addEventListener("click", () => { state.side = "concave"; handleInput(); });
elements.convexSide.addEventListener("click", () => { state.side = "convex"; handleInput(); });
elements.resetButton.addEventListener("click", resetExperiment);
elements.fluidPreset.addEventListener("change", () => {
  elements.density.value = elements.fluidPreset.value;
  handleInput();
});
elements.density.addEventListener("input", () => {
  const matching = [...elements.fluidPreset.options].find((option) => option.value === elements.density.value);
  elements.fluidPreset.value = matching ? matching.value : "";
  handleInput();
});
for (const input of [
  elements.planeAngle,
  elements.planeTopDepth,
  elements.planeLength,
  elements.planeWidth,
  elements.curveTopDepth,
  elements.curveRadius,
  elements.curveWidth,
]) input.addEventListener("input", handleInput);
elements.checkPrediction.addEventListener("click", checkPrediction);
elements.hintButton.addEventListener("click", showHint);
elements.revealButton.addEventListener("click", revealAnswer);
elements.coachForm.addEventListener("submit", (event) => {
  event.preventDefault();
  askCoach(elements.coachQuestion.value);
});

const resizeObserver = new ResizeObserver(draw);
resizeObserver.observe(elements.forceCanvas.parentElement);
render();

