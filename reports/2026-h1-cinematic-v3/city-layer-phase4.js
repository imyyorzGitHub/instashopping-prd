import * as THREE from "three";
import { createMacauCity } from "./city.js";
import { createHeroLandmarks } from "./hero-assets.js";
import { createFlightController } from "./flight-system.js";
import { applyReadableNightLighting } from "./city-lighting-patch.js";

const canvas = document.getElementById("city-layer");
const attribution = document.getElementById("osm-attribution");
const landmarkNav = document.getElementById("landmark-nav");
const landmarkTitle = document.getElementById("landmark-title");
const landmarkButtons = document.getElementById("landmark-buttons");
const phaseLabel = document.getElementById("phase-label");
const phaseValue = document.getElementById("phase-value");
const flightHud = {
  root: document.getElementById("route-progress"),
  route: document.getElementById("route-name"),
  status: document.getElementById("route-status"),
  progress: document.getElementById("route-progress-fill")
};

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
let flightController = null;
let overviewTransition = null;
let currentTarget = new THREE.Vector3(4, 0, 12);
let wasVisible = false;

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function overviewPose(elapsed, progress = 1) {
  const eased = 1 - Math.pow(1 - progress, 3);
  return {
    position: new THREE.Vector3(
      -20 + eased * 20 + Math.sin(elapsed * 0.11) * 1.2,
      112 - eased * 39,
      142 - eased * 34
    ),
    target: new THREE.Vector3(4, 0, 12)
  };
}

function setNavigationState(id) {
  landmarkButtons.querySelectorAll("button").forEach(button => {
    button.classList.toggle("is-active", button.dataset.landmark === id);
    button.disabled = Boolean(flightController?.active);
  });
}

function returnOverview() {
  if (!ready || flightController?.active) return;
  activeLandmark = null;
  flightController?.resetOverview();
  overviewTransition = {
    startedAt: performance.now(),
    fromPosition: camera.position.clone(),
    fromTarget: currentTarget.clone()
  };
  landmarkTitle.textContent = "澳门城市概览";
  setNavigationState("overview");
  phaseLabel.textContent = "MACAU NIGHT OVERVIEW";
  phaseValue.textContent = "SELECT A LANDMARK";
}

function flyToLandmark(id) {
  if (!flightController || flightController.active) return;
  const landmark = landmarks.find(item => item.id === id);
  if (!landmark || !flightController.flyTo(id)) return;
  activeLandmark = landmark;
  overviewTransition = null;
  landmarkTitle.textContent = `航行中 · ${landmark.label}`;
  setNavigationState(id);
  phaseLabel.textContent = "STREET FLIGHT";
  phaseValue.textContent = landmark.label;
}

function buildLandmarkNavigator() {
  landmarkButtons.textContent = "";
  const entries = [{ id: "overview", label: "城市概览" }, ...landmarks];
  entries.forEach((entry, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.landmark = entry.id;
    button.textContent = entry.label;
    button.addEventListener("click", () => entry.id === "overview" ? returnOverview() : flyToLandmark(entry.id));
    landmarkButtons.appendChild(button);
    button.title = entry.id === "overview" ? "0 · 返回城市概览" : `${index} · 飞往${entry.label}`;
  });
  setNavigationState("overview");
}

async function startCityBuild() {
  try {
    const [group, cityData] = await Promise.all([
      createMacauCity(),
      fetch("./city-data.json", { cache: "no-cache" }).then(response => {
        if (!response.ok) throw new Error(`city-data.json ${response.status}`);
        return response.json();
      })
    ]);
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
    flightController = await createFlightController({ scene, camera, city, landmarks, cityData, hud: flightHud });
    ready = true;
    window.__h1V3CityMeta = city.userData.meta;
    window.__h1V3LightingRig = lightingRig;
    window.__h1V3Landmarks = landmarks.map(item => ({ id: item.id, label: item.label, position: item.position.toArray() }));
    window.__h1V3FocusLandmark = flyToLandmark;
    window.__h1V3ReturnOverview = returnOverview;

    buildLandmarkNavigator();
    attribution.textContent = `© OpenStreetMap contributors · ODbL · ${city.userData.meta.counts.buildings.toLocaleString()} buildings`;
  } catch (error) {
    console.error("Macau city or flight system load failed", error);
    canvas.style.display = "none";
    attribution.textContent = "澳门城市或航线系统装载失败";
    attribution.style.color = "#ff9f8b";
  }
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
  if (!ready || window.__h1V3State?.phase !== "arrival" || flightController?.active) return;
  if (event.key === "0") returnOverview();
  const index = Number(event.key) - 1;
  if (index >= 0 && index < landmarks.length) flyToLandmark(landmarks[index].id);
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
    if (wasVisible) {
      flightController?.resetOverview();
      activeLandmark = null;
      overviewTransition = null;
      flightHud.root.classList.remove("is-visible");
      setNavigationState("overview");
    }
    wasVisible = false;
    arrivalStarted = 0;
    return;
  }
  wasVisible = true;

  if (!arrivalStarted) arrivalStarted = performance.now();
  const now = performance.now();
  const elapsed = clock.getElapsedTime();
  city.position.y = -4 + Math.sin(elapsed * 0.25) * 0.12;

  const flightControlsCamera = state.phase === "arrival" && flightController?.update(now);
  if (flightControlsCamera) {
    currentTarget.copy(flightController.currentTarget);
    landmarkTitle.textContent = `航行中 · ${activeLandmark?.label || "澳门"}`;
  } else if (activeLandmark && state.phase === "arrival") {
    currentTarget.copy(flightController.currentTarget);
    landmarkTitle.textContent = activeLandmark.label;
    phaseLabel.textContent = "LANDMARK ARRIVAL";
    phaseValue.textContent = activeLandmark.label;
    setNavigationState(activeLandmark.id);
  } else {
    const arrivalT = Math.min(1, (now - arrivalStarted) / 4300);
    const pose = overviewPose(elapsed, arrivalT);
    if (overviewTransition) {
      const t = smoothstep((now - overviewTransition.startedAt) / 1500);
      camera.position.lerpVectors(overviewTransition.fromPosition, pose.position, t);
      currentTarget.lerpVectors(overviewTransition.fromTarget, pose.target, t);
      if (t >= 1) overviewTransition = null;
    } else {
      camera.position.copy(pose.position);
      currentTarget.copy(pose.target);
    }
    camera.lookAt(currentTarget);
  }

  if (lightingRig?.districtLights) {
    lightingRig.districtLights.forEach((light, index) => {
      const base = light.userData.baseIntensity || light.intensity;
      light.intensity = base * (1 + Math.sin(elapsed * (0.42 + index * 0.06) + index) * 0.035);
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
