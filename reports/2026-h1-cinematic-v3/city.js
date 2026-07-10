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

export async function createMacauCity() {
  const response = await fetch("./city-data.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`city-data.json ${response.status}`);
  const data = await response.json();

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

  const byKind = Object.fromEntries(Object.keys(PALETTES).map(kind => [kind, []]));
  const beaconPositions = [];
  const memory = navigator.deviceMemory || 8;
  const maxBuildings = memory <= 4 ? 1700 : memory <= 6 ? 2300 : 3000;
  data.buildings.slice(0, maxBuildings).forEach((building, index) => {
    const kind = PALETTES[building.k] ? building.k : "residential";
    const height = Math.max(0.18, building.h * 0.18);
    const geometry = new THREE.ExtrudeGeometry(shapeFrom(building.p), { depth: height, bevelEnabled: false, curveSegments: 1, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0.015, 0);
    geometry.clearGroups();
    byKind[kind].push(geometry);

    if (height > 1.45 && seeded(index) > 0.8) {
      const centroid = building.p.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]).map(value => value / building.p.length);
      beaconPositions.push(centroid[0], height + 0.12, centroid[1]);
    }
  });

  for (const [kind, geometries] of Object.entries(byKind)) {
    if (!geometries.length) continue;
    const palette = PALETTES[kind];
    const texture = createWindowTexture(palette.window, kind.length);
    const material = new THREE.MeshStandardMaterial({
      color: palette.wall,
      map: texture,
      emissiveMap: texture,
      emissive: new THREE.Color(palette.window),
      emissiveIntensity: palette.emissive,
      roughness: 0.64,
      metalness: kind === "hotel" || kind === "commercial" ? 0.34 : 0.13
    });
    root.add(new THREE.Mesh(mergeGeometries(geometries, false), material));
    geometries.forEach(geometry => geometry.dispose());
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
  return root;
}
