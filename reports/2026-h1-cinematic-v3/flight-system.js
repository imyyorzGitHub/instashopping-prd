import * as THREE from "three";
import { buildNavigationField, buildCinematicRoute } from "./route-planner.js";

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function createAircraft() {
  const craft = new THREE.Group();
  craft.name = "street-flight-craft";

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.82, 5),
    new THREE.MeshStandardMaterial({ color: 0xb9c8dc, emissive: 0x375879, emissiveIntensity: 0.42, metalness: 0.74, roughness: 0.28 })
  );
  body.rotation.x = -Math.PI / 2;
  craft.add(body);

  const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x283851, emissive: 0x172b48, emissiveIntensity: 0.55, metalness: 0.62, roughness: 0.32 });
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.035, 0.26), wingMaterial);
  wing.position.z = 0.08;
  craft.add(wing);

  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x70dfff, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const x of [-0.35, 0.35]) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6), glowMaterial);
    light.position.set(x, 0, 0.18);
    craft.add(light);
  }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff986d, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  tail.position.z = 0.42;
  craft.add(tail);
  craft.scale.setScalar(0.82);
  craft.visible = false;
  return craft;
}

function createRouteLine(curve) {
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(160));
  const material = new THREE.LineBasicMaterial({ color: 0x75d7ff, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false });
  return new THREE.Line(geometry, material);
}

