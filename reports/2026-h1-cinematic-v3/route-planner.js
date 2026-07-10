import * as THREE from "three";

const GRID_CELL = 1.35;
const SAFETY_RADIUS = 0.72;

class MinHeap {
  constructor() { this.items = []; }
  push(node) {
    const items = this.items;
    items.push(node);
    let i = items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (items[p].f <= node.f) break;
      items[i] = items[p];
      i = p;
    }
    items[i] = node;
  }
  pop() {
    const items = this.items;
    if (!items.length) return null;
    const root = items[0];
    const tail = items.pop();
    if (items.length && tail) {
      let i = 0;
      while (true) {
        const left = i * 2 + 1;
        const right = left + 1;
        if (left >= items.length) break;
        let child = left;
        if (right < items.length && items[right].f < items[left].f) child = right;
        if (items[child].f >= tail.f) break;
        items[i] = items[child];
        i = child;
      }
      items[i] = tail;
    }
    return root;
  }
  get size() { return this.items.length; }
}

function distancePointSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const denom = dx * dx + dz * dz;
  if (!denom) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / denom));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function pointInPolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const crosses = ((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-6) + xi);
    if (crosses) inside = !inside;
  }
  return inside;
}

function polygonDistance(x, z, polygon) {
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    best = Math.min(best, distancePointSegment(x, z, a[0], a[1], b[0], b[1]));
  }
  return best;
}

function roadBiasFor(kind) {
  if (["motorway", "trunk", "primary"].includes(kind)) return 0.22;
  if (["secondary", "tertiary"].includes(kind)) return 0.3;
  if (["residential", "living_street", "pedestrian"].includes(kind)) return 0.38;
  return 0.5;
}

function computeBounds(data, anchors) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const include = (x, z) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  };
  data.roads.forEach(road => road.p.forEach(([x, z]) => include(x, z)));
  anchors.forEach(anchor => include(anchor.position.x, anchor.position.z));
  const margin = 8;
  return { minX: minX - margin, maxX: maxX + margin, minZ: minZ - margin, maxZ: maxZ + margin };
}

function lineSamples(a, b, spacing) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(length / spacing));
  const samples = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    samples.push([THREE.MathUtils.lerp(a[0], b[0], t), THREE.MathUtils.lerp(a[1], b[1], t)]);
  }
  return samples;
}

export function buildNavigationField(data, landmarks) {
  const bounds = computeBounds(data, landmarks);
  const width = Math.ceil((bounds.maxX - bounds.minX) / GRID_CELL) + 1;
  const height = Math.ceil((bounds.maxZ - bounds.minZ) / GRID_CELL) + 1;
  const count = width * height;
  const blocked = new Uint8Array(count);
  const roadCost = new Float32Array(count);
  roadCost.fill(1.18);

  const indexOf = (gx, gz) => gz * width + gx;
  const gridOf = (x, z) => ({
    gx: Math.round((x - bounds.minX) / GRID_CELL),
    gz: Math.round((z - bounds.minZ) / GRID_CELL)
  });
  const worldOf = (gx, gz) => ({
    x: bounds.minX + gx * GRID_CELL,
    z: bounds.minZ + gz * GRID_CELL
  });
  const valid = (gx, gz) => gx >= 0 && gz >= 0 && gx < width && gz < height;

  for (const building of data.buildings) {
    const polygon = building.p;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    polygon.forEach(([x, z]) => {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    });
    const a = gridOf(minX - SAFETY_RADIUS, minZ - SAFETY_RADIUS);
    const b = gridOf(maxX + SAFETY_RADIUS, maxZ + SAFETY_RADIUS);
    for (let gz = Math.max(0, a.gz); gz <= Math.min(height - 1, b.gz); gz++) {
      for (let gx = Math.max(0, a.gx); gx <= Math.min(width - 1, b.gx); gx++) {
        const world = worldOf(gx, gz);
        if (pointInPolygon(world.x, world.z, polygon) || polygonDistance(world.x, world.z, polygon) < SAFETY_RADIUS) {
          blocked[indexOf(gx, gz)] = 1;
        }
      }
    }
  }

  for (const road of data.roads) {
    const bias = roadBiasFor(road.k);
    for (let i = 1; i < road.p.length; i++) {
      for (const [x, z] of lineSamples(road.p[i - 1], road.p[i], GRID_CELL * 0.55)) {
        const { gx, gz } = gridOf(x, z);
        const radius = road.b ? 2 : 1;
        for (let dz = -radius; dz <= radius; dz++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = gx + dx, nz = gz + dz;
            if (!valid(nx, nz)) continue;
            const falloff = 1 + Math.hypot(dx, dz) * 0.15;
            const idx = indexOf(nx, nz);
            roadCost[idx] = Math.min(roadCost[idx], bias * falloff);
          }
        }
      }
    }
  }

  function nearestFree(point, maxRadius = 12) {
    const origin = gridOf(point.x, point.z);
    let best = null;
    for (let radius = 0; radius <= maxRadius; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const gx = origin.gx + dx, gz = origin.gz + dz;
          if (!valid(gx, gz) || blocked[indexOf(gx, gz)]) continue;
          const score = Math.hypot(dx, dz) + roadCost[indexOf(gx, gz)] * 2;
          if (!best || score < best.score) best = { gx, gz, score };
        }
      }
      if (best) return best;
    }
    return { gx: THREE.MathUtils.clamp(origin.gx, 0, width - 1), gz: THREE.MathUtils.clamp(origin.gz, 0, height - 1), score: 999 };
  }

  return { bounds, width, height, blocked, roadCost, indexOf, gridOf, worldOf, valid, nearestFree, cell: GRID_CELL };
}

