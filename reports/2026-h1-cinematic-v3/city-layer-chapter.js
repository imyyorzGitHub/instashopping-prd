import * as THREE from "three";
import { createMacauCity } from "./city.js";
import { createHeroLandmarks } from "./hero-assets.js";
import { applyReadableNightLighting } from "./city-lighting-patch.js";
import { CHAPTERS } from "./chapter-config.js";
import { createChapterSequence } from "./chapter-transition.js";

const stage = document.getElementById("stage");
const canvas = document.getElementById("city-layer");
const attribution = document.getElementById("osm-attribution");
const startButton = document.getElementById("chapter-start");
const overviewButton = document.getElementById("chapter-overview");
const prevButton = document.getElementById("chapter-prev");
const nextButton = document.getElementById("chapter-next");
const replayOpening = document.getElementById("replay");
const contentRoot = document.getElementById("chapter-content");
const kickerRoot = document.getElementById("chapter-kicker-text");
const titleRoot = document.getElementById("chapter-title");
const bodyRoot = document.getElementById("chapter-body");
const dataRoot = document.getElementById("chapter-data");
const countRoot = document.getElementById("chapter-count");
const dimLayer = document.getElementById("chapter-dim");
const glowLayer = document.getElementById("chapter-glow");
const wipeLayer = document.getElementById("chapter-wipe");

const HERO_OSM_ZONES = [
  { id: "macau-tower", lat: 22.179767, lon: 113.536794, coreRadius: 1.45, contextRadius: 3.2 },
  { id: "grand-lisboa", lat: 22.190863, lon: 113.543327, coreRadius: 2.15, contextRadius: 4.4 },
  { id: "st-pauls", lat: 22.19758, lon: 113.54095, coreRadius: 1.55, contextRadius: 3.0 },
  { id: "cotai", lat: 22.140556, lon: 113.563056, coreRadius: 4.9, contextRadius: 7.4 },
  { id: "morpheus", lat: 22.15, lon: 113.5667, coreRadius: 2.65, contextRadius: 4.8 },
  { id: "airport", lat: 22.150444, lon: 113.591509, coreRadius: 6.5, contextRadius: 9.5 }
];

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
let desktopFrameShift = 0;
let lastViewOffsetX = null;
let lastViewWidth = 0;
let lastViewHeight = 0;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function renderChapter(index, chapter) {
  kickerRoot.textContent = `${chapter.index} · ${chapter.kicker}`;
  titleRoot.textContent = chapter.title;
  bodyRoot.textContent = chapter.body;
  countRoot.textContent = `${String(index + 1).padStart(2, "0")} / ${String(CHAPTERS.length).padStart(2, "0")}`;
  dataRoot.className = `chapter-data is-${chapter.layout} ${chapter.items.length === 5 ? "is-five" : ""}`;
  dataRoot.innerHTML = chapter.items.map(item => {
    const cls = chapter.layout === "metrics" ? "chapter-metric" : "chapter-row";
    return `<article class="${cls}"><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.note || "")}</small></article>`;
  }).join("");
  prevButton.disabled = index === 0;
  nextButton.textContent = index === CHAPTERS.length - 1 ? "完成 · 返回城市" : "下一章";
  stage.dataset.chapter = chapter.id;
}

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

function updateDesktopPresentationFrame(delta) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const desktopChapterMode = width > 760 && Boolean(chapterController?.active || chapterController?.chapterActive);
  const targetShift = desktopChapterMode ? 0.08 : 0;
  const alpha = 1 - Math.exp(-7.5 * Math.max(0.001, delta));
  desktopFrameShift = THREE.MathUtils.lerp(desktopFrameShift, targetShift, alpha);
  if (Math.abs(desktopFrameShift - targetShift) < 0.0003) desktopFrameShift = targetShift;

  const offsetX = Math.round(-width * desktopFrameShift);
  if (offsetX === lastViewOffsetX && width === lastViewWidth && height === lastViewHeight) return;

  if (offsetX === 0) camera.clearViewOffset();
  else camera.setViewOffset(width, height, offsetX, 0, width, height);

  lastViewOffsetX = offsetX;
  lastViewWidth = width;
  lastViewHeight = height;
  const rect = contentRoot?.getBoundingClientRect();
  window.__h1V3DesktopCompositionAudit = {
    desktop: width > 760,
    chapterMode: desktopChapterMode,
    sceneShiftFraction: desktopFrameShift,
    viewOffsetX: offsetX,
    viewport: { width, height },
    content: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height, centerY: rect.top + rect.height / 2 } : null
  };
}