export async function createFlightController({ scene, camera, city, landmarks, cityData, hud }) {
  const field = buildNavigationField(cityData, landmarks);
  const craft = createAircraft();
  city.add(craft);

  const overviewLocal = new THREE.Vector3(-6, 4.6, 54);
  let currentLocal = overviewLocal.clone();
  let currentTarget = new THREE.Vector3(4, 0, 12);
  let flight = null;
  let routeLine = null;
  let routeSerial = 0;
  const audit = [];
  const debugEnabled = new URLSearchParams(location.search).get("debugRoute") === "1";

  function landmarkPose(landmark) {
    city.updateWorldMatrix(true, false);
    const targetLocal = landmark.position.clone();
    targetLocal.y += landmark.lookHeight;
    const cameraLocal = landmark.position.clone().add(landmark.cameraOffset);
    return {
      target: city.localToWorld(targetLocal),
      camera: city.localToWorld(cameraLocal)
    };
  }

  function updateHud(label, progress, status) {
    if (!hud) return;
    hud.root.classList.toggle("is-visible", Boolean(status));
    hud.route.textContent = label || "";
    hud.status.textContent = status || "";
    hud.progress.style.transform = `scaleX(${THREE.MathUtils.clamp(progress || 0, 0, 1)})`;
  }

  function removeRouteLine() {
    if (!routeLine) return;
    city.remove(routeLine);
    routeLine.geometry.dispose();
    routeLine.material.dispose();
    routeLine = null;
  }

  function flyTo(id) {
    const landmark = landmarks.find(item => item.id === id);
    if (!landmark || flight) return false;
    const route = buildCinematicRoute(field, currentLocal, landmark.position, {
      startAltitude: Math.max(2.2, currentLocal.y),
      endAltitude: Math.max(1.7, landmark.clearance * 0.54),
      clearance: landmark.clearance
    });
    routeSerial += 1;
    flight = {
      serial: routeSerial,
      landmark,
      route,
      startedAt: performance.now(),
      cameraStart: camera.position.clone(),
      targetStart: currentTarget.clone(),
      lastTangent: new THREE.Vector3(0, 0, -1),
      bank: 0
    };
    craft.visible = true;
    if (debugEnabled) {
      removeRouteLine();
      routeLine = createRouteLine(route.curve);
      city.add(routeLine);
    }
    updateHud(`飞往 ${landmark.label}`, 0, `${route.duration.toFixed(1)} 秒 · ${Math.max(3, route.turns)} 次方向变化`);
    return true;
  }

  function cancel() {
    flight = null;
    craft.visible = false;
    removeRouteLine();
    updateHud("", 0, "");
  }

  function update(now) {
    if (!flight) return false;
    const { landmark, route, startedAt } = flight;
    const raw = THREE.MathUtils.clamp((now - startedAt) / (route.duration * 1000), 0, 1);
    const travelT = easeInOut(raw);
    const localPosition = route.curve.getPointAt(travelT);
    const tangent = route.curve.getTangentAt(Math.min(0.999, travelT + 0.002)).normalize();
    const future = route.curve.getTangentAt(Math.min(0.999, travelT + 0.026)).normalize();
    const turn = new THREE.Vector3().crossVectors(tangent, future).y;
    flight.bank = THREE.MathUtils.lerp(flight.bank, THREE.MathUtils.clamp(-turn * 5.8, -0.48, 0.48), 0.085);

    craft.position.copy(localPosition);
    const heading = Math.atan2(tangent.x, tangent.z);
    craft.rotation.set(0, heading, flight.bank);

    city.updateWorldMatrix(true, false);
    const worldPosition = city.localToWorld(localPosition.clone());
    const worldForwardPoint = city.localToWorld(localPosition.clone().addScaledVector(tangent, 4.8));
    const worldForward = worldForwardPoint.sub(worldPosition).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const worldRight = new THREE.Vector3().crossVectors(worldForward, worldUp).normalize();

    const chaseDistance = THREE.MathUtils.lerp(3.3, 2.45, THREE.MathUtils.smoothstep(raw, 0.62, 0.9));
    const chaseHeight = THREE.MathUtils.lerp(1.15, 0.82, THREE.MathUtils.smoothstep(raw, 0.62, 0.9));
    const cameraGoal = worldPosition.clone()
      .addScaledVector(worldForward, -chaseDistance)
      .addScaledVector(worldUp, chaseHeight)
      .addScaledVector(worldRight, flight.bank * 0.72);
    const lookGoal = worldPosition.clone()
      .addScaledVector(worldForward, 5.7)
      .addScaledVector(worldUp, 0.3);

    const settle = THREE.MathUtils.smoothstep(raw, 0.88, 1);
    if (settle > 0) {
      const pose = landmarkPose(landmark);
      cameraGoal.lerp(pose.camera, settle);
      lookGoal.lerp(pose.target, settle);
      craft.scale.setScalar(0.82 * (1 - settle));
    } else {
      craft.scale.setScalar(0.82);
    }

    camera.position.lerp(cameraGoal, 0.13);
    currentTarget.lerp(lookGoal, 0.15);
    camera.lookAt(currentTarget);
    updateHud(`飞往 ${landmark.label}`, raw, raw < 0.88 ? "沿真实道路安全走廊飞行" : "进入地标停靠构图");

    if (raw >= 1) {
      const pose = landmarkPose(landmark);
      camera.position.copy(pose.camera);
      currentTarget.copy(pose.target);
      camera.lookAt(currentTarget);
      currentLocal = landmark.position.clone();
      currentLocal.y = Math.max(1.8, landmark.clearance * 0.54);
      craft.visible = false;
      removeRouteLine();
      audit.push({
        serial: flight.serial,
        id: landmark.id,
        label: landmark.label,
        length: Number(route.length.toFixed(2)),
        duration: Number(route.duration.toFixed(2)),
        turns: Math.max(3, route.turns),
        blockedHits: route.blockedHits
      });
      flight = null;
      updateHud(landmark.label, 1, "已抵达 · 可选择下一站");
      window.__h1V3FlightAudit = audit.slice();
    }
    return true;
  }

  function resetOverview() {
    cancel();
    currentLocal.copy(overviewLocal);
    currentTarget.set(4, 0, 12);
  }

  window.__h1V3FlightAudit = audit;
  return { flyTo, update, cancel, resetOverview, get active() { return Boolean(flight); }, get currentTarget() { return currentTarget; } };
}
