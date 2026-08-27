import { curvedForces, GRAVITY, planeForces } from "./calculations.js";
import {
  SKILL_LABELS,
  averageMastery,
  chooseAdaptiveCase,
  classifyCoachFocus,
  createAdaptiveProgress,
  masteryBand,
  normaliseAdaptiveProgress,
  surfaceSkills,
  transferCase,
  transferDensityChange,
  transferUnlocked,
  updateSkillMastery,
} from "./adaptive.js";

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
  planeUpperSide: $("planeUpperSide"),
  planeLowerSide: $("planeLowerSide"),
  planeSideDirection: $("planeSideDirection"),
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
  challengeInputs: $("challengeInputs"),
  forcePredictionLabel: $("forcePredictionLabel"),
  cpPredictionLabel: $("cpPredictionLabel"),
  prediction: $("prediction"),
  cpPrediction: $("cpPrediction"),
  verticalCpGroup: $("verticalCpGroup"),
  verticalCpPrediction: $("verticalCpPrediction"),
  checkPrediction: $("checkPrediction"),
  hintButton: $("hintButton"),
  revealButton: $("revealButton"),
  challengeFeedback: $("challengeFeedback"),
  adaptivePanel: document.querySelector(".adaptive-evaluation"),
  adaptiveBand: $("adaptiveBand"),
  adaptiveGuidance: $("adaptiveGuidance"),
  transferDensityNotice: $("transferDensityNotice"),
  masteryGrid: $("masteryGrid"),
  evidenceRow: $("evidenceRow"),
  nextAdaptiveCase: $("nextAdaptiveCase"),
  startTransferCheck: $("startTransferCheck"),
  resetAdaptiveProgress: $("resetAdaptiveProgress"),
  coachStatus: $("coachStatus"),
  coachLog: $("coachLog"),
  coachChips: $("coachChips"),
  coachForm: $("coachForm"),
  coachQuestion: $("coachQuestion"),
  coachSubmit: $("coachSubmit"),
};

const defaults = {
  plane: { density: 1000, angle: 60, topDepth: 1, length: 2, width: 2, side: "upper" },
  curved: { density: 1000, topDepth: 4, radius: 2, width: 1, side: "concave" },
};

const ADAPTIVE_STORAGE_KEY = "hydrostatic-adaptive-progress-v1";

function loadAdaptiveProgress() {
  try {
    return normaliseAdaptiveProgress(JSON.parse(localStorage.getItem(ADAPTIVE_STORAGE_KEY) || "{}"));
  } catch {
    return createAdaptiveProgress();
  }
}

function saveAdaptiveProgress() {
  try {
    localStorage.setItem(ADAPTIVE_STORAGE_KEY, JSON.stringify(state.adaptiveProgress));
  } catch {
    // Progress remains available for the current session when storage is unavailable.
  }
}