function returnToOverview() {
  if (!ready) return;
  chapterController?.reset();
  arrivalStarted = 0;
  currentTarget.set(4, 0, 12);
}

async function startCityBuild() {
  try {
    const group = await createMacauCity({ heroZones: HERO_OSM_ZONES });
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
    chapterController = createChapterSequence({
      camera,
      renderer,
      city,
      landmarks,
      heroRoot: heroes,
      chapters: CHAPTERS,
      stage,
      contentRoot,
      dimLayer,
      glowLayer,
      wipeLayer,
      onChapterChange: renderChapter,
      onStateChange: (state, index) => {
        document.documentElement.dataset.chapterState = state;
        if (index >= 0) document.documentElement.dataset.chapterIndex = String(index + 1);
      }
    });

    window.__h1V3ChapterController = chapterController;
    window.__h1V3CityMeta = city.userData.meta;
    window.__h1V3LightingRig = lightingRig;
    window.__h1V3HeroProtection = city.userData.heroProtection;
    ready = true;
    startButton.disabled = false;
    attribution.textContent = `© OpenStreetMap contributors · ODbL · ${city.userData.meta.counts.buildings.toLocaleString()} buildings`;
  } catch (error) {
    console.error("Macau chapter sequence load failed", error);
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
  chapterController.start({ index: 0, startLook: currentTarget.clone() });
});

prevButton?.addEventListener("click", () => chapterController?.previous());
nextButton?.addEventListener("click", () => {
  if (!chapterController?.chapterActive) return;
  if (chapterController.currentIndex >= CHAPTERS.length - 1) returnToOverview();
  else chapterController.next();
});
overviewButton?.addEventListener("click", returnToOverview);
replayOpening?.addEventListener("click", returnToOverview);

window.addEventListener("keydown", event => {
  if (!ready || window.__h1V3State?.phase !== "arrival") return;
  const active = chapterController?.chapterActive;
  if (!active && (event.key === "1" || event.key === "ArrowRight" || event.code === "Space")) {
    event.preventDefault();
    startButton?.click();
    return;
  }
  if (!active || chapterController.active) return;
  if (event.key === "ArrowRight" || event.code === "Space") {
    event.preventDefault();
    nextButton?.click();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    prevButton?.click();
  } else if (event.key === "Escape" || event.key.toLowerCase() === "r") {
    returnToOverview();
  }
});

function animate() {
  requestAnimationFrame(animate);
  if (!ready) return;
  const globalState = window.__h1V3State;
  const visible = globalState && (globalState.phase === "arrival" || (globalState.phase === "warp" && globalState.warpProgress > 0.69));
  canvas.style.opacity = visible ? "1" : "0";
  attribution.style.opacity = visible && !chapterController?.chapterActive ? "0.58" : "0.18";
  if (!visible) {
    arrivalStarted = 0;
    return;
  }

  const delta = Math.min(0.05, clock.getDelta() || 0.016);
  elapsed += delta;
  const transitioning = chapterController?.update(performance.now());
  if (!transitioning && !chapterController?.chapterActive) overviewCamera(delta);
  updateDesktopPresentationFrame(delta);

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
  lastViewOffsetX = null;
  lastViewWidth = 0;
  lastViewHeight = 0;
  updateDesktopPresentationFrame(1);
}
window.addEventListener("resize", resize);
resize();