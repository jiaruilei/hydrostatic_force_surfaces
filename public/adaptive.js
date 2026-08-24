export const SKILL_LABELS = {
  force: "Resultant force",
  cp: "Plane CP",
  resultant: "Curved resultant",
  horizontalCp: "Horizontal CP",
  verticalCp: "Vertical CP",
};

export const ADAPTIVE_CASES = {
  plane: {
    foundation: [
      {
        density: 1000,
        angle: 90,
        topDepth: 3,
        length: 2,
        width: 2,
      },
    ],
    practice: [
      {
        density: 1000,
        angle: 60,
        topDepth: 1,
        length: 2,
        width: 2,
      },
      {
        density: 1000,
        angle: 42,
        topDepth: 2.2,
        length: 3,
        width: 1.5,
      },
    ],
    transfer: {
      density: 1025,
      angle: 37,
      topDepth: 0.7,
      length: 3.2,
      width: 1.4,
    },
  },
  curved: {
    foundation: [
      {
        density: 1000,
        topDepth: 4,
        radius: 2,
        width: 1,
        side: "concave",
      },
    ],
    practice: [
      {
        density: 1000,
        topDepth: 2.5,
        radius: 1.5,
        width: 2,
        side: "concave",
      },
      {
        density: 1000,
        topDepth: 3.2,
        radius: 2.4,
        width: 1.2,
        side: "convex",
      },
    ],
    transfer: {
      density: 1025,
      topDepth: 1.2,
      radius: 2.7,
      width: 1.4,
      side: "concave",
    },
  },
};

export function surfaceSkills(surface) {
  return surface === "curved"
    ? ["resultant", "horizontalCp", "verticalCp"]
    : ["force", "cp"];
}

export function createAdaptiveProgress() {
  return {
    mastery: {
      plane: { force: 0, cp: 0 },
      curved: { resultant: 0, horizontalCp: 0, verticalCp: 0 },
    },
    completed: { plane: 0, curved: 0 },
    independentSolves: 0,
    totalAttempts: 0,
    hints: 0,
    reveals: 0,
    coachTurns: 0,
    focusCounts: {
      force: 0,
      cp: 0,
      resultant: 0,
      horizontalCp: 0,
      verticalCp: 0,
      general: 0,
    },
    lastCoachFocus: "general",
    transferPassed: { plane: false, curved: false },
  };
}

function bounded(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

export function normaliseAdaptiveProgress(value = {}) {
  const blank = createAdaptiveProgress();
  for (const surface of ["plane", "curved"]) {
    for (const skill of surfaceSkills(surface)) {
      blank.mastery[surface][skill] = bounded(value?.mastery?.[surface]?.[skill]);
    }
    blank.completed[surface] = count(value?.completed?.[surface]);
    blank.transferPassed[surface] = Boolean(value?.transferPassed?.[surface]);
  }
  for (const key of ["independentSolves", "totalAttempts", "hints", "reveals", "coachTurns"]) {
    blank[key] = count(value?.[key]);
  }
  for (const key of Object.keys(blank.focusCounts)) {
    blank.focusCounts[key] = count(value?.focusCounts?.[key]);
  }
  if (Object.hasOwn(blank.focusCounts, value?.lastCoachFocus)) {
    blank.lastCoachFocus = value.lastCoachFocus;
  }
  return blank;
}

export function averageMastery(progress, surface) {
  const skills = surfaceSkills(surface);
  const total = skills.reduce((sum, skill) => sum + bounded(progress?.mastery?.[surface]?.[skill]), 0);
  return total / skills.length;
}

export function masteryBand(score) {
  if (score < 0.35) return "Foundation";
  if (score < 0.7) return "Practice";
  return "Transfer ready";
}

export function transferUnlocked(progress, surface) {
  return surfaceSkills(surface).every((skill) => bounded(progress?.mastery?.[surface]?.[skill]) >= 0.55);
}

export function updateSkillMastery(current, evidence = {}) {
  if (!evidence.correct) return bounded(current);
  let weight = evidence.attempts <= 1 ? 0.4 : 0.3;
  if (evidence.hintsUsed > 0) weight = 0.25;
  if (evidence.transfer) weight = 0.5;
  const value = bounded(current);
  return Math.min(1, value + (1 - value) * weight);
}

export function chooseAdaptiveCase(surface, progress) {
  const type = averageMastery(progress, surface) < 0.35 ? "foundation" : "practice";
  const cases = ADAPTIVE_CASES[surface][type];
  const completed = count(progress?.completed?.[surface]);
  const index = type === "practice" ? Math.max(0, completed - 1) : completed;
  return { ...cases[index % cases.length] };
}

export function transferCase(surface) {
  return { ...ADAPTIVE_CASES[surface].transfer };
}

export function classifyCoachFocus(question, surface) {
  const text = String(question || "").toLowerCase();
  if (surface === "plane") {
    if (/\b(cp|cent(?:er|re) of pressure|line of action|pressure)\b/.test(text)) return "cp";
    if (/\b(force|resultant|area|magnitude)\b/.test(text)) return "force";
    return "general";
  }
  if (/vertical/.test(text) && /\b(cp|cent(?:er|re)|mass|volume|line of action)\b/.test(text)) return "verticalCp";
  if (/horizontal|projection/.test(text) && /\b(cp|cent(?:er|re)|pressure|line of action|projection)\b/.test(text)) return "horizontalCp";
  if (/\b(cp|cent(?:er|re) of pressure|line of action)\b/.test(text)) return "horizontalCp";
  if (/\b(force|resultant|component|magnitude)\b/.test(text)) return "resultant";
  return "general";
}