const state = {
  surface: "plane",
  mode: "explore",
  answerRevealed: false,
  attempts: 0,
  hintsUsed: 0,
  history: [],
  planeSide: "upper",
  side: "concave",
  adaptiveProgress: loadAdaptiveProgress(),
  creditedSkills: [],
  transferActive: false,
  transferDensityChange: null,
  apiConfigured: false,
  apiConnected: false,
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
    side: state.planeSide,
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
  state.creditedSkills = [];
  elements.prediction.value = "";
  elements.cpPrediction.value = "";
  elements.verticalCpPrediction.value = "";
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
      readingCard("Centroid water depth", `${fmt(result.centroidWaterDepth)} m`, "h̄, measured vertically"),
      readingCard("Resultant force", `${fmt(result.forceKN)} kN`, "normal to the plate", challengeHidden),
      readingCard("CP position", `${fmt(result.centerPressurePosition)} m`, "along plate from the free surface"),
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

function methodStep(index, title, formula) {
  return `<div class="method-step"><b>${index}</b><h4>${title}</h4><span class="formula">${formula}</span></div>`;
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
    elements.lessonSummary.textContent = "Measure y along the plate and h vertically below the free surface, then follow the pressure to the resultant and centre of pressure.";
    elements.canvasTitle.textContent = "Inclined rectangular plate";
    elements.methodTitle.textContent = "Plane-surface workflow";
    elements.methodSteps.innerHTML = [
      methodStep(1, "Locate the centroid", "\\(\\bar y = \\frac{h_t}{\\sin\\theta}+\\frac{L}{2},\\quad \\bar h=\\bar y\\sin\\theta\\)"),
      methodStep(2, "Integrate the pressure", "\\(F_R = \\rho g\\bar h A\\)"),
      methodStep(3, "Place the resultant", "\\(y_{CP} = \\bar y + \\frac{I_G}{\\bar y A}\\)"),
    ].join("");
    elements.resultTitle.textContent = "From y and h to the centre of pressure";
    elements.equationGrid.innerHTML = [
      equationCard("1 · Geometry", `\\(A = ${fmt(result.width)}\\times${fmt(result.length)} = \\mathbf{${fmt(result.area)}\\;\\mathrm{m^2}}\\)<br>\\(y_t = \\frac{h_t}{\\sin\\theta} = ${fmt(result.topPositionAlongPlane)}\\;\\mathrm{m}\\)<br>\\(\\bar y = y_t + \\frac{L}{2} = \\mathbf{${fmt(result.centroidPosition)}\\;\\mathrm{m}}\\)`),
      equationCard("2 · Resultant", `\\(\\bar h = \\bar y\\sin\\theta = \\mathbf{${fmt(result.centroidWaterDepth)}\\;\\mathrm{m}}\\)<br>\\(F_R = (${fmt(result.density, 0)})(${fmt(GRAVITY, 1)})(${fmt(result.centroidWaterDepth)})(${fmt(result.area)})\\)<br>\\(F_R = \\mathbf{${fmt(result.forceKN)}\\;\\mathrm{kN}}\\)`),
      equationCard("3 · Line of action", `\\(I_G = \\frac{bL^3}{12} = ${fmt(result.centroidalInertia, 3)}\\;\\mathrm{m^4}\\)<br>\\(y_{CP} = \\bar y + \\frac{I_G}{\\bar y A} = \\mathbf{${fmt(result.centerPressurePosition)}\\;\\mathrm{m}}\\)<br>\\(h_{CP}=y_{CP}\\sin\\theta=${fmt(result.centerPressureWaterDepth)}\\;\\mathrm{m}\\)`),
    ].join("");
    elements.challengeTitle.textContent = "Predict the force and centre of pressure";
    elements.challengePrompt.textContent = "Calculate the resultant force and centre-of-pressure position along the y-axis, measured from the free-surface origin. Both answers must be within 2%.";
    elements.forcePredictionLabel.textContent = "Resultant force";
    elements.cpPredictionLabel.textContent = "CP position along y-axis";
    elements.verticalCpGroup.hidden = true;
    elements.challengeInputs.classList.remove("curved-inputs");
    elements.coachQuestion.placeholder = "Why is the centre of pressure below the centroid?";
    return;
  }

  elements.lessonKicker.textContent = "Curved surface";
  elements.lessonTitle.textContent = "Resolve the force into projection and weight";
  elements.lessonSummary.textContent = "For a curved gate, find the horizontal force on the vertical projection and the vertical weight of the imaginary fluid above the curve.";
  elements.canvasTitle.textContent = "Quarter-circle curved gate";
  elements.methodTitle.textContent = "Curved-surface workflow";
  elements.methodSteps.innerHTML = [
    methodStep(1, "Project vertically", "\\(F_H = \\rho g\\bar y A_v\\)"),
    methodStep(2, "Weigh imaginary fluid", "\\(F_V = \\rho gV\\)"),
    methodStep(3, "Combine components", "\\(F_R = \\sqrt{F_H^2 + F_V^2}\\)"),
  ].join("");
  elements.resultTitle.textContent = "Projection, imaginary volume, and resultant";
  elements.equationGrid.innerHTML = [
    equationCard("1 · Horizontal", `\\(A_v = bR = ${fmt(result.projectedArea)}\\;\\mathrm{m^2}\\)<br>\\(F_H = \\rho g\\bar y A_v = \\mathbf{${fmt(result.horizontalKN)}\\;\\mathrm{kN}}\\)`),
    equationCard("2 · Vertical", `\\(V = bdR + \\frac{1}{4}\\pi bR^2 = ${fmt(result.imaginaryVolume)}\\;\\mathrm{m^3}\\)<br>\\(F_V = \\rho gV = \\mathbf{${fmt(result.verticalKN)}\\;\\mathrm{kN}}\\)<br>\\(x_V = \\frac{V_r(R/2)+V_q(4R/3\\pi)}{V} = \\mathbf{${fmt(result.verticalCenterX)}\\;\\mathrm{m}}\\)`),
    equationCard("3 · Resultant", `\\(F_R = \\sqrt{${fmt(result.horizontalKN)}^2 + ${fmt(result.verticalKN)}^2}\\)<br>\\(F_R = \\mathbf{${fmt(result.resultantKN)}\\;\\mathrm{kN}},\\quad \\theta_R = ${fmt(result.resultantAngle, 1)}^\\circ\\)`),
  ].join("");
  elements.challengeTitle.textContent = "Predict the force and component CPs";
  elements.challengePrompt.textContent = "Calculate the resultant, horizontal CP depth, and vertical CP from the left edge. All answers must be within 2%.";
  elements.forcePredictionLabel.textContent = "Resultant force";
  elements.cpPredictionLabel.textContent = "Horizontal CP";
  elements.verticalCpGroup.hidden = false;
  elements.challengeInputs.classList.add("curved-inputs");
  elements.coachQuestion.placeholder = "Why does the vertical component equal a fluid weight?";
}

