import assert from "node:assert/strict";
import test from "node:test";

import { curvedForces, planeForces } from "../public/calculations.js";

function close(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("plane-surface lecture example", () => {
  const result = planeForces({
    density: 1000,
    topDepth: 3,
    length: 2,
    width: 2,
    angle: 90,
  });

  close(result.centroidDepth, 4);
  close(result.forceKN, 156.96);
  close(result.centerPressureDepth, 4.083333333333333);
  close(result.centroidToPressure, 0.08333333333333326);
});

test("quarter-circle curved-surface lecture example", () => {
  const result = curvedForces({
    density: 1000,
    topDepth: 4,
    radius: 2,
    width: 1,
  });

  close(result.horizontalKN, 98.1);
  close(result.horizontalCenterDepth, 5.066666666666666);
  close(result.verticalKN, 109.29902393171587);
  close(result.verticalCenterX, 0.9573735998353784);
  close(result.verticalCenterDepth, 2.8032830002057767);
  close(result.verticalLineX, 0.9573735998353784);
  close(result.resultantKN, Math.hypot(98.1, 109.29902393171587));
});

test("force magnitude scales linearly with density and width", () => {
  const base = planeForces({ density: 1000, width: 1 });
  const scaled = planeForces({ density: 2000, width: 3 });
  close(scaled.forceN / base.forceN, 6);
});

test("plane loaded side reverses direction without changing force or CP", () => {
  const upper = planeForces({ angle: 60, side: "upper" });
  const lower = planeForces({ angle: 60, side: "lower" });

  close(lower.forceN, upper.forceN);
  close(lower.centerPressureDepth, upper.centerPressureDepth);
  assert.deepEqual(
    [upper.horizontalDirection, upper.verticalDirection],
    ["left", "downward"],
  );
  assert.deepEqual(
    [lower.horizontalDirection, lower.verticalDirection],
    ["right", "upward"],
  );
});
