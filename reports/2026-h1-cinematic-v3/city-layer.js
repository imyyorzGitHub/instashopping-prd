import * as THREE from "three";
import { createMacauCity } from "./city.js";
import { applyReadableNightLighting } from "./city-lighting-patch.js";

const canvas = document.getElementById("city-layer");
const attribution = document.getElementById("osm-attribution");
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

function startCityBuild() {
  createMacauCity().then(group => {
    city = group;
    city.scale.setScalar(1.08);
    city.rotation.y = -0.19;
    city.position.set(-2, -4, 10);
    scene.add(city);
    lightingRig = applyReadableNightLighting({ scene, renderer, city });
    ready = true;
    window.__h1V3CityMeta = city.userData.meta;
    window.__h1V3LightingRig = lightingRig;
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

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  if (!ready) return;
  const state = window.__h1V3State;
  const visible = state && (state.phase === "arrival" || (state.phase === "warp" && state.warpProgress > 0.69));
  canvas.style.opacity = visible ? "1" : "0";
  attribution.style.opacity = visible ? "0.68" : "0";
  if (!visible) {
    arrivalStarted = 0;
    return;
  }
  if (!arrivalStarted) arrivalStarted = performance.now();
  const elapsed = clock.getElapsedTime();
  const t = Math.min(1, (performance.now() - arrivalStarted) / 4300);
  const eased = 1 - Math.pow(1 - t, 3);
  camera.position.set(
    -20 + eased * 20 + Math.sin(elapsed * 0.11) * 1.2,
    112 - eased * 39,
    142 - eased * 34
  );
  camera.lookAt(4, 0, 12);
  city.position.y = -4 + Math.sin(elapsed * 0.25) * 0.12;
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