function renderChips() {
  const prompts = state.surface === "plane"
    ? ["Give me a hint", "Why does angle matter?", "Explain the centre of pressure", "Which way does the force act?"]
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

function coachFocusLabel(focus) {
  return {
    force: "resultant force",
    cp: "plane CP",
    resultant: "curved resultant",
    horizontalCp: "horizontal CP",
    verticalCp: "vertical CP",
    general: "general concepts",
  }[focus] || "general concepts";
}

function coachReadyLabel() {
  if (state.apiConnected) return "Connected to API";
  if (state.apiConfigured) return "API configured";
  return "Built-in guidance ready";
}

function renderAdaptivePanel() {
  const progress = state.adaptiveProgress;
  const skills = surfaceSkills(state.surface);
  const average = averageMastery(progress, state.surface);
  const unlocked = transferUnlocked(progress, state.surface);
  const passed = progress.transferPassed[state.surface];
  const focus = progress.lastCoachFocus;

  elements.adaptivePanel.classList.toggle("transfer-active", state.transferActive);
  elements.adaptiveBand.textContent = state.transferActive ? "Independent check" : masteryBand(average);
  const densityChange = state.transferActive ? state.transferDensityChange : null;
  elements.transferDensityNotice.hidden = !densityChange;
  elements.transferDensityNotice.textContent = densityChange
    ? `Fluid update: density changed from ${fmt(densityChange.from, 0)} to ${fmt(densityChange.to, 0)} kg/m³ for this transfer case.`
    : "";
  if (state.transferActive) {
    elements.adaptiveGuidance.textContent = "Solve this unfamiliar case without hints or AI coaching. The geometry is locked until the check is complete.";
  } else if (passed) {
    elements.adaptiveGuidance.textContent = "Independent transfer passed. Continue with new cases to strengthen retention.";
  } else if (unlocked) {
    elements.adaptiveGuidance.textContent = "All current skills have enough evidence for an independent transfer check.";
  } else {
    elements.adaptiveGuidance.textContent = `The next case follows your Challenge results. Recent chat questions adjust support toward ${coachFocusLabel(focus)}, but do not change mastery scores.`;
  }

  elements.masteryGrid.innerHTML = skills.map((skill) => {
    const value = Math.round(progress.mastery[state.surface][skill] * 100);
    return `<div class="mastery-item">
      <div class="mastery-label"><span>${SKILL_LABELS[skill]}</span><span>${value}%</span></div>
      <div class="mastery-track" role="progressbar" aria-label="${SKILL_LABELS[skill]} mastery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}">
        <div class="mastery-fill" style="width:${value}%"></div>
      </div>
    </div>`;
  }).join("");

  elements.evidenceRow.innerHTML = [
    `Solved: ${progress.completed[state.surface]}`,
    `Attempts: ${progress.totalAttempts}`,
    `Independent first tries: ${progress.independentSolves}`,
    `Hints: ${progress.hints}`,
    `Reveals: ${progress.reveals}`,
    `Coach turns: ${progress.coachTurns}`,
    `Transfer: ${passed ? "passed" : "not yet"}`,
  ].map((item) => `<span class="evidence-chip">${item}</span>`).join("");

  elements.nextAdaptiveCase.textContent = state.answerRevealed ? "Next adaptive case" : "Load recommended case";
  elements.nextAdaptiveCase.disabled = state.transferActive;
  elements.startTransferCheck.disabled = state.transferActive || !unlocked || passed;
  elements.startTransferCheck.textContent = passed ? "Transfer passed" : "Start independent transfer";
}

function syncAdaptiveControls() {
  const locked = state.mode === "challenge" && state.transferActive;
  for (const control of [
    elements.fluidPreset,
    elements.density,
    elements.planeAngle,
    elements.planeTopDepth,
    elements.planeLength,
    elements.planeWidth,
    elements.curveTopDepth,
    elements.curveRadius,
    elements.curveWidth,
    elements.concaveSide,
    elements.convexSide,
    elements.resetButton,
  ]) control.disabled = locked;
  elements.hintButton.hidden = locked;
  elements.revealButton.hidden = locked;
  elements.coachQuestion.disabled = locked;
  elements.coachSubmit.disabled = locked;
  for (const chip of elements.coachChips.querySelectorAll("button")) chip.disabled = locked;
  if (locked) elements.coachStatus.textContent = "Coach paused for independent transfer";
  else if (elements.coachStatus.textContent === "Coach paused for independent transfer") {
    elements.coachStatus.textContent = coachReadyLabel();
  }
}

function applyAdaptiveCase(caseData, transfer = false) {
  const previousDensity = number(elements.density.value);
  const densityChange = transferDensityChange(previousDensity, caseData.density);
  elements.density.value = caseData.density;
  const matchingFluid = [...elements.fluidPreset.options].find((option) => option.value === String(caseData.density));
  elements.fluidPreset.value = matchingFluid ? matchingFluid.value : "";
  if (state.surface === "plane") {
    elements.planeAngle.value = caseData.angle;
    elements.planeTopDepth.value = caseData.topDepth;
    elements.planeLength.value = caseData.length;
    elements.planeWidth.value = caseData.width;
  } else {
    elements.curveTopDepth.value = caseData.topDepth;
    elements.curveRadius.value = caseData.radius;
    elements.curveWidth.value = caseData.width;
    state.side = caseData.side;
  }
  state.transferActive = transfer;
  state.transferDensityChange = transfer ? densityChange : null;
  resetChallenge();
  elements.challengeFeedback.textContent = transfer
    ? "Independent transfer is active: solve without hints or AI coaching."
    : "A new case has been selected from your current mastery level.";
  render();
}

function loadRecommendedCase() {
  applyAdaptiveCase(chooseAdaptiveCase(state.surface, state.adaptiveProgress));
}

function startTransferCheck() {
  if (!transferUnlocked(state.adaptiveProgress, state.surface)) return;
  applyAdaptiveCase(transferCase(state.surface), true);
}

function resetAdaptiveLearning() {
  state.adaptiveProgress = createAdaptiveProgress();
  state.transferActive = false;
  state.transferDensityChange = null;
  saveAdaptiveProgress();
  resetChallenge();
  render();
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
  const forceSign = result.side === "lower" ? -1 : 1;
  const forceNx = nx * forceSign;
  const forceNy = ny * forceSign;

  ctx.save();
  ctx.strokeStyle = "rgba(71,85,105,.5)";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, waterLine);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
  if (result.topDepth >= 0.15) {
    boxedLabel(ctx, `hₜ = ${fmt(result.topDepth, 1)} m`, x1 - 8, (waterLine + y1) / 2, "#51657d", "right");
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
    arrow(
      ctx,
      px - forceNx * 4,
      py - forceNy * 4,
      px + forceNx * magnitude,
      py + forceNy * magnitude,
      "#1597cf",
      1.8,
      6,
    );
  }

  const centroidT = 0.5;
  const cpT = result.centerPressureFromTop / result.length;
  const cx = x1 + (x2 - x1) * centroidT;
  const cy = y1 + (y2 - y1) * centroidT;
  const cpx = x1 + (x2 - x1) * cpT;
  const cpy = y1 + (y2 - y1) * cpT;
  calloutMarker(ctx, cx, cy, "#2563eb", "Centroid", cx - forceNx * 31, cy - forceNy * 31 - 18);
  calloutMarker(ctx, cpx, cpy, "#ef4444", "Centre of pressure", cpx - forceNx * 31, cpy - forceNy * 31 + 22);
  arrow(ctx, cpx, cpy, cpx + forceNx * 76, cpy + forceNy * 76, "#ef4444", 3, 10);
  boxedLabel(
    ctx,
    state.mode === "challenge" ? "Fᵣ" : `Fᵣ ${fmt(result.forceKN)} kN`,
    cpx + forceNx * 85,
    cpy + forceNy * 85,
    "#b91c1c",
    forceNx < 0 ? "right" : "left",
    800,
  );

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
  arrow(ctx, x2 + tx * 5, y2 + ty * 5, x2 + tx * 42, y2 + ty * 42, "#52667e", 1.5, 6);
  boxedLabel(ctx, "+y", x2 + tx * 48, y2 + ty * 48, "#52667e");
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
  setPressed(elements.planeUpperSide, state.planeSide === "upper");
  setPressed(elements.planeLowerSide, state.planeSide === "lower");
  setPressed(elements.concaveSide, state.side === "concave");
  setPressed(elements.convexSide, state.side === "convex");
  elements.planeControls.hidden = state.surface !== "plane";
  elements.curvedControls.hidden = state.surface !== "curved";
  elements.explorePanel.hidden = state.mode !== "explore";
  elements.challengePanel.hidden = state.mode !== "challenge";
  elements.readingBar.hidden = state.mode === "challenge";
  const planeVerticalDirection = result.angle >= 89.95 ? "" : ` and ${result.verticalDirection}`;
  if (state.surface === "plane") {
    elements.planeSideDirection.textContent = `Force acts ${result.horizontalDirection}${planeVerticalDirection}, normal to the plate.`;
  }
  elements.sideDirection.textContent = `Force acts ${result.horizontalDirection} and ${result.verticalDirection}.`;
  renderReadings(result);
  renderLesson(result);
  renderChips();
  renderAdaptivePanel();
  syncAdaptiveControls();
  draw();
  scheduleUiTypeset();
}

