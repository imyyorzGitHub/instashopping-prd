import * as THREE from "three";
import { mergeGeometries } from "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/utils/BufferGeometryUtils.js";

const PALETTES = {
  residential: { wall: 0x111827, window: 0xffd39a, emissive: 0.38 },
  commercial:  { wall: 0x101a2d, window: 0x78d8ff, emissive: 0.58 },
  hotel:       { wall: 0x21142d, window: 0xff96db, emissive: 0.84 },
  public:      { wall: 0x122321, window: 0x8dffd1, emissive: 0.5 },
  industrial:  { wall: 0x20242c, window: 0xffbd68, emissive: 0.28 }
};

function shapeFrom(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => index ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  return shape;
}

function seeded(index) {
  const x = Math.sin(index * 91.73 + 17.31) * 43758.5453;
  return x - Math.floor(x);
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

function pointSegmentDistance(px, pz, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const denominator = dx * dx + dz * dz || 1;
  const t = THREE.MathUtils.clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / denominator, 0, 1);
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

function polygonDistanceToPoint(polygon, x, z) {
  if (pointInPolygon(x, z, polygon)) return 0;
  let nearest = Infinity;
  for (let index = 0; index < polygon.length; index++) {
    nearest = Math.min(nearest, pointSegmentDistance(x, z, polygon[index], polygon[(index + 1) % polygon.length]));
  }
  return nearest;
}

function prepareHeroZones(heroZones, meta) {
  if (!heroZones?.length) return [];
  const [centerLat, centerLon] = meta.center;
  const scale = meta.scaleMetersPerUnit || 55;
  return heroZones.map((zone, index) => ({
    id: zone.id || `hero-${index}`,
    x: (zone.lon - centerLon) * 111320 * Math.cos(THREE.MathUtils.degToRad(centerLat)) / scale,
    z: -(zone.lat - centerLat) * 110540 / scale,
    coreRadius: Math.max(0.2, zone.coreRadius || 1),
    contextRadius: Math.max(zone.coreRadius || 1, zone.contextRadius || (zone.coreRadius || 1) * 1.8)
  }));
}

function nearestHeroZone(building, zones) {
  let nearest = null;
  for (const zone of zones) {
    const distance = polygonDistanceToPoint(building.p, zone.x, zone.z);
    if (!nearest || distance < nearest.distance) nearest = { zone, distance };
  }
  return nearest;
}

function createWindowTexture(hex, seedOffset) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#05070d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const c = new THREE.Color(hex);
  for (let y = 5; y < 252; y += 10) {
    for (let x = 5; x < 124; x += 10) {
      const noise = seeded(x * 19 + y * 29 + seedOffset * 71);
      ctx.fillStyle = noise > 0.44
        ? `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${0.34 + noise * 0.58})`
        : "rgba(4,6,12,.93)";
      ctx.fillRect(x, y, 4, 6);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 9);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

function createUrbanLand(data) {
  const cell = 1.15;
  const occupied = new Set();
  const mark = (x, z, radius = 0) => {
    const gx = Math.floor(x / cell);
    const gz = Math.floor(z / cell);
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) occupied.add(`${gx + dx},${gz + dz}`);
    }
  };
  data.buildings.forEach(building => building.p.forEach(([x, z]) => mark(x, z, 1)));
  data.roads.forEach(road => road.p.forEach(([x, z]) => mark(x, z, road.b ? 2 : 1)));
  const expanded = new Set(occupied);
  for (const key of occupied) {
    const [gx, gz] = key.split(",").map(Number);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) expanded.add(`${gx + dx},${gz + dz}`);
    }
  }
  const positions = [];
  const indices = [];
  let vertex = 0;
  for (const key of expanded) {
    const [gx, gz] = key.split(",").map(Number);
    const x = gx * cell;
    const z = gz * cell;
    positions.push(x, -0.16, z, x + cell, -0.16, z, x + cell, -0.16, z + cell, x, -0.16, z + cell);
    indices.push(vertex, vertex + 2, vertex + 1, vertex, vertex + 3, vertex + 2);
    vertex += 4;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x080d18, roughness: 0.92, metalness: 0.04 }));
}

