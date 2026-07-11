import * as THREE from "three";
import { mergeGeometries } from "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/utils/BufferGeometryUtils.js";

const MAX_ATTEMPTS = 220;
const RETRY_MS = 80;
const JOIN_TOLERANCE = 1.15;
const MIN_POLYGON_AREA = 5;
const MAX_POLYGONS = 10;

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function disposeMesh(mesh) {
  mesh.geometry?.dispose?.();
  materialList(mesh.material).forEach(material => material?.dispose?.());
}

function findMacauScene() {
  const rig = window.__h1V3LightingRig;
  return rig?.ambient?.parent || rig?.sky?.parent || null;
}

function pointDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function cleanSegment(segment) {
  const cleaned = [];
  for (const point of segment || []) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const next = [Number(point[0]), Number(point[1])];
    if (!Number.isFinite(next[0]) || !Number.isFinite(next[1])) continue;
    if (!cleaned.length || pointDistance(cleaned[cleaned.length - 1], next) > 0.02) cleaned.push(next);
  }
  return cleaned;
}

function mergePair(a, b, tolerance = JOIN_TOLERANCE) {
  const a0 = a[0];
  const a1 = a[a.length - 1];
  const b0 = b[0];
  const b1 = b[b.length - 1];

  if (pointDistance(a1, b0) <= tolerance) return [...a, ...b.slice(1)];
  if (pointDistance(a1, b1) <= tolerance) return [...a, ...b.slice(0, -1).reverse()];
  if (pointDistance(a0, b1) <= tolerance) return [...b, ...a.slice(1)];
  if (pointDistance(a0, b0) <= tolerance) return [...b.slice().reverse(), ...a.slice(1)];
  return null;
}

function stitchSegments(segments) {
  const chains = segments.map(cleanSegment).filter(segment => segment.length >= 2);
  let changed = true;

  while (changed) {
    changed = false;
    outer: for (let i = 0; i < chains.length; i++) {
      for (let j = i + 1; j < chains.length; j++) {
        const merged = mergePair(chains[i], chains[j]);
        if (!merged) continue;
        chains[i] = merged;
        chains.splice(j, 1);
        changed = true;
        break outer;
      }
    }
  }

  return chains;
}

function perpendicularDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  if (Math.abs(dx) + Math.abs(dz) < 1e-6) return pointDistance(point, start);
  const t = THREE.MathUtils.clamp(((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(point[0] - (start[0] + dx * t), point[1] - (start[1] + dz * t));
}

function simplifyRdp(points, tolerance = 0.16) {
  if (points.length <= 3) return points.slice();
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]];
  const left = simplifyRdp(points.slice(0, index + 1), tolerance);
  const right = simplifyRdp(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area * 0.5;
}

function polygonCentroid(points) {
  let x = 0;
  let z = 0;
  for (const point of points) {
    x += point[0];
    z += point[1];
  }
  return [x / points.length, z / points.length];
}

function pointInPolygon(point, polygon) {
  let inside = false;
  const [x, z] = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const crosses = ((zi > z) !== (zj > z)) && x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-6) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function buildingCentroids(buildings) {
  return (buildings || []).slice(0, 1400).map(building => polygonCentroid(building.p || [])).filter(point => point.every(Number.isFinite));
}

function scorePolygon(points, centroids) {
  let contained = 0;
  for (let i = 0; i < centroids.length; i += 8) {
    if (pointInPolygon(centroids[i], points)) contained++;
  }
  return contained;
}

function coastPolygons(data) {
  const centroids = buildingCentroids(data.buildings);
  const candidates = stitchSegments(data.coasts || []).map(chain => {
    const simplified = simplifyRdp(chain, 0.14);
    const points = simplified.length >= 3 ? simplified : chain;
    if (points.length < 3) return null;
    if (pointDistance(points[0], points[points.length - 1]) <= JOIN_TOLERANCE * 2.2) points.pop();
    const area = Math.abs(polygonArea(points));
    if (area < MIN_POLYGON_AREA) return null;
    return { points, area, score: scorePolygon(points, centroids) };
  }).filter(Boolean);

  const useful = candidates
    .filter(candidate => candidate.score > 0 || candidate.area > 22)
    .sort((a, b) => (b.score * 1000 + b.area) - (a.score * 1000 + a.area))
    .slice(0, MAX_POLYGONS);

  return useful.map(candidate => candidate.points);
}

function shapeFrom(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => index ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  return shape;
}

function createCoastLand(polygons) {
  const geometries = [];
  for (const polygon of polygons) {
    if (polygon.length < 3) continue;
    const geometry = new THREE.ShapeGeometry(shapeFrom(polygon), 12);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -0.155, 0);
    geometry.clearGroups();
    geometries.push(geometry);
  }
  if (!geometries.length) return null;

  const merged = mergeGeometries(geometries, false);
  geometries.forEach(geometry => geometry.dispose());
  const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({
    color: 0x120a13,
    emissive: 0x050205,
    emissiveIntensity: 0.018,
    roughness: 0.96,
    metalness: 0.015,
    side: THREE.DoubleSide
  }));
  mesh.name = "macau-coast-land";
  mesh.renderOrder = -4;
  mesh.userData.sunsetRole = "land-outline";
  return mesh;
}

