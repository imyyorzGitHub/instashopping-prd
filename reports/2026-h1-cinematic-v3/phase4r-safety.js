import * as THREE from "three";

const GUIDE = [
  [-29.81, 0.74, -16.21],
  [-28.70, 0.54, -18.60],
  [-30.10, 0.34, -21.35],
  [-27.15, 0.27, -24.20],
  [-24.00, 0.22, -27.10],
  [-25.55, 0.24, -30.05],
  [-22.15, 0.26, -33.25],
  [-19.30, 0.34, -36.10],
  [-17.57, 0.88, -38.51]
];

function closestPointOnSegment(px, pz, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const denom = dx * dx + dz * dz || 1;
  const t = THREE.MathUtils.clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / denom, 0, 1);
  const x = a[0] + dx * t;
  const z = a[1] + dz * t;
  return { x, z, d: Math.hypot(px - x, pz - z) };
}

function nearestRoadPoint(roads, point, maxDistance = 4.5) {
  let best = null;
  for (const road of roads) {
    for (let i = 1; i < road.p.length; i++) {
      const candidate = closestPointOnSegment(point.x, point.z, road.p[i - 1], road.p[i]);
      if ((!best || candidate.d < best.d) && candidate.d <= maxDistance) best = candidate;
    }
  }
  return best;
}

function pointInPolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const crosses = ((zi > z) !== (zj > z)) && x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-6) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function nearestBoundary(x, z, polygon) {
  let best = { x, z, d: Infinity };
  for (let i = 0; i < polygon.length; i++) {
    const candidate = closestPointOnSegment(x, z, polygon[i], polygon[(i + 1) % polygon.length]);
    if (candidate.d < best.d) best = candidate;
  }
  return best;
}

function centroid(polygon) {
  const sum = polygon.reduce((acc, [x, z]) => [acc[0] + x, acc[1] + z], [0, 0]);
  return [sum[0] / polygon.length, sum[1] / polygon.length];
}

function inflatePolygon(polygon, amount) {
  const [cx, cz] = centroid(polygon);
  return polygon.map(([x, z]) => {
    const dx = x - cx;
    const dz = z - cz;
    const length = Math.hypot(dx, dz) || 1;
    return [x + dx / length * amount, z + dz / length * amount];
  });
}

function containsAnchor(building, anchors) {
  return anchors.some(anchor =>
    pointInPolygon(anchor.x, anchor.z, building.p) ||
    nearestBoundary(anchor.x, anchor.z, building.p).d < 0.65
  );
}

function relevantBuildings(cityData, anchors) {
  return cityData.buildings
    .filter(building => !containsAnchor(building, anchors))
    .map(building => ({
      ...building,
      p: inflatePolygon(building.p, 0.075),
      renderHeight: building.h * 0.18
    }))
    .filter(building => {
      const [cx, cz] = centroid(building.p);
      return cx > -35 && cx < -12 && cz > -44 && cz < -11;
    });
}

function correctionForPoint(point, buildings, clearance = 0.19) {
  let strongest = null;
  for (const building of buildings) {
    if (point.y > building.renderHeight + 0.12) continue;
    const inside = pointInPolygon(point.x, point.z, building.p);
    const boundary = nearestBoundary(point.x, point.z, building.p);
    if (!inside && boundary.d >= clearance) continue;

    let dx = inside ? boundary.x - point.x : point.x - boundary.x;
    let dz = inside ? boundary.z - point.z : point.z - boundary.z;
    let length = Math.hypot(dx, dz);
    if (length < 1e-5) {
      const [cx, cz] = centroid(building.p);
      dx = point.x - cx;
      dz = point.z - cz;
      length = Math.hypot(dx, dz) || 1;
    }
    const magnitude = inside ? boundary.d + clearance : clearance - boundary.d;
    const correction = new THREE.Vector3(dx / length * magnitude, 0, dz / length * magnitude);
    if (!strongest || correction.lengthSq() > strongest.lengthSq()) strongest = correction;
  }
  return strongest;
}