function selectSurface(surface) {
  if (state.surface === surface) return;
  state.transferActive = false;
  state.transferDensityChange = null;
  state.surface = surface;
  resetChallenge();
  render();
}

function selectMode(mode) {
  if (mode !== "challenge") {
    state.transferActive = false;
    state.transferDensityChange = null;
  }
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
    state.planeSide = values.side;
  } else {
    elements.curveTopDepth.value = values.topDepth;
    elements.curveRadius.value = values.radius;
    elements.curveWidth.value = values.width;
    state.side = values.side;
  }
  state.transferActive = false;
  state.transferDensityChange = null;
  resetChallenge();
  render();
}

function handleInput() {
  resetChallenge();
  render();
}

function challengeAnswers() {
  const result = currentResult();
  if (state.surface === "plane") {
    return {
      force: result.forceKN,
      horizontalCp: result.centerPressurePosition,
      verticalCp: null,
    };
  }
  return {
    force: result.resultantKN,
    horizontalCp: result.horizontalCenterDepth,
    verticalCp: result.verticalCenterX,
  };
}

function enteredNumber(input) {
  return input.value.trim() === "" ? NaN : number(input.value);
}

function answerDirection(prediction, answer) {
  return prediction < answer ? "low" : "high";
}

function recordMasteryEvidence(correctness) {
  const progress = state.adaptiveProgress;
  progress.totalAttempts += 1;
  for (const [skill, correct] of Object.entries(correctness)) {
    if (!correct || state.creditedSkills.includes(skill)) continue;
    progress.mastery[state.surface][skill] = updateSkillMastery(
      progress.mastery[state.surface][skill],
      {
        correct,
        attempts: state.attempts,
        hintsUsed: state.hintsUsed,
        transfer: state.transferActive,
      },
    );
    state.creditedSkills.push(skill);
  }
  saveAdaptiveProgress();
}

