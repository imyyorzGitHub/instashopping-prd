import * as THREE from "three";
import { createLandmarkSilhouette } from "./landmark-silhouette.js";

const clamp01 = value => Math.max(0, Math.min(1, value));
const smoothstep = (a, b, value) => {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutQuint = t => 1 - Math.pow(1 - t, 5);

function worldFromLocal(city, vector) {
  city.updateWorldMatrix(true, false);
  return city.localToWorld(vector.clone());
}

export function createChapterTransition({
  camera,
  renderer,
  city,
  landmarks,
  heroRoot,
  chapter,
  stage,
  contentRoot,
  dimLayer,
  glowLayer,
  onStateChange
}) {
  const landmark = landmarks.find(item => item.id === chapter.landmarkId);
  const targetGroup = heroRoot.getObjectByName(chapter.landmarkName);
  if (!landmark || !targetGroup) throw new Error(`Chapter landmark unavailable: ${chapter.landmarkId}`);

  const silhouette = createLandmarkSilhouette(targetGroup, chapter.silhouette);
  let state = "overview";
  let startedAt = 0;
  let durationMs = chapter.duration * 1000;
  let cameraCurve = null;
  let lookCurve = null;
  let startFov = camera.fov;
  let startExposure = renderer.toneMappingExposure;
  const currentLook = new THREE.Vector3();
  const finalCamera = new THREE.Vector3();
  const finalLook = new THREE.Vector3();
  const tmpCamera = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  function setContentProgress(progress) {
    const p = clamp01(progress);
    contentRoot.style.opacity = String(p);
    contentRoot.style.transform = `translate3d(0, ${(1 - p) * 24}px, 0)`;
    dimLayer.style.opacity = String(p * 0.96);
    glowLayer.style.opacity = String(p * 0.9);
    contentRoot.setAttribute("aria-hidden", p > 0.02 ? "false" : "true");
  }

  function buildTracks(startCamera, startLook) {
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const pose = mobile ? chapter.camera.mobile : chapter.camera.desktop;
    const base = landmark.position.clone();
    const endLocal = base.clone().add(new THREE.Vector3(...pose.finalOffset));
    const lookLocal = base.clone().add(new THREE.Vector3(...pose.finalLookOffset));
    const approachLocal = base.clone().add(new THREE.Vector3(...pose.approachOffset));
    finalCamera.copy(worldFromLocal(city, endLocal));
    finalLook.copy(worldFromLocal(city, lookLocal));
    const approach = worldFromLocal(city, approachLocal);

    const c1 = startCamera.clone().lerp(approach, 0.42).add(new THREE.Vector3(0, 3.2, 0));
    const c2 = approach.clone();
    cameraCurve = new THREE.CubicBezierCurve3(startCamera.clone(), c1, c2, finalCamera.clone());

    const l1 = startLook.clone().lerp(finalLook, 0.34).add(new THREE.Vector3(0, 1.4, 0));
    const l2 = finalLook.clone().add(new THREE.Vector3(-2.4, 1.2, 3.2));
    lookCurve = new THREE.CubicBezierCurve3(startLook.clone(), l1, l2, finalLook.clone());
    return pose;
  }

  function start({ startLook }) {
    if (state === "transition") return false;
    silhouette.reset();
    stage.classList.remove("is-chapter-active");
    stage.classList.add("is-chapter-transition");
    setContentProgress(0);
    currentLook.copy(startLook);
    startFov = camera.fov;
    startExposure = renderer.toneMappingExposure;
    const pose = buildTracks(camera.position.clone(), startLook.clone());
    durationMs = chapter.duration * 1000;
    startedAt = performance.now();
    state = "transition";
    onStateChange?.(state);
    window.__h1V3ChapterTransitionAudit = {
      chapter: chapter.id,
      duration: chapter.duration,
      finalFov: pose.finalFov,
      silhouetteStart: 0.66,
      contentStart: 0.72
    };
    return true;
  }

  function update(now) {
    if (state !== "transition") return false;
    const raw = clamp01((now - startedAt) / durationMs);
    const move = easeInOutCubic(raw);
    cameraCurve.getPointAt(move, tmpCamera);
    lookCurve.getPointAt(easeOutQuint(raw), tmpLook);
    camera.position.copy(tmpCamera);
    currentLook.copy(tmpLook);
    camera.lookAt(currentLook);

    const pose = window.matchMedia("(max-width: 760px)").matches ? chapter.camera.mobile : chapter.camera.desktop;
    const speedEnvelope = Math.sin(Math.PI * Math.min(1, raw / 0.82));
    const baseFov = THREE.MathUtils.lerp(startFov, pose.finalFov, smoothstep(0.54, 1, raw));
    const fov = baseFov + speedEnvelope * 8.5;
    if (Math.abs(camera.fov - fov) > 0.025) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const silhouetteProgress = smoothstep(0.66, 0.96, raw);
    const contentProgress = smoothstep(0.72, 1, raw);
    silhouette.setProgress(silhouetteProgress);
    setContentProgress(contentProgress);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(startExposure, 0.92, smoothstep(0.58, 1, raw));

    if (raw >= 1) {
      state = "chapter";
      camera.position.copy(finalCamera);
      currentLook.copy(finalLook);
      camera.lookAt(finalLook);
      camera.fov = pose.finalFov;
      camera.updateProjectionMatrix();
      renderer.toneMappingExposure = 0.92;
      silhouette.setProgress(1);
      setContentProgress(1);
      stage.classList.remove("is-chapter-transition");
      stage.classList.add("is-chapter-active");
      onStateChange?.(state);
    }
    return true;
  }

  function reset() {
    state = "overview";
    silhouette.reset();
    stage.classList.remove("is-chapter-transition", "is-chapter-active");
    setContentProgress(0);
    renderer.toneMappingExposure = 1.52;
    onStateChange?.(state);
  }

  return {
    start,
    update,
    reset,
    get state() { return state; },
    get active() { return state === "transition"; },
    get chapterActive() { return state === "chapter"; },
    get currentLook() { return currentLook; }
  };
}
