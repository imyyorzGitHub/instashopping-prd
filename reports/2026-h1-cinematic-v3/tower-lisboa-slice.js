import * as THREE from "three";

const DURATION = 14.2;
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

const BEATS = [
  [0.00, "澳门塔旁离场"],
  [0.09, "俯冲进入街谷"],
  [0.23, "左侧贴墙掠过"],
  [0.39, "路口预判急转"],
  [0.54, "低空窄缝通过"],
  [0.70, "前景遮挡目标"],
  [0.83, "新葡京完整揭示"],
  [0.92, "减速进入章节构图"]
];

const SPEED_MAP = [
  [0.00, 0.00], [0.06, 0.025], [0.14, 0.11], [0.27, 0.29],
  [0.43, 0.49], [0.60, 0.69], [0.76, 0.85], [0.88, 0.94], [1.00, 1.00]
];

function piecewise(keys, t) {
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [aT, aV] = keys[i - 1];
      const [bT, bV] = keys[i];
      const u = THREE.MathUtils.smoothstep(t, aT, bT);
      return THREE.MathUtils.lerp(aV, bV, u);
    }
  }
  return keys[keys.length - 1][1];
}

function closestPointOnSegment(px, pz, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const denom = dx * dx + dz * dz || 1;
  const t = THREE.MathUtils.clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / denom, 0, 1);
  return { x: a[0] + dx * t, z: a[1] + dz * t, d: Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t)) };
}

function nearestRoadPoint(cityData, point, maxDistance = 4.5) {
  let best = null;
  for (const road of cityData.roads) {
    for (let i = 1; i < road.p.length; i++) {
      const candidate = closestPointOnSegment(point.x, point.z, road.p[i - 1], road.p[i]);
      if ((!best || candidate.d < best.d) && candidate.d <= maxDistance) best = candidate;
    }
  }
  return best;
}

function authoredTrack(cityData) {
  const points = GUIDE.map(([x, y, z], index) => {
    const point = new THREE.Vector3(x, y, z);
    if (index > 0 && index < GUIDE.length - 1) {
      const road = nearestRoadPoint(cityData, point);
      if (road) {
        point.x = THREE.MathUtils.lerp(point.x, road.x, 0.72);
        point.z = THREE.MathUtils.lerp(point.z, road.z, 0.72);
      }
    }
    return point;
  });
  return new THREE.CatmullRomCurve3(points, false, "centripetal", 0.26);
}

function polygonBounds(polygon) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of polygon) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ };
}

function pointInPolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const cross = ((zi > z) !== (zj > z)) && x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-6) + xi;
    if (cross) inside = !inside;
  }
  return inside;
}

function distanceToPolygon(x, z, polygon) {
  if (pointInPolygon(x, z, polygon)) return 0;
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    best = Math.min(best, closestPointOnSegment(x, z, polygon[i], polygon[(i + 1) % polygon.length]).d);
  }
  return best;
}

function corridorBuildings(cityData) {
  return cityData.buildings
    .map(building => ({ polygon: building.p, bounds: polygonBounds(building.p), height: building.h * 0.18 }))
    .filter(({ bounds }) => bounds.maxX > -34 && bounds.minX < -13 && bounds.maxZ > -43 && bounds.minZ < -12);
}

function nearestBuildingDistance(point, buildings) {
  let best = Infinity;
  for (const building of buildings) {
    const b = building.bounds;
    if (point.x < b.minX - 1 || point.x > b.maxX + 1 || point.z < b.minZ - 1 || point.z > b.maxZ + 1) continue;
    best = Math.min(best, distanceToPolygon(point.x, point.z, building.polygon));
  }
  return best;
}

function createAircraft() {
  const craft = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.ConeGeometry(0.075, 0.36, 5),
    new THREE.MeshStandardMaterial({ color: 0xb9cadc, emissive: 0x315b7a, emissiveIntensity: 0.55, metalness: 0.76, roughness: 0.24 })
  );
  hull.rotation.x = Math.PI / 2;
  craft.add(hull);
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.018, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x22334b, emissive: 0x102b4b, emissiveIntensity: 0.72, metalness: 0.62, roughness: 0.28 })
  );
  wing.position.z = 0.04;
  craft.add(wing);
  const glow = new THREE.MeshBasicMaterial({ color: 0x6ce7ff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95, depthWrite: false });
  [-0.16, 0.16].forEach(x => {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), glow);
    lamp.position.set(x, 0, 0.07);
    craft.add(lamp);
  });
  const engine = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8f62, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9, depthWrite: false }));
  engine.position.z = -0.18;
  craft.add(engine);
  craft.visible = false;
  return craft;
}

