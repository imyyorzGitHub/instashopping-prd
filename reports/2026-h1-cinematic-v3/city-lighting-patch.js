import * as THREE from "three";

function liftColor(color, minimumLightness, saturationBoost = 1) {
  const hsl = {};
  color.getHSL(hsl);
  color.setHSL(hsl.h, Math.min(1, hsl.s * saturationBoost), Math.max(minimumLightness, hsl.l));
}

function seeded(value) {
  const x = Math.sin(value * 91.731 + 17.31) * 43758.5453;
  return x - Math.floor(x);
}

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(255,246,216,.96)");
  gradient.addColorStop(0.5, "rgba(255,166,82,.44)");
  gradient.addColorStop(1, "rgba(255,105,62,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function polygonCenter(points) {
  const total = points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
  return [total[0] / points.length, total[1] / points.length];
}

function polygonBounds(points) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };
}

function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const [x1, z1] = points[index];
    const [x2, z2] = points[(index + 1) % points.length];
    area += x1 * z2 - x2 * z1;
  }
  return Math.abs(area) * 0.5;
}

function pointCloud(positions, color, size, texture, opacity = 0.9) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    map: texture,
    transparent: true,
    opacity,
    alphaTest: 0.02,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function createReflectionTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "rgba(255,239,194,0)");
  gradient.addColorStop(0.18, "rgba(255,210,137,.24)");
  gradient.addColorStop(0.5, "rgba(255,127,71,.12)");
  gradient.addColorStop(1, "rgba(255,67,104,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 12; i++) {
    const x = 8 + seeded(i + 300) * 48;
    const width = 1 + seeded(i + 400) * 3;
    ctx.fillStyle = `rgba(255,${150 + Math.round(seeded(i + 500) * 80)},110,${0.08 + seeded(i + 600) * 0.12})`;
    ctx.fillRect(x, 18 + seeded(i + 700) * 150, width, 30 + seeded(i + 800) * 80);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

async function installLivingCityLights(city) {
  if (!city || city.getObjectByName("macau-living-lights")) return;
  const response = await fetch("./city-data.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`city-data.json ${response.status}`);
  const data = await response.json();
  const memory = navigator.deviceMemory || 8;
  const pointBudget = memory <= 4 ? 3200 : memory <= 6 ? 4800 : 7600;
  const glowTexture = makeGlowTexture();
  const group = new THREE.Group();
  group.name = "macau-living-lights";
  group.renderOrder = 8;

  const warmWhite = [];
  const amber = [];
  const coral = [];
  const densityByKind = { residential: 2, commercial: 4, hotel: 5, public: 3, industrial: 1 };
  let generatedWindows = 0;

  for (let index = 0; index < data.buildings.length && generatedWindows < pointBudget; index++) {
    const building = data.buildings[index];
    if (!building.p?.length) continue;
    const density = densityByKind[building.k] || 2;
    const activity = seeded(index * 3.17 + building.h * 4.1);
    if (activity < (building.k === "residential" ? 0.18 : 0.08)) continue;
    const count = Math.max(1, Math.min(density, 1 + Math.floor(activity * density)));
    const [cx, cz] = polygonCenter(building.p);
    const bounds = polygonBounds(building.p);
    const height = Math.max(0.28, building.h * 0.18);

    for (let lightIndex = 0; lightIndex < count && generatedWindows < pointBudget; lightIndex++) {
      const seedBase = index * 37 + lightIndex * 11;
      const x = cx + (seeded(seedBase + 1) - 0.5) * Math.min(bounds.width * 0.62, 0.75);
      const z = cz + (seeded(seedBase + 2) - 0.5) * Math.min(bounds.depth * 0.62, 0.75);
      const y = 0.2 + seeded(seedBase + 3) * Math.max(0.12, height * 0.88);
      const palette = building.k === "hotel" ? coral : building.k === "commercial" ? amber : seeded(seedBase + 4) > 0.72 ? amber : warmWhite;
      palette.push(x, y, z);
      generatedWindows++;
    }
  }

  if (warmWhite.length) group.add(pointCloud(warmWhite, 0xffe6ba, 0.19, glowTexture, 0.9));
  if (amber.length) group.add(pointCloud(amber, 0xffad66, 0.21, glowTexture, 0.92));
  if (coral.length) group.add(pointCloud(coral, 0xff6f75, 0.22, glowTexture, 0.86));

  const majorRoads = new Set(["motorway", "trunk", "primary"]);
  const secondaryRoads = new Set(["secondary", "tertiary"]);
  const roadLights = [];
  let generatedRoadLights = 0;
  const roadBudget = memory <= 4 ? 900 : 1700;

  for (let roadIndex = 0; roadIndex < data.roads.length && generatedRoadLights < roadBudget; roadIndex++) {
    const road = data.roads[roadIndex];
    const isMajor = majorRoads.has(road.k);
    const isSecondary = secondaryRoads.has(road.k);
    if (!isMajor && !isSecondary) continue;
    const spacing = isMajor ? 1.15 : 2.05;
    for (let index = 1; index < road.p.length && generatedRoadLights < roadBudget; index++) {
      const [ax, az] = road.p[index - 1];
      const [bx, bz] = road.p[index];
      const dx = bx - ax;
      const dz = bz - az;
      const length = Math.hypot(dx, dz);
      const steps = Math.floor(length / spacing);
      if (!steps) continue;
      const nx = length ? -dz / length : 0;
      const nz = length ? dx / length : 0;
      for (let step = 1; step <= steps && generatedRoadLights < roadBudget; step++) {
        const t = step / (steps + 1);
        const offset = isMajor ? (step % 2 ? 0.12 : -0.12) : 0;
        roadLights.push(ax + dx * t + nx * offset, road.b ? 0.36 : 0.09, az + dz * t + nz * offset);
        generatedRoadLights++;
      }
    }
  }
  if (roadLights.length) group.add(pointCloud(roadLights, 0xffb267, 0.13, glowTexture, 0.78));

  const reflectionTexture = createReflectionTexture();
  const waterCandidates = data.waters
    .filter(points => points.length >= 3)
    .map(points => ({ points, area: polygonArea(points), bounds: polygonBounds(points), center: polygonCenter(points) }))
    .filter(item => item.area > 3)
    .sort((a, b) => b.area - a.area)
    .slice(0, 5);

  for (let index = 0; index < waterCandidates.length; index++) {
    const item = waterCandidates[index];
    const width = THREE.MathUtils.clamp(item.bounds.width * 0.32, 0.8, 3.2);
    const depth = THREE.MathUtils.clamp(item.bounds.depth * 0.58, 3.2, 12);
    const material = new THREE.MeshBasicMaterial({
      map: reflectionTexture,
      color: index % 2 ? 0xff8b62 : 0xffc078,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const reflection = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    reflection.rotation.x = -Math.PI / 2;
    reflection.position.set(item.center[0], -0.085, item.center[1]);
    reflection.name = `water-light-reflection-${index + 1}`;
    group.add(reflection);
  }

  city.add(group);
  city.userData.livingLights = group;
  window.__h1V3LivingCityAudit = {
    installed: true,
    windowLights: generatedWindows,
    roadLights: generatedRoadLights,
    waterReflections: waterCandidates.length,
    palette: "warm-white-amber-coral",
    buildingBodyRemainsDark: true
  };
}

export function applyReadableNightLighting({ scene, renderer, city }) {
  renderer.toneMappingExposure = 1.52;
  scene.fog = new THREE.FogExp2(0x07111f, 0.0047);

  city.traverse(object => {
    if (!object.isMesh || !object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material.color) continue;

      if (material.map && material.emissiveMap === material.map) material.map = null;

      if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
        const currentHex = material.color.getHex();
        const isWater = currentHex === 0x010713 || currentHex === 0x061631;
        const isLand = currentHex === 0x080d18;

        if (isWater) {
          material.color.set(0x0a1b33);
          material.roughness = Math.min(material.roughness ?? 1, 0.34);
          material.metalness = Math.max(material.metalness ?? 0, 0.32);
        } else if (isLand) {
          material.color.set(0x1a2638);
          material.roughness = 0.86;
        } else {
          liftColor(material.color, 0.18, 1.08);
          material.roughness = Math.min(material.roughness ?? 1, 0.7);
          if (material.emissiveMap) material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, 0.82);
        }
      }
      material.needsUpdate = true;
    }
  });

  const ambient = new THREE.AmbientLight(0x6f86ad, 0.48);
  const sky = new THREE.HemisphereLight(0xa8c3ef, 0x3f2030, 1.48);
  const moon = new THREE.DirectionalLight(0xd7e7ff, 2.35);
  moon.position.set(-70, 125, 84);
  const rim = new THREE.DirectionalLight(0x7a8cff, 0.72);
  rim.position.set(84, 42, 118);
  const warmBounce = new THREE.DirectionalLight(0xff9b70, 0.78);
  warmBounce.position.set(80, 32, -58);

  const districtLights = [
    [-30, 18, 18, 0xff9a62, 28],
    [8, 22, 6, 0xff6eb7, 34],
    [34, 18, -22, 0xff9f62, 30],
    [18, 16, 46, 0xffc173, 24]
  ].map(([x, y, z, color, intensity]) => {
    const light = new THREE.PointLight(color, intensity, 92, 1.65);
    light.position.set(x, y, z);
    light.userData.baseIntensity = intensity;
    return light;
  });

  scene.add(ambient, sky, moon, rim, warmBounce, ...districtLights);
  installLivingCityLights(city).catch(error => {
    console.warn("Living city lights failed", error);
    window.__h1V3LivingCityAudit = { installed: false, reason: String(error) };
  });

  return { ambient, sky, moon, rim, warmBounce, districtLights };
}
