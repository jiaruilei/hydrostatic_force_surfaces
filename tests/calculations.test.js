import assert from "node:assert/strict";
import test from "node:test";

import { curvedForces, GRAVITY, planeForces } from "../public/calculations.js";

function close(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("uses the course gravitational acceleration", () => {
  assert.equal(GRAVITY, 9.8);
});

test("plane-surface lecture example", () => {
  const result = planeForces({
    density: 1000,
    topDepth: 3,
    length: 2,
    width: 2,
    angle: 90,
  });

  close(result.centroidPosition, 4);
  close(result.centroidWaterDepth, 4);
  close(result.forceKN, 156.8);
  close(result.centerPressurePosition, 4.083333333333333);
  close(result.centerPressureWaterDepth, 4.083333333333333);
  close(result.centroidToPressure, 0.08333333333333326);
});

test("inclined plane distinguishes along-plate y from vertical water depth h", () => {
  const result = planeForces({
    density: 1000,
    topDepth: 1,
    length: 2,
    width: 2,
    angle: 30,
  });

  close(result.topPositionAlongPlane, 2);
  close(result.centroidPosition, 3);
  close(result.centroidWaterDepth, 1.5);
  close(result.centerPressurePosition, 3.111111111111111);
  close(result.centerPressureWaterDepth, 1.5555555555555554);
});

test("quarter-circle curved-surface lecture example", () => {
  const result = curvedForces({
    density: 1000,
    topDepth: 4,
    radius: 2,
    width: 1,
  });

  const verticalKN = GRAVITY * (8 + Math.PI);

  close(result.horizontalKN, 98);
  close(result.horizontalCenterDepth, 5.066666666666666);
  close(result.verticalKN, verticalKN);
  close(result.verticalCenterX, 0.9573735998353784);
  close(result.verticalCenterDepth, 2.8032830002057767);
  close(result.verticalLineX, 0.9573735998353784);
  close(result.resultantKN, Math.hypot(98, verticalKN));
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
  close(lower.centerPressurePosition, upper.centerPressurePosition);
  assert.deepEqual(
    [upper.horizontalDirection, upper.verticalDirection],
    ["left", "downward"],
  );
  assert.deepEqual(
    [lower.horizontalDirection, lower.verticalDirection],
    ["right", "upward"],
  );
});