function ribbonGeometry(curve, width, yOffset, segments = 260) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(Math.min(0.9999, t + 0.0001)).setY(0).normalize();
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x);
    const leftP = p.clone().addScaledVector(right, -width / 2); leftP.y = yOffset;
    const rightP = p.clone().addScaledVector(right, width / 2); rightP.y = yOffset;
    positions.push(leftP.x, leftP.y, leftP.z, rightP.x, rightP.y, rightP.z);
    uvs.push(0, t * 24, 1, t * 24);
    if (i < segments) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCorridor(curve) {
  const group = new THREE.Group();
  group.name = "tower-lisboa-street-corridor";
  const road = new THREE.Mesh(
    ribbonGeometry(curve, 0.56, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x151a24, roughness: 0.84, metalness: 0.12, emissive: 0x07101d, emissiveIntensity: 0.22 })
  );
  group.add(road);

  const curbMat = new THREE.MeshStandardMaterial({ color: 0x6c7480, roughness: 0.78, metalness: 0.12, emissive: 0x252d39, emissiveIntensity: 0.18 });
  const curbGeo = new THREE.BoxGeometry(0.08, 0.06, 0.34);
  const lampPoleGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.42, 6);
  const lampHeadGeo = new THREE.SphereGeometry(0.035, 8, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x36465a, metalness: 0.66, roughness: 0.35 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd29a, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.92, depthWrite: false });
  const curbs = new THREE.InstancedMesh(curbGeo, curbMat, 120);
  const poles = new THREE.InstancedMesh(lampPoleGeo, poleMat, 70);
  const heads = new THREE.InstancedMesh(lampHeadGeo, lampMat, 70);
  const dummy = new THREE.Object3D();
  let ci = 0, li = 0;
  for (let i = 4; i < 118; i++) {
    const t = i / 122;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).setY(0).normalize();
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x);
    const side = i % 2 ? 1 : -1;
    dummy.position.copy(p).addScaledVector(right, side * 0.39); dummy.position.y = 0.045;
    dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0); dummy.updateMatrix();
    curbs.setMatrixAt(ci++, dummy.matrix);
    if (i % 3 === 0 && li < 70) {
      dummy.position.copy(p).addScaledVector(right, side * 0.5); dummy.position.y = 0.22; dummy.updateMatrix(); poles.setMatrixAt(li, dummy.matrix);
      dummy.position.y = 0.45; dummy.updateMatrix(); heads.setMatrixAt(li, dummy.matrix); li++;
    }
  }
  curbs.count = ci; poles.count = li; heads.count = li;
  group.add(curbs, poles, heads);

  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd978, transparent: true, opacity: 0.82 });
  const dashGeo = new THREE.BoxGeometry(0.025, 0.012, 0.18);
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, 72);
  let di = 0;
  for (let i = 3; i < 74; i++) {
    const t = i / 76;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).setY(0).normalize();
    dummy.position.copy(p); dummy.position.y = 0.024;
    dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0); dummy.updateMatrix(); dashes.setMatrixAt(di++, dummy.matrix);
  }
  dashes.count = di; group.add(dashes);

  const facadeMatA = new THREE.MeshStandardMaterial({ color: 0x2a3143, emissive: 0x10182a, emissiveIntensity: 0.5, roughness: 0.68 });
  const facadeMatB = new THREE.MeshStandardMaterial({ color: 0x402b3c, emissive: 0x501a43, emissiveIntensity: 0.38, roughness: 0.62 });
  [
    [0.25, -1, 0.52, 1.55, facadeMatA], [0.34, 1, 0.46, 1.15, facadeMatB],
    [0.51, -1, 0.44, 1.35, facadeMatB], [0.63, 1, 0.5, 1.65, facadeMatA],
    [0.73, -1, 0.58, 1.9, facadeMatA]
  ].forEach(([t, side, width, height, mat]) => {
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).setY(0).normalize();
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.12), mat);
    wall.position.copy(p).addScaledVector(right, side * 0.66); wall.position.y = height / 2;
    wall.rotation.y = Math.atan2(tangent.x, tangent.z);
    group.add(wall);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.66, 0.18), new THREE.MeshBasicMaterial({ color: side > 0 ? 0xff5fbb : 0x62dfff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    sign.position.copy(wall.position).addScaledVector(right, -side * 0.065); sign.position.y = Math.min(height * 0.72, 0.95); sign.rotation.y = wall.rotation.y + (side > 0 ? Math.PI : 0); group.add(sign);
  });

  const gateT = 0.70;
  const gateP = curve.getPointAt(gateT);
  const gateTan = curve.getTangentAt(gateT).setY(0).normalize();
  const gate = new THREE.Group();
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x303746, emissive: 0x18243b, emissiveIntensity: 0.55, metalness: 0.45, roughness: 0.38 });
  [-0.46, 0.46].forEach(x => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.1), gateMat); post.position.set(x, 0.48, 0); gate.add(post);
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.10, 0.12), gateMat); top.position.y = 0.92; gate.add(top);
  gate.position.copy(gateP); gate.rotation.y = Math.atan2(gateTan.x, gateTan.z); group.add(gate);

  const carMat = new THREE.MeshStandardMaterial({ color: 0x304b6f, emissive: 0x132745, emissiveIntensity: 0.45, metalness: 0.58, roughness: 0.3 });
  const cars = [0.18, 0.43, 0.60].map((t, index) => {
    const car = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.36), carMat.clone());
    car.userData.offset = t; car.userData.speed = 0.018 + index * 0.004; group.add(car); return car;
  });
  group.userData.update = elapsed => {
    cars.forEach((car, index) => {
      const t = (car.userData.offset - elapsed * car.userData.speed + 4) % 1;
      const p = curve.getPointAt(t); const tangent = curve.getTangentAt(t).setY(0).normalize();
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x);
      car.position.copy(p).addScaledVector(right, index % 2 ? 0.13 : -0.13); car.position.y = 0.065;
      car.rotation.y = Math.atan2(-tangent.x, -tangent.z);
    });
  };
  return group;
}

