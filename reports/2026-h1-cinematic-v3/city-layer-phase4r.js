import * as THREE from "three";
import { createMacauCity } from "./city.js";
import { createHeroLandmarks } from "./hero-assets.js";
import { createTowerLisboaSlice } from "./tower-lisboa-slice.js";
import { prepareCollisionSafeSliceData } from "./phase4r-safety.js";
import { applyReadableNightLighting } from "./city-lighting-patch.js";

const stage = document.getElementById("stage");
const canvas = document.getElementById("city-layer");
const attribution = document.getElementById("osm-attribution");
const startButton = document.getElementById("slice-start");
const replaySliceButton = document.getElementById("slice-replay");
const futureButtons = document.querySelectorAll("[data-future-route]");
const routeHud = document.getElementById("route-progress");
const routeName = document.getElementById("route-name");
const routeStatus = document.getElementById("route-status");
const routeFill = document.getElementById("route-progress-fill");
const routeBeat = document.getElementById("route-beat");
const replayOpening = document.getElementById("replay");

canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;opacity:0;transition:opacity .7s ease;";

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 0.05, 900);
camera.position.set(0, 92, 116);
camera.lookAt(2, 0, 8);

let city = null;
let ready = false;
let arrivalStarted = 0;
let lightingRig = null;
let slice = null;
let currentTarget = new THREE.Vector3(4, 0, 12);
const clock = new THREE.Clock();

function overviewCamera(elapsed) {
  if (!arrivalStarted) arrivalStarted = performance.now();
  const t = Math.min(1, (performance.now() - arrivalStarted) / 4300);
  const eased = 1 - Math.pow(1 - t, 3);
  const goal = new THREE.Vector3(
    -20 + eased * 20 + Math.sin(elapsed * 0.11) * 1.2,
    112 - eased * 39,
    142 - eased * 34
  );
  camera.position.lerp(goal, 0.16);
  currentTarget.lerp(new THREE.Vector3(4, 0, 12), 0.12);
  camera.up.set(0, 1, 0);
  camera.lookAt(currentTarget);
  camera.fov = THREE.MathUtils.lerp(camera.fov, 47, 0.08);
  camera.updateProjectionMatrix();
}

async function startCityBuild() {
  try {
    const [group, response] = await Promise.all([
      createMacauCity(),
      fetch("./city-data.json", { cache: "no-cache" })
    ]);
    if (!response.ok) throw new Error(`city-data.json ${response.status}`);
    const cityData = await response.json();

    city = group;
    const heroes = createHeroLandmarks(city.userData.meta);
    city.add(heroes);
    const landmarks = heroes.userData.landmarks;
    city.userData.landmarks = landmarks;

    city.scale.setScalar(1.08);
    city.rotation.y = -0.19;
    city.position.set(-2, -4, 10);
    scene.add(city);

    const safeSlice = prepareCollisionSafeSliceData(cityData, landmarks);
    window.__h1V3VerticalSlicePreflight = safeSlice.audit;
    if (safeSlice.audit.collisionSamples > 0) {
      console.warn("Phase 4R preflight retained collision samples", safeSlice.audit);
    }

    lightingRig = applyReadableNightLighting({ scene, renderer, city });
    slice = createTowerLisboaSlice({
      scene,
      camera,
      city,
      landmarks,
      cityData: safeSlice.data,
      hud: { root: routeHud, route: routeName, status: routeStatus, progress: routeFill, beat: routeBeat }
    });

    window.__h1V3VerticalSlice = slice;
    window.__h1V3CityMeta = city.userData.meta;
    window.__h1V3LightingRig = lightingRig;
    ready = true;
    startButton.disabled = false;
    replaySliceButton.disabled = false;
    attribution.textContent = `© OpenStreetMap contributors · ODbL · ${city.userData.meta.counts.buildings.toLocaleString()} buildings`;
  } catch (error) {
    console.error("Macau vertical slice load failed", error);
    canvas.style.display = "none";
    attribution.textContent = "澳门街道垂直切片装载失败";
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

startButton?.addEventListener("click", () => {
  if (!ready || slice?.active) return;
  arrivalStarted = 0;
  slice.start();
  startButton.classList.add("is-active");
});

replaySliceButton?.addEventListener("click", () => {
  if (!ready) return;
  slice.cancel();
  window.setTimeout(() => slice.start(), 80);
  startButton.classList.add("is-active");
});

futureButtons.forEach(button => {
  button.disabled = true;
  button.title = "待澳门塔 → 新葡京垂直切片通过后开放";
});

replayOpening?.addEventListener("click", () => {
  slice?.cancel();
  stage?.classList.remove("is-slice-flying");
  startButton?.classList.remove("is-active");
  arrivalStarted = 0;
});

window.addEventListener("keydown", event => {
  if (!ready || window.__h1V3State?.phase !== "arrival") return;
  if (event.key === "1") startButton?.click();
  if (event.key.toLowerCase() === "r") replaySliceButton?.click();
});

function animate() {
  requestAnimationFrame(animate);
  if (!ready) return;
  const state = window.__h1V3State;
  const visible = state && (state.phase === "arrival" || (state.phase === "warp" && state.warpProgress > 0.69));
  canvas.style.opacity = visible ? "1" : "0";
  attribution.style.opacity = visible ? "0.68" : "0";
  if (!visible) {
    arrivalStarted = 0;
    stage?.classList.remove("is-slice-flying");
    return;
  }

  const elapsed = clock.getElapsedTime();
  city.position.y = -4 + Math.sin(elapsed * 0.25) * 0.12;
  const flying = slice?.update(performance.now(), elapsed);
  stage?.classList.toggle("is-slice-flying", Boolean(slice?.active));
  if (!flying && !slice?.completed) overviewCamera(elapsed);

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