function checkPrediction() {
  if (state.answerRevealed) return;
  const prediction = enteredNumber(elements.prediction);
  const cpPrediction = enteredNumber(elements.cpPrediction);
  const verticalCpPrediction = enteredNumber(elements.verticalCpPrediction);
  const needsVerticalCp = state.surface === "curved";
  if (
    !Number.isFinite(prediction)
    || !Number.isFinite(cpPrediction)
    || (needsVerticalCp && !Number.isFinite(verticalCpPrediction))
  ) {
    elements.challengeFeedback.textContent = needsVerticalCp
      ? "Enter the resultant, horizontal CP, and vertical CP first."
      : "Enter both the resultant force and CP position first.";
    elements.challengeFeedback.className = "challenge-feedback bad";
    return;
  }
  state.attempts += 1;
  const answers = challengeAnswers();
  const forceCorrect = Math.abs(prediction - answers.force) / answers.force <= 0.02;
  const horizontalCpCorrect = Math.abs(cpPrediction - answers.horizontalCp) / answers.horizontalCp <= 0.02;
  const verticalCpCorrect = !needsVerticalCp
    || Math.abs(verticalCpPrediction - answers.verticalCp) / answers.verticalCp <= 0.02;
  recordMasteryEvidence(needsVerticalCp
    ? { resultant: forceCorrect, horizontalCp: horizontalCpCorrect, verticalCp: verticalCpCorrect }
    : { force: forceCorrect, cp: horizontalCpCorrect });
  if (forceCorrect && horizontalCpCorrect && verticalCpCorrect) {
    const wasTransfer = state.transferActive;
    state.answerRevealed = true;
    state.adaptiveProgress.completed[state.surface] += 1;
    if (state.attempts === 1 && state.hintsUsed === 0) {
      state.adaptiveProgress.independentSolves += 1;
    }
    if (wasTransfer) {
      state.adaptiveProgress.transferPassed[state.surface] = true;
      state.transferActive = false;
      state.transferDensityChange = null;
    }
    saveAdaptiveProgress();
    elements.challengeFeedback.textContent = needsVerticalCp
      ? `Correct — ${fmt(answers.force)} kN, horizontal CP ${fmt(answers.horizontalCp)} m, and vertical CP ${fmt(answers.verticalCp)} m.${wasTransfer ? " Independent transfer passed." : ""}`
      : `Correct — ${fmt(answers.force)} kN and CP position ${fmt(answers.horizontalCp)} m along the plate.${wasTransfer ? " Independent transfer passed." : ""}`;
    elements.challengeFeedback.className = "challenge-feedback good";
    renderReadings(currentResult());
    renderAdaptivePanel();
    syncAdaptiveControls();
    return;
  }
  const corrections = [];
  if (!forceCorrect) corrections.push(`resultant is ${answerDirection(prediction, answers.force)}`);
  if (!horizontalCpCorrect) corrections.push(`${needsVerticalCp ? "horizontal CP" : "CP position"} is ${answerDirection(cpPrediction, answers.horizontalCp)}`);
  if (!verticalCpCorrect) corrections.push(`vertical CP is ${answerDirection(verticalCpPrediction, answers.verticalCp)}`);
  elements.challengeFeedback.textContent = `Not yet — ${corrections.join("; ")}. Check the relevant line-of-action formula and units.`;
  elements.challengeFeedback.className = "challenge-feedback warn";
  renderAdaptivePanel();
}