function beatLabel(progress) {
  let label = BEATS[0][1];
  for (const [threshold, next] of BEATS) if (progress >= threshold) label = next;
  return label;
}

function landmarkPose(city, landmark) {
  city.updateWorldMatrix(true, false);
  const targetLocal = landmark.position.clone(); targetLocal.y += landmark.lookHeight;
  const cameraLocal = landmark.position.clone().add(landmark.cameraOffset);
  return { target: city.localToWorld(targetLocal), camera: city.localToWorld(cameraLocal) };
}

export function createTowerLisboaSlice({ scene, camera, city, landmarks, cityData, hud }) {
  const tower = landmarks.find(item => item.id === "macau-tower");
  const lisboa = landmarks.find(item => item.id === "grand-lisboa");
  if (!tower || !lisboa) throw new Error("Tower/Lisboa landmarks unavailable");

  const curve = authoredTrack(cityData);
  const corridor = createCorridor(curve);
  city.add(corridor);
  const craft = createAircraft(); city.add(craft);
  const buildings = corridorBuildings(cityData);

  const cameraTarget = new THREE.Vector3();
  const cameraGoal = new THREE.Vector3();
  const localCamera = new THREE.Vector3();
  let active = false;
  let startedAt = 0;
  let completed = false;
  let lastTravel = 0;
  let bank = 0;
  let nearPasses = 0;
  let previousNear = false;

  function updateHud(progress, status) {
    if (!hud) return;
    hud.root.classList.toggle("is-visible", active || completed);
    hud.route.textContent = "澳门塔 → 新葡京";
    hud.status.textContent = status;
    hud.progress.style.transform = `scaleX(${THREE.MathUtils.clamp(progress, 0, 1)})`;
    if (hud.beat) hud.beat.textContent = beatLabel(progress);
  }

  function start() {
    active = true; completed = false; startedAt = performance.now(); lastTravel = 0; nearPasses = 0; previousNear = false;
    craft.visible = true;
    camera.fov = 66; camera.updateProjectionMatrix();
    const start = curve.getPointAt(0);
    const startTangent = curve.getTangentAt(0.01).normalize();
    const startRight = new THREE.Vector3(startTangent.z, 0, -startTangent.x).normalize();
    craft.position.copy(start);
    city.updateWorldMatrix(true, false);
    const startCameraLocal = start.clone().addScaledVector(startTangent, -0.55).addScaledVector(startRight, -0.08).add(new THREE.Vector3(0, 0.18, 0));
    camera.position.copy(city.localToWorld(startCameraLocal));
    cameraTarget.copy(city.localToWorld(curve.getPointAt(0.025).add(new THREE.Vector3(0, 0.08, 0))));
    camera.up.set(0, 1, 0);
    camera.lookAt(cameraTarget);
    updateHud(0, `${DURATION.toFixed(1)} 秒导演式低空航线`);
    return true;
  }

  function cancel() {
    active = false; craft.visible = false; completed = false; camera.fov = 47; camera.updateProjectionMatrix();
    if (hud) hud.root.classList.remove("is-visible");
  }

  function update(now, elapsed) {
    corridor.userData.update?.(elapsed);
    if (!active) return false;
    const raw = THREE.MathUtils.clamp((now - startedAt) / (DURATION * 1000), 0, 1);
    const travel = piecewise(SPEED_MAP, raw);
    const p = curve.getPointAt(travel);
    const tangent = curve.getTangentAt(Math.min(0.999, travel + 0.002)).normalize();
    const future = curve.getTangentAt(Math.min(0.999, travel + 0.045)).normalize();
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const turn = new THREE.Vector3().crossVectors(tangent, future).y;
    bank = THREE.MathUtils.lerp(bank, THREE.MathUtils.clamp(-turn * 7.5, -0.58, 0.58), 0.12);

    craft.position.copy(p);
    craft.rotation.set(0, Math.atan2(tangent.x, tangent.z), bank);

    const speed = Math.max(0, travel - lastTravel) * 60;
    lastTravel = travel;
    const peak = THREE.MathUtils.smoothstep(raw, 0.08, 0.30) * (1 - THREE.MathUtils.smoothstep(raw, 0.78, 0.96));
    const fovGoal = THREE.MathUtils.lerp(66, 81, peak) + Math.min(3, speed * 0.28);
    camera.fov = THREE.MathUtils.lerp(camera.fov, fovGoal, 0.1); camera.updateProjectionMatrix();

    const shoulderKeys = [[0, -0.08], [0.22, -0.20], [0.40, 0.15], [0.56, -0.12], [0.75, 0.20], [1, 0.0]];
    const shoulder = piecewise(shoulderKeys, raw);
    const back = THREE.MathUtils.lerp(0.42, 0.24, peak);
    const height = THREE.MathUtils.lerp(0.16, 0.095, peak);
    localCamera.copy(p).addScaledVector(tangent, -back).addScaledVector(right, shoulder).add(new THREE.Vector3(0, height, 0));

    const clearance = nearestBuildingDistance(localCamera, buildings);
    const near = clearance < 0.34;
    if (near && !previousNear) nearPasses++;
    previousNear = near;
    if (clearance < 0.10) {
      localCamera.lerp(p.clone().add(new THREE.Vector3(0, 0.16, 0)), 0.62);
      localCamera.y += 0.08;
    }

    city.updateWorldMatrix(true, false);
    cameraGoal.copy(city.localToWorld(localCamera.clone()));
    const anticipate = THREE.MathUtils.lerp(0.026, 0.052, Math.abs(turn) * 4);
    const lookLocal = curve.getPointAt(Math.min(0.999, travel + anticipate)).add(new THREE.Vector3(0, 0.08, 0));
    const lookWorld = city.localToWorld(lookLocal);

    const reveal = THREE.MathUtils.smoothstep(raw, 0.83, 0.96);
    if (reveal > 0) {
      const pose = landmarkPose(city, lisboa);
      cameraGoal.lerp(pose.camera, reveal);
      lookWorld.lerp(pose.target, reveal);
      craft.scale.setScalar(1 - reveal * 0.92);
    } else craft.scale.setScalar(1);

    camera.position.lerp(cameraGoal, raw < 0.1 ? 0.18 : 0.24);
    cameraTarget.lerp(lookWorld, 0.22);
    camera.up.set(Math.sin(bank) * 0.08, 1, 0).normalize();
    camera.lookAt(cameraTarget);
    updateHud(raw, raw < 0.83 ? "低空街谷穿梭" : "目标揭示与停靠");

    if (raw >= 1) {
      active = false; completed = true; craft.visible = false;
      const pose = landmarkPose(city, lisboa);
      camera.position.copy(pose.camera); cameraTarget.copy(pose.target); camera.lookAt(cameraTarget);
      camera.fov = 52; camera.updateProjectionMatrix();
      updateHud(1, "已抵达新葡京 · 垂直切片完成");
      const samples = curve.getSpacedPoints(220);
      const lowAltitudeRatio = samples.filter(point => point.y <= 0.45).length / samples.length;
      window.__h1V3VerticalSliceAudit = {
        route: "macau-tower-to-grand-lisboa",
        duration: DURATION,
        lowAltitudeRatio: Number(lowAltitudeRatio.toFixed(3)),
        nearPasses,
        beats: BEATS.map(item => item[1]),
        targetRevealStart: 0.83
      };
    }
    return true;
  }

  return { start, cancel, update, get active() { return active; }, get completed() { return completed; } };
}