function isLegacyUrbanLand(object) {
  if (!object?.isMesh || object.name === "macau-coast-land") return false;
  if (object.geometry?.type === "PlaneGeometry") {
    const { width = 0, height = 0 } = object.geometry.parameters || {};
    return width >= 300 && height >= 300;
  }
  if (object.geometry?.type !== "BufferGeometry") return false;
  if (!object.material?.isMeshStandardMaterial || object.material?.emissiveMap) return false;
  object.geometry.computeBoundingBox();
  const box = object.geometry.boundingBox;
  if (!box) return false;
  const size = new THREE.Vector3();
  box.getSize(size);
  const vertices = object.geometry.attributes?.position?.count || 0;
  return vertices > 800 && size.y < 0.05 && size.x > 20 && size.z > 20;
}

function removeLegacyGround(city) {
  const removed = [];
  for (const object of [...city.children]) {
    if (!isLegacyUrbanLand(object)) continue;
    city.remove(object);
    removed.push({ name: object.name || object.geometry?.type || "mesh", geometry: object.geometry?.type || null });
    disposeMesh(object);
  }
  return removed;
}

async function applyMacauOutline() {
  const scene = findMacauScene();
  const city = scene?.getObjectByName?.("macau-osm-city");
  if (!city) return false;

  const response = await fetch("./city-data.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`city-data.json ${response.status}`);
  const data = await response.json();
  const polygons = coastPolygons(data);
  const land = createCoastLand(polygons);
  if (!land) throw new Error("No usable coastline polygons were generated");

  const removed = removeLegacyGround(city);
  city.add(land);

  window.__h1V3MacauOutlineAudit = {
    applied: true,
    source: "osm-coastline-stitched",
    rawCoastSegments: data.coasts?.length || 0,
    generatedPolygons: polygons.length,
    polygonAreas: polygons.map(points => Number(Math.abs(polygonArea(points)).toFixed(2))),
    removedLegacyGround: removed,
    preservedWaterPolygons: data.waters?.length || 0,
    preservedCoastline: city.children.some(object => object.isLineSegments),
    outerCanvasTransparent: true,
    blockGridGround: false
  };

  return true;
}

let attempts = 0;
async function waitForCity() {
  attempts += 1;
  try {
    if (await applyMacauOutline()) return;
  } catch (error) {
    console.error("Macau outline generation failed", error);
    window.__h1V3MacauOutlineAudit = { applied: false, reason: error.message, attempts };
    return;
  }

  if (attempts >= MAX_ATTEMPTS) {
    window.__h1V3MacauOutlineAudit = { applied: false, reason: "city-scene-not-ready", attempts };
    return;
  }
  window.setTimeout(waitForCity, RETRY_MS);
}

waitForCity();