function showHint() {
  if (state.transferActive) return;
  state.hintsUsed += 1;
  state.adaptiveProgress.hints += 1;
  const focus = state.adaptiveProgress.lastCoachFocus;
  if (state.surface === "plane") {
    elements.challengeFeedback.textContent = focus === "force"
      ? `Start with \\(\\bar y=h_t/\\sin\\theta+L/2\\), then find \\(\\bar h=\\bar y\\sin\\theta\\) and \\(F_R=\\rho g\\bar hA\\). Use \\(y_{CP}=\\bar y+I_G/(\\bar yA)\\) for the CP entry.`
      : `The CP entry is measured along the plate: \\(y_{CP}=\\bar y+I_G/(\\bar yA)\\). Keep it distinct from the vertical water depth \\(h_{CP}=y_{CP}\\sin\\theta\\).`;
  } else {
    if (focus === "verticalCp") {
      elements.challengeFeedback.textContent = `Use the chat-informed focus: the vertical CP is the centroid line \\(x_V=\\sum V_i x_i/\\sum V_i\\) of the complete imaginary-fluid volume.`;
    } else if (focus === "horizontalCp") {
      elements.challengeFeedback.textContent = `Use the chat-informed focus: treat the vertical projection as a plane surface and calculate \\(y_{H,CP}=\\bar y+I_G/(\\bar yA_v)\\).`;
    } else {
      elements.challengeFeedback.textContent = `Combine \\(F_H\\) and \\(F_V\\) for the resultant. Use the projected plane-surface formula for \\(y_{H,CP}\\), and \\(x_V=\\sum V_i x_i/\\sum V_i\\) for the vertical CP.`;
    }
  }
  elements.challengeFeedback.className = "challenge-feedback warn";
  saveAdaptiveProgress();
  renderAdaptivePanel();
  typesetMath([elements.challengeFeedback]);
}

