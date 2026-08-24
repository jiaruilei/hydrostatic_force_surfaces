export const GRAVITY = 9.81;

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function planeForces(input = {}) {
  const density = clamp(finite(input.density, 1000), 100, 14000);
  const topDepth = clamp(finite(input.topDepth, 1), 0, 20);
  const length = clamp(finite(input.length, 2), 0.1, 20);
  const width = clamp(finite(input.width, 2), 0.1, 20);
  const angle = clamp(finite(input.angle, 60), 1, 90);
  const side = input.side === "lower" ? "lower" : "upper";
  const theta = angle * Math.PI / 180;
  const sinTheta = Math.sin(theta);
  const area = width * length;
  const centroidDepth = topDepth + 0.5 * length * sinTheta;
  const centroidalInertia = width * length ** 3 / 12;
  const forceN = density * GRAVITY * centroidDepth * area;
  const centerPressureDepth = centroidDepth
    + centroidalInertia * sinTheta ** 2 / (centroidDepth * area);
  const centerPressureFromTop = (centerPressureDepth - topDepth) / sinTheta;
  const centroidToPressure = centerPressureFromTop - length / 2;
  const bottomDepth = topDepth + length * sinTheta;

  return {
    density,
    topDepth,
    length,
    width,
    angle,
    side,
    theta,
    sinTheta,
    area,
    centroidDepth,
    centroidalInertia,
    forceN,
    forceKN: forceN / 1000,
    centerPressureDepth,
    centerPressureFromTop,
    centroidToPressure,
    bottomDepth,
    topPressureKPa: density * GRAVITY * topDepth / 1000,
    bottomPressureKPa: density * GRAVITY * bottomDepth / 1000,
    horizontalDirection: side === "upper" ? "left" : "right",
    verticalDirection: side === "upper" ? "downward" : "upward",
  };
}

export function curvedForces(input = {}) {
  const density = clamp(finite(input.density, 1000), 100, 14000);
  const topDepth = clamp(finite(input.topDepth, 4), 0, 20);
  const radius = clamp(finite(input.radius, 2), 0.1, 10);
  const width = clamp(finite(input.width, 1), 0.1, 20);
  const side = input.side === "convex" ? "convex" : "concave";
  const projectedArea = width * radius;
  const projectedCentroidDepth = topDepth + radius / 2;
  const projectedInertia = width * radius ** 3 / 12;
  const horizontalN = density * GRAVITY * projectedCentroidDepth * projectedArea;
  const horizontalCenterDepth = projectedCentroidDepth
    + projectedInertia / (projectedCentroidDepth * projectedArea);
  const rectangularVolume = topDepth * radius * width;
  const quarterCircleVolume = Math.PI * radius ** 2 * width / 4;
  const imaginaryVolume = rectangularVolume + quarterCircleVolume;
  const verticalN = density * GRAVITY * imaginaryVolume;
  const rectangleCentroidX = radius / 2;
  const rectangleCentroidDepth = topDepth / 2;
  const quarterCircleCentroidX = 4 * radius / (3 * Math.PI);
  const quarterCircleCentroidDepth = topDepth + 4 * radius / (3 * Math.PI);
  const verticalCenterX = (
    rectangularVolume * rectangleCentroidX
    + quarterCircleVolume * quarterCircleCentroidX
  ) / imaginaryVolume;
  const verticalCenterDepth = (
    rectangularVolume * rectangleCentroidDepth
    + quarterCircleVolume * quarterCircleCentroidDepth
  ) / imaginaryVolume;
  const resultantN = Math.hypot(horizontalN, verticalN);
  const resultantAngle = Math.atan2(verticalN, horizontalN) * 180 / Math.PI;

  return {
    density,
    topDepth,
    radius,
    width,
    side,
    projectedArea,
    projectedCentroidDepth,
    projectedInertia,
    horizontalN,
    horizontalKN: horizontalN / 1000,
    horizontalCenterDepth,
    rectangularVolume,
    quarterCircleVolume,
    imaginaryVolume,
    verticalN,
    verticalKN: verticalN / 1000,
    verticalCenterX,
    verticalCenterDepth,
    verticalLineX: verticalCenterX,
    resultantN,
    resultantKN: resultantN / 1000,
    resultantAngle,
    horizontalDirection: side === "concave" ? "right" : "left",
    verticalDirection: side === "concave" ? "downward" : "upward",
  };
}
