import * as THREE from "three";
import { createMacauCity } from "./city.js";
import { createHeroLandmarks } from "./hero-assets.js";
import { applyReadableNightLighting } from "./city-lighting-patch.js";
import { FIRST_CHAPTER } from "./chapter-config.js";
import { createChapterTransition } from "./chapter-transition.js";

const stage = document.getElementById("stage");
const canvas = document.getElementById("city-layer");
const attribution = document.getElementById("osm-attribution");
const startButton = document.getElementById("chapter-start");
const chapterReplay = document.getElementById("chapter-replay");
const replayOpening = document.getElementById("replay");
const contentRoot = document.getElementById("chapter-content");
const dimLayer = document.getElementById("chapter-dim");
const glowLayer = document.getElementById("chapter-glow");

canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;opacity:0;transition:opacity .7s ease;";

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
const mobile = window.matchMedia("(max-width: 760px)").matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.55));
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
let chapterController = null;
let currentTarget = new THREE.Vector3(4, 0, 12);
const clock = new THREE.Clock();
let elapsed = 0;

function overviewCamera(delta) {
  if (!arrivalStarted) arrivalStarted = performance.now();
  const t = Math.min(1, (performance.now() - arrivalStarted) / 3300);
  const eased = 1 - Math.pow(1 - t, 3);
  const goal = new THREE.Vector3(
    -20 + eased * 20 + Math.sin(elapsed * 0.11) * 0.75,
    112 - eased * 39,
    142 - eased * 34
  );
  camera.position.lerp(goal, 1 - Math.exp(-5.8 * delta));
  currentTarget.lerp(new THREE.Vector3(4, 0, 12), 1 - Math.exp(-6.5 * delta));
  camera.up.set(0, 1, 0);
  camera.lookAt(currentTarget);
  if (Math.abs(camera.fov - 47) > 0.02) {
    camera.fov = THREE.MathUtils.lerp(camera.fov, 47, 1 - Math.exp(-6 * delta));
    camera.updateProjectionMatrix();
  }
}

async function startCityBuild() {
  try {
    const [group, response] = await Promise.all([
      createMacauCity(),
      fetch("./city-data.json", { cache: "no-cache" })
    ]);
    if (!response.ok) throw new Error(`city-data.json ${response.status}`);
    await response.json();

    city = group;
    const heroes = createHeroLandmarks(city.userData.meta);
    city.add(heroes);
    const landmarks = heroes.userData.landmarks;
    city.userData.landmarks = landmarks;

    city.scale.setScalar(1.08);
    city.rotation.y = -0.19;
    city.position.set(-2, -4, 10);
    scene.add(city);

    lightingRig = applyReadableNightLighting({ scene, renderer, city });
    chapterController = createChapterTransition({
      camera,
      renderer,
      city,
      landmarks,
      heroRoot: heroes,
      chapter: FIRST_CHAPTER,
      stage,
      contentRoot,
      dimLayer,
      glowLayer,
      onStateChange: state => {
        document.documentElement.dataset.chapterState = state;
      }
    });

    window.__h1V3ChapterController = chapterController;
    window.__h1V3CityMeta = city.userData.meta;
    window.__h1V3LightingRig = lightingRig;
    ready = true;
    startButton.disabled = false;
    attribution.textContent = `© OpenStreetMap contributors · ODbL · ${city.userData.meta.counts.buildings.toLocaleString()} buildings`;
  } catch (error) {
    console.error("Macau chapter transition load failed", error);
    canvas.style.display = "none";
    attribution.textContent = "澳门章节场景装载失败";
    attribution.style.color = "#ff9f8b";
  }
}

function scheduleCityBuild() {
  if (!window.__h1V3State?.ready) {
    window.setTimeout(scheduleCityBuild, 160);
    return;
  }
  if ("requestIdleCallback" in window) requestIdleCallback(startCityBuild, { timeout: 1200 });
  else window.setTimeout(startCityBuild, 180);
}
scheduleCityBuild();

startButton?.addEventListener("click", () => {
  if (!ready || chapterController?.active || chapterController?.chapterActive) return;
  chapterController.start({ startLook: currentTarget.clone() });
});

chapterReplay?.addEventListener("click", () => {
  if (!ready) return;
  chapterController.reset();
  arrivalStarted = 0;
  currentTarget.set(4, 0, 12);
});

replayOpening?.addEventListener("click", () => {
  chapterController?.reset();
  arrivalStarted = 0;
  currentTarget.set(4, 0, 12);
});

window.addEventListener("keydown", event => {
  if (!ready || window.__h1V3State?.phase !== "arrival") return;
  if (event.key === "1" || event.key === "ArrowRight" || event.code === "Space") {
    if (!chapterController?.chapterActive) {
      event.preventDefault();
      startButton?.click();
    }
  }
  if (event.key.toLowerCase() === "r") chapterReplay?.click();
});

function animate() {
  requestAnimationFrame(animate);
  if (!ready) return;
  const state = window.__h1V3State;
  const visible = state && (state.phase === "arrival" || (state.phase === "warp" && state.warpProgress > 0.69));
  canvas.style.opacity = visible ? "1" : "0";
  attribution.style.opacity = visible && !chapterController?.chapterActive ? "0.58" : "0.24";
  if (!visible) {
    arrivalStarted = 0;
    return;
  }

  const delta = Math.min(0.05, clock.getDelta() || 0.016);
  elapsed += delta;
  const transitioning = chapterController?.update(performance.now());
  if (!transitioning && !chapterController?.chapterActive) overviewCamera(delta);

  if (lightingRig?.districtLights && !chapterController?.active && !chapterController?.chapterActive) {
    lightingRig.districtLights.forEach((light, index) => {
      const base = light.userData.baseIntensity || light.intensity;
      light.intensity = base * (1 + Math.sin(elapsed * (0.42 + index * 0.06) + index) * 0.025);
    });
  }
  renderer.render(scene, camera);
}
animate();

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const small = width <= 760;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.55));
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();