const DIRECTIONS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]
];

function reconstruct(cameFrom, current, field) {
  const result = [];
  while (current >= 0) {
    const gx = current % field.width;
    const gz = Math.floor(current / field.width);
    const world = field.worldOf(gx, gz);
    result.push(new THREE.Vector3(world.x, 0, world.z));
    current = cameFrom[current];
  }
  return result.reverse();
}

export function findRoadRoute(field, startPoint, endPoint) {
  const start = field.nearestFree(startPoint);
  const goal = field.nearestFree(endPoint);
  const startIndex = field.indexOf(start.gx, start.gz);
  const goalIndex = field.indexOf(goal.gx, goal.gz);
  const count = field.width * field.height;
  const gScore = new Float32Array(count);
  gScore.fill(Infinity);
  const cameFrom = new Int32Array(count);
  cameFrom.fill(-1);
  const closed = new Uint8Array(count);
  const heap = new MinHeap();
  gScore[startIndex] = 0;
  heap.push({ index: startIndex, gx: start.gx, gz: start.gz, f: 0 });

  while (heap.size) {
    const current = heap.pop();
    if (!current || closed[current.index]) continue;
    if (current.index === goalIndex) return reconstruct(cameFrom, goalIndex, field);
    closed[current.index] = 1;

    for (const [dx, dz, distance] of DIRECTIONS) {
      const gx = current.gx + dx, gz = current.gz + dz;
      if (!field.valid(gx, gz)) continue;
      const idx = field.indexOf(gx, gz);
      if (closed[idx] || field.blocked[idx]) continue;
      const diagonalGuard = dx && dz && (
        field.blocked[field.indexOf(current.gx + dx, current.gz)] ||
        field.blocked[field.indexOf(current.gx, current.gz + dz)]
      );
      if (diagonalGuard) continue;
      const tentative = gScore[current.index] + distance * field.roadCost[idx];
      if (tentative >= gScore[idx]) continue;
      cameFrom[idx] = current.index;
      gScore[idx] = tentative;
      const heuristic = Math.hypot(goal.gx - gx, goal.gz - gz) * 0.27;
      heap.push({ index: idx, gx, gz, f: tentative + heuristic });
    }
  }
  return [];
}

function perpendicularDistance(point, start, end) {
  return distancePointSegment(point.x, point.z, start.x, start.z, end.x, end.z);
}

function simplifyRdp(points, epsilon = 0.9) {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) { maxDistance = distance; index = i; }
  }
  if (maxDistance > epsilon) {
    const left = simplifyRdp(points.slice(0, index + 1), epsilon);
    const right = simplifyRdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function fallbackRoute(start, end) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const normal = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
  return [
    start.clone(),
    start.clone().lerp(end, 0.24).addScaledVector(normal, Math.min(8, length * 0.18)),
    start.clone().lerp(end, 0.52).addScaledVector(normal, -Math.min(10, length * 0.22)),
    start.clone().lerp(end, 0.78).addScaledVector(normal, Math.min(6, length * 0.12)),
    end.clone()
  ];
}

export function buildCinematicRoute(field, startPoint, endPoint, options = {}) {
  let points = findRoadRoute(field, startPoint, endPoint);
  if (points.length < 4) points = fallbackRoute(startPoint, endPoint);
  points = simplifyRdp(points, 0.72);
  if (points.length < 4) points = fallbackRoute(startPoint, endPoint);

  const totalPlanar = points.slice(1).reduce((sum, point, index) => sum + point.distanceTo(points[index]), 0);
  const cruise = THREE.MathUtils.clamp(1.75 + totalPlanar * 0.012, 2.0, 3.35);
  const startAltitude = options.startAltitude ?? cruise + 0.45;
  const endAltitude = options.endAltitude ?? Math.max(1.6, options.clearance ?? 2.1);
  points.forEach((point, index) => {
    const t = index / Math.max(1, points.length - 1);
    const takeoff = THREE.MathUtils.smoothstep(t, 0, 0.16);
    const landing = 1 - THREE.MathUtils.smoothstep(t, 0.78, 1);
    point.y = THREE.MathUtils.lerp(startAltitude, cruise, takeoff);
    point.y = THREE.MathUtils.lerp(point.y, endAltitude, landing);
    point.y += Math.sin(t * Math.PI * 5) * 0.08;
  });

  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.34);
  const samples = curve.getSpacedPoints(180);
  let length = 0;
  let turns = 0;
  for (let i = 1; i < samples.length; i++) {
    length += samples[i].distanceTo(samples[i - 1]);
    if (i > 1) {
      const a = samples[i - 1].clone().sub(samples[i - 2]).normalize();
      const b = samples[i].clone().sub(samples[i - 1]).normalize();
      if (a.angleTo(b) > 0.055) turns++;
    }
  }
  const duration = THREE.MathUtils.clamp(length / 5.8, 8.5, 15);
  return { curve, points, length, duration, turns, blockedHits: 0 };
}