function segmentGeometry(items, heightFor) {
  const vertices = [];
  for (const item of items) {
    const y = heightFor(item);
    for (let index = 1; index < item.p.length; index++) {
      const a = item.p[index - 1];
      const b = item.p[index];
      vertices.push(a[0], y, a[1], b[0], y, b[1]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

function emptyKindBuckets() {
  return Object.fromEntries(Object.keys(PALETTES).map(kind => [kind, []]));
}

export async function createMacauCity({ heroZones = [] } = {}) {
  const response = await fetch("./city-data.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`city-data.json ${response.status}`);
  const data = await response.json();
  const preparedZones = prepareHeroZones(heroZones, data.meta);

  const root = new THREE.Group();
  root.name = "macau-osm-city";

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(430, 370),
    new THREE.MeshPhysicalMaterial({ color: 0x010713, roughness: 0.18, metalness: 0.72, transparent: true, opacity: 0.99, clearcoat: 0.25 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.22;
  root.add(water);
  root.add(createUrbanLand(data));

  const roadStyles = {
    major: { keys: new Set(["motorway", "trunk", "primary"]), color: 0xffbd78, opacity: 0.9 },
    secondary: { keys: new Set(["secondary", "tertiary"]), color: 0x86d4ff, opacity: 0.56 },
    local: { keys: null, color: 0x425e85, opacity: 0.24 }
  };
  for (const style of Object.values(roadStyles)) {
    const items = data.roads.filter(road => style.keys ? style.keys.has(road.k) : !roadStyles.major.keys.has(road.k) && !roadStyles.secondary.keys.has(road.k));
    if (!items.length) continue;
    root.add(new THREE.LineSegments(
      segmentGeometry(items, road => road.b ? 0.32 : 0.035),
      new THREE.LineBasicMaterial({ color: style.color, transparent: true, opacity: style.opacity, blending: THREE.AdditiveBlending, depthWrite: false })
    ));
  }

  if (data.coasts.length) {
    root.add(new THREE.LineSegments(
      segmentGeometry(data.coasts.map(p => ({ p })), () => 0.025),
      new THREE.LineBasicMaterial({ color: 0x5fe4ff, transparent: true, opacity: 0.43, blending: THREE.AdditiveBlending, depthWrite: false })
    ));
  }

  const waterGeometries = [];
  for (const polygon of data.waters) {
    if (polygon.length < 3) continue;
    const geometry = new THREE.ShapeGeometry(shapeFrom(polygon));
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -0.12, 0);
    geometry.clearGroups();
    waterGeometries.push(geometry);
  }
  if (waterGeometries.length) {
    root.add(new THREE.Mesh(
      mergeGeometries(waterGeometries, false),
      new THREE.MeshBasicMaterial({ color: 0x061631, transparent: true, opacity: 0.76, side: THREE.DoubleSide })
    ));
    waterGeometries.forEach(geometry => geometry.dispose());
  }

  const byKind = emptyKindBuckets();
  const contextByZone = Object.fromEntries(preparedZones.map(zone => [zone.id, emptyKindBuckets()]));
  const contextCounts = Object.fromEntries(preparedZones.map(zone => [zone.id, 0]));
  const beaconPositions = [];
  const memory = navigator.deviceMemory || 8;
  const maxBuildings = memory <= 4 ? 1700 : memory <= 6 ? 2300 : 3000;
  let removedBuildings = 0;

  data.buildings.slice(0, maxBuildings).forEach((building, index) => {
    const nearest = nearestHeroZone(building, preparedZones);
    if (nearest && nearest.distance <= nearest.zone.coreRadius) {
      removedBuildings++;
      return;
    }

    const kind = PALETTES[building.k] ? building.k : "residential";
    const height = Math.max(0.18, building.h * 0.18);
    const geometry = new THREE.ExtrudeGeometry(shapeFrom(building.p), { depth: height, bevelEnabled: false, curveSegments: 1, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0.015, 0);
    geometry.clearGroups();

    if (nearest && nearest.distance <= nearest.zone.contextRadius) {
      contextByZone[nearest.zone.id][kind].push(geometry);
      contextCounts[nearest.zone.id]++;
    } else {
      byKind[kind].push(geometry);
    }

    if (height > 1.45 && seeded(index) > 0.8) {
      const centroid = building.p.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]).map(value => value / building.p.length);
      beaconPositions.push(centroid[0], height + 0.12, centroid[1]);
    }
  });

  const textures = {};
  const materialFor = (kind, opacity = 1) => {
    const palette = PALETTES[kind];
    const texture = textures[kind] || (textures[kind] = createWindowTexture(palette.window, kind.length));
    return new THREE.MeshStandardMaterial({
      color: palette.wall,
      map: texture,
      emissiveMap: texture,
      emissive: new THREE.Color(palette.window),
      emissiveIntensity: palette.emissive,
      roughness: 0.64,
      metalness: kind === "hotel" || kind === "commercial" ? 0.34 : 0.13,
      transparent: opacity < 1,
      opacity
    });
  };

  for (const [kind, geometries] of Object.entries(byKind)) {
    if (!geometries.length) continue;
    root.add(new THREE.Mesh(mergeGeometries(geometries, false), materialFor(kind)));
    geometries.forEach(geometry => geometry.dispose());
  }

  const heroContextMeshesByZone = {};
  for (const zone of preparedZones) {
    const meshes = [];
    for (const [kind, geometries] of Object.entries(contextByZone[zone.id])) {
      if (!geometries.length) continue;
      const material = materialFor(kind, 0.82);
      const mesh = new THREE.Mesh(mergeGeometries(geometries, false), material);
      mesh.name = `hero-context-${zone.id}-${kind}`;
      mesh.userData.heroZoneId = zone.id;
      mesh.userData.baseOpacity = material.opacity;
      mesh.userData.baseEmissiveIntensity = material.emissiveIntensity;
      root.add(mesh);
      meshes.push(mesh);
      geometries.forEach(geometry => geometry.dispose());
    }
    heroContextMeshesByZone[zone.id] = meshes;
  }

  if (beaconPositions.length) {
    const beaconGeometry = new THREE.BufferGeometry();
    beaconGeometry.setAttribute("position", new THREE.Float32BufferAttribute(beaconPositions, 3));
    root.add(new THREE.Points(
      beaconGeometry,
      new THREE.PointsMaterial({ color: 0xff4657, size: 0.13, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    ));
  }

  const hemisphere = new THREE.HemisphereLight(0x6f92cf, 0x02040a, 0.78);
  const moon = new THREE.DirectionalLight(0xa4c1ff, 1.12);
  moon.position.set(-55, 95, 40);
  const warmFill = new THREE.DirectionalLight(0xff9470, 0.24);
  warmFill.position.set(70, 28, -45);
  root.add(hemisphere, moon, warmFill);

  root.userData.meta = data.meta;
  root.userData.heroContextMeshesByZone = heroContextMeshesByZone;
  root.userData.heroProtection = {
    removedBuildings,
    contextCounts,
    zones: preparedZones.map(({ id, coreRadius, contextRadius }) => ({ id, coreRadius, contextRadius }))
  };
  return root;
}
