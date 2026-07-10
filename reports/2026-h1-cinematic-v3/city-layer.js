import * as THREE from "three";
import { createMacauCity } from "./city.js";
import { createHeroLandmarks } from "./hero-assets.js";
import { applyReadableNightLighting } from "./city-lighting-patch.js";

const canvas = document.getElementById("city-layer");
const attribution = document.getElementById("osm-attribution");
const landmarkNav = document.getElementById("landmark-nav");
const landmarkTitle = document.getElementById("landmark-title");
const landmarkButtons = document.getElementById("landmark-buttons");

canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;opacity:0;transition:opacity .7s ease;";

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030713, 0.0085);
const camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 92, 116);
camera.lookAt(2, 0, 8);

let city = null;
let ready = false;
let arrivalStarted = 0;
let lightingRig = null;
let landmarks = [];
let activeLandmark = null;
let focusStarted = 0;
let focusFromPosition = new THREE.Vector3();
let focusFromTarget = new THREE.Vector3(4, 0, 12);
let currentTarget = new THREE.Vector3(4, 0, 12);

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function landmarkWorldPose(landmark) {
  city.updateWorldMatrix(true, false);
  const targetLocal = landmark.position.clone();
  targetLocal.y += landmark.lookHeight;
  const cameraLocal = landmark.position.clone().add(landmark.cameraOffset);
  return {
    target: city.localToWorld(targetLocal),
    camera: city.localToWorld(cameraLocal)
  };
}

function selectLandmark(id) {
  activeLandmark = id ? landmarks.find(item => item.id === id) || null : null;
  focusStarted = performance.now();
  focusFromPosition.copy(camera.position);
  focusFromTarget.copy(currentTarget);
  landmarkTitle.textContent = activeLandmark ? activeLandmark.label : "澳门城市概览";
  landmarkButtons.querySelectorAll("button").forEach(button => {
    button.classList.toggle("is-active", button.dataset.landmark === (activeLandmark?.id || "overview"));
  });
}

function buildLandmarkNavigator() {
  landmarkButtons.textContent = "";
  const entries = [{ id: "overview", label: "城市概览" }, ...landmarks];
  entries.forEach((entry, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.landmark = entry.id;
    button.textContent = entry.label;
    button.addEventListener("click", () => selectLandmark(entry.id === "overview" ? null : entry.id));
    landmarkButtons.appendChild(button);
    if (index > 0) button.title = `${index} · ${entry.label}`;
  });
  selectLandmark(null);
}

function startCityBuild() {
  createMacauCity().then(group => {
    city = group;
    const heroes = createHeroLandmarks(city.userData.meta);
    city.add(heroes);
    city.userData.landmarks = heroes.userData.landmarks;
    landmarks = city.userData.landmarks;

    city.scale.setScalar(1.08);
    city.rotation.y = -0.19;
    city.position.set(-2, -4, 10);
    scene.add(city);

    lightingRig = applyReadableNightLighting({ scene, renderer, city });
    ready = true;
    window.__h1V3CityMeta = city.userData.meta;
    window.__h1V3LightingRig = lightingRig;
    window.__h1V3Landmarks = landmarks.map(item => ({ id: item.id, label: item.label, position: item.position.toArray() }));
    window.__h1V3FocusLandmark = selectLandmark;

    buildLandmarkNavigator();
    attribution.textContent = `© OpenStreetMap contributors · ODbL · ${city.userData.meta.counts.buildings.toLocaleString()} buildings`;
  }).catch(error => {
    console.error("Macau city load failed", error);
    canvas.style.display = "none";
    attribution.textContent = "澳门城市数据装载失败";
    attribution.style.color = "#ff9f8b";
  });
}

function scheduleCityBuild() {
  if (!window.__h1V3State?.ready) {
    window.setTimeout(scheduleCityBuild, 160);
    return;
  }
  if ("requestIdleCallback" in window) requestIdleCallback(startCityBuild, { timeout: 1400 });
  else window.setTimeout(startCityBuild, 240);
}
scheduleCityBuild();

window.addEventListener("keydown", event => {
  if (!ready || window.__h1V3State?.phase !== "arrival") return;
  if (event.key === "0") selectLandmark(null);
  const index = Number(event.key) - 1;
  if (index >= 0 && index < landmarks.length) selectLandmark(landmarks[index].id);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  if (!ready) return;

  const state = window.__h1V3State;
  const visible = state && (state.phase === "arrival" || (state.phase === "warp" && state.warpProgress > 0.69));
  canvas.style.opacity = visible ? "1" : "0";
  attribution.style.opacity = visible ? "0.68" : "0";
  landmarkNav.classList.toggle("is-visible", state?.phase === "arrival");

  if (!visible) {
    arrivalStarted = 0;
    return;
  }

  if (!arrivalStarted) arrivalStarted = performance.now();
  const elapsed = clock.getElapsedTime();
  city.position.y = -4 + Math.sin(elapsed * 0.25) * 0.12;

  if (activeLandmark && state.phase === "arrival") {
    const pose = landmarkWorldPose(activeLandmark);
    const t = smoothstep((performance.now() - focusStarted) / 1700);
    camera.position.lerpVectors(focusFromPosition, pose.camera, t);
    currentTarget.lerpVectors(focusFromTarget, pose.target, t);
    camera.lookAt(currentTarget);
  } else {
    const t = Math.min(1, (performance.now() - arrivalStarted) / 4300);
    const eased = 1 - Math.pow(1 - t, 3);
    const overviewPosition = new THREE.Vector3(
      -20 + eased * 20 + Math.sin(elapsed * 0.11) * 1.2,
      112 - eased * 39,
      142 - eased * 34
    );
    const overviewTarget = new THREE.Vector3(4, 0, 12);
    if (focusStarted) {
      const returnT = smoothstep((performance.now() - focusStarted) / 1500);
      camera.position.lerpVectors(focusFromPosition, overviewPosition, returnT);
      currentTarget.lerpVectors(focusFromTarget, overviewTarget, returnT);
    } else {
      camera.position.copy(overviewPosition);
      currentTarget.copy(overviewTarget);
    }
    camera.lookAt(currentTarget);
  }

  if (lightingRig?.districtLights) {
    lightingRig.districtLights.forEach((light, index) => {
      const base = light.userData.baseIntensity || light.intensity;
      light.intensity = base * (0.985 + Math.sin(elapsed * (0.42 + index * 0.06) + index) * 0.015);
    });
  }

  renderer.render(scene, camera);
}
animate();

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();
