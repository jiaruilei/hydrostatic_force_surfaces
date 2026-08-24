import assert from "node:assert/strict";
import test from "node:test";

import {
  averageMastery,
  chooseAdaptiveCase,
  classifyCoachFocus,
  createAdaptiveProgress,
  masteryBand,
  normaliseAdaptiveProgress,
  transferUnlocked,
  updateSkillMastery,
} from "../public/adaptive.js";

test("adaptive cases progress from foundation to practice", () => {
  const progress = createAdaptiveProgress();
  assert.equal(chooseAdaptiveCase("plane", progress).angle, 90);
  progress.mastery.plane.force = 0.4;
  progress.mastery.plane.cp = 0.4;
  assert.equal(chooseAdaptiveCase("plane", progress).angle, 60);
  assert.equal(masteryBand(averageMastery(progress, "plane")), "Practice");
});

test("mastery values reward independent evidence more than hinted evidence", () => {
  const independent = updateSkillMastery(0, { correct: true, attempts: 1, hintsUsed: 0 });
  const hinted = updateSkillMastery(0, { correct: true, attempts: 1, hintsUsed: 1 });
  assert.equal(independent, 0.4);
  assert.equal(hinted, 0.25);
  assert.ok(independent > hinted);
});

test("transfer unlock requires every surface skill", () => {
  const progress = createAdaptiveProgress();
  progress.mastery.curved = { resultant: 0.7, horizontalCp: 0.7, verticalCp: 0.4 };
  assert.equal(transferUnlocked(progress, "curved"), false);
  progress.mastery.curved.verticalCp = 0.6;
  assert.equal(transferUnlocked(progress, "curved"), true);
});

test("chat classification targets support without scoring verbosity", () => {
  assert.equal(classifyCoachFocus("Why is the vertical CP at the volume centroid?", "curved"), "verticalCp");
  assert.equal(classifyCoachFocus("Explain the vertical projection", "curved"), "horizontalCp");
  assert.equal(classifyCoachFocus("Hello", "plane"), "general");
});

test("stored adaptive progress is bounded and safely normalised", () => {
  const progress = normaliseAdaptiveProgress({
    mastery: { plane: { force: 4, cp: -1 } },
    totalAttempts: 2.8,
    lastCoachFocus: "unknown",
  });
  assert.deepEqual(progress.mastery.plane, { force: 1, cp: 0 });
  assert.equal(progress.totalAttempts, 2);
  assert.equal(progress.lastCoachFocus, "general");
});