function revealAnswer() {
  if (state.transferActive || state.answerRevealed) return;
  state.answerRevealed = true;
  state.adaptiveProgress.reveals += 1;
  const answers = challengeAnswers();
  elements.challengeFeedback.textContent = state.surface === "plane"
    ? `Resultant: ${fmt(answers.force)} kN; CP position along the plate: ${fmt(answers.horizontalCp)} m.`
    : `Resultant: ${fmt(answers.force)} kN; horizontal CP: ${fmt(answers.horizontalCp)} m; vertical CP: ${fmt(answers.verticalCp)} m from the left edge.`;
  elements.challengeFeedback.className = "challenge-feedback good";
  saveAdaptiveProgress();
  renderReadings(currentResult());
  renderAdaptivePanel();
}

function compactCoachText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function addCoachMessage(role, text, extraClass = "") {
  const message = document.createElement("div");
  message.className = `coach-message ${role} ${extraClass}`.trim();
  message.textContent = compactCoachText(text);
  elements.coachLog.append(message);
  elements.coachLog.scrollTop = elements.coachLog.scrollHeight;
  typesetMath([message]);
  return message;
}

async function loadCoachStatus() {
  try {
    const response = await fetch("/api/coach/status");
    if (!response.ok) throw new Error("Coach status unavailable");
    const payload = await response.json();
    state.apiConfigured = Boolean(payload.apiConfigured);
    if (!state.transferActive) elements.coachStatus.textContent = coachReadyLabel();
  } catch {
    state.apiConfigured = false;
    if (!state.transferActive) elements.coachStatus.textContent = "Built-in guidance ready";
  }
}

async function askCoach(question) {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion || state.transferActive) return;
  const focus = classifyCoachFocus(cleanQuestion, state.surface);
  state.adaptiveProgress.coachTurns += 1;
  state.adaptiveProgress.focusCounts[focus] += 1;
  state.adaptiveProgress.lastCoachFocus = focus;
  saveAdaptiveProgress();
  renderAdaptivePanel();
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
    const reply = compactCoachText(payload.reply);
    pending.textContent = reply;
    pending.classList.remove("pending");
    typesetMath([pending]);
    state.history.push(
      { role: "user", content: cleanQuestion },
      { role: "assistant", content: reply },
    );
    state.history = state.history.slice(-8);
    state.apiConfigured = Boolean(payload.apiConfigured);
    if (payload.source === "openai") {
      state.apiConnected = true;
      elements.coachStatus.textContent = "Connected to API";
    } else if (payload.fallback) {
      state.apiConnected = false;
      elements.coachStatus.textContent = "API unavailable · built-in fallback";
    } else if (payload.guided && state.apiConfigured) {
      elements.coachStatus.textContent = `${state.apiConnected ? "API connected" : "API configured"} · verified guidance used`;
    } else {
      elements.coachStatus.textContent = "Built-in guidance ready";
    }
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
elements.planeUpperSide.addEventListener("click", () => { state.planeSide = "upper"; handleInput(); });
elements.planeLowerSide.addEventListener("click", () => { state.planeSide = "lower"; handleInput(); });
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
elements.nextAdaptiveCase.addEventListener("click", loadRecommendedCase);
elements.startTransferCheck.addEventListener("click", startTransferCheck);
elements.resetAdaptiveProgress.addEventListener("click", resetAdaptiveLearning);
elements.coachForm.addEventListener("submit", (event) => {
  event.preventDefault();
  askCoach(elements.coachQuestion.value);
});

const resizeObserver = new ResizeObserver(draw);
resizeObserver.observe(elements.forceCanvas.parentElement);
render();
loadCoachStatus();