function initialControlPoints(cityData) {
  return GUIDE.map(([x, y, z], index) => {
    const guide = new THREE.Vector3(x, y, z);
    if (index === 0 || index === GUIDE.length - 1) return guide;
    const road = nearestRoadPoint(cityData.roads, guide);
    if (!road) return guide;
    guide.x = THREE.MathUtils.lerp(guide.x, road.x, 0.72);
    guide.z = THREE.MathUtils.lerp(guide.z, road.z, 0.72);
    return guide;
  });
}

function solveSafeControls(cityData, buildings) {
  const controls = initialControlPoints(cityData);
  let passes = 0;
  for (let iteration = 0; iteration < 18; iteration++) {
    const curve = new THREE.CatmullRomCurve3(controls, false, "centripetal", 0.26);
    let changed = false;
    for (let sample = 4; sample < 316; sample++) {
      const t = sample / 320;
      if (t < 0.035 || t > 0.955) continue;
      const point = curve.getPointAt(t);
      const correction = correctionForPoint(point, buildings, 0.19);
      if (!correction) continue;
      let nearestIndex = 1;
      let nearestDistance = Infinity;
      for (let index = 1; index < controls.length - 1; index++) {
        const distance = controls[index].distanceToSquared(point);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      }
      const limited = correction.clone().clampLength(0, 0.24).multiplyScalar(0.72);
      controls[nearestIndex].add(limited);
      const previous = Math.max(1, nearestIndex - 1);
      const next = Math.min(controls.length - 2, nearestIndex + 1);
      const neighbour = point.distanceTo(controls[previous]) < point.distanceTo(controls[next]) ? previous : next;
      if (neighbour !== nearestIndex) controls[neighbour].addScaledVector(limited, 0.28);
      changed = true;
      passes++;
    }
    if (!changed) break;
  }
  return { controls, passes };
}

function syntheticRoadsForControls(controls) {
  return controls.slice(1, -1).map((safePoint, offset) => {
    const index = offset + 1;
    const [gx, , gz] = GUIDE[index];
    const roadX = (safePoint.x - gx * 0.28) / 0.72;
    const roadZ = (safePoint.z - gz * 0.28) / 0.72;
    return {
      p: [[roadX - 0.002, roadZ - 0.002], [roadX + 0.002, roadZ + 0.002]],
      k: "service",
      b: false
    };
  });
}

function auditControls(controls, buildings) {
  const curve = new THREE.CatmullRomCurve3(controls, false, "centripetal", 0.26);
  let collisionSamples = 0;
  let minClearance = Infinity;
  for (let sample = 3; sample < 318; sample++) {
    const t = sample / 320;
    if (t < 0.035 || t > 0.955) continue;
    const point = curve.getPointAt(t);
    let sampleClearance = Infinity;
    for (const building of buildings) {
      if (point.y > building.renderHeight + 0.12) continue;
      const inside = pointInPolygon(point.x, point.z, building.p);
      const distance = nearestBoundary(point.x, point.z, building.p).d;
      sampleClearance = Math.min(sampleClearance, inside ? -distance : distance);
    }
    minClearance = Math.min(minClearance, sampleClearance);
    if (sampleClearance < 0.12) collisionSamples++;
  }
  return {
    collisionSamples,
    minClearance: Number((Number.isFinite(minClearance) ? minClearance : 99).toFixed(3))
  };
}

export function prepareCollisionSafeSliceData(cityData, landmarks) {
  const tower = landmarks.find(item => item.id === "macau-tower");
  const lisboa = landmarks.find(item => item.id === "grand-lisboa");
  const anchors = [tower?.position, lisboa?.position].filter(Boolean);
  const buildings = relevantBuildings(cityData, anchors);
  const { controls, passes } = solveSafeControls(cityData, buildings);
  const audit = { ...auditControls(controls, buildings), solverPasses: passes };

  const endpointSafeBuildings = cityData.buildings.filter(building => !containsAnchor(building, anchors));
  return {
    data: {
      ...cityData,
      roads: syntheticRoadsForControls(controls),
      buildings: endpointSafeBuildings
    },
    audit
  };
}
