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

function applyCameraPose(camera, target, rollDegrees = 0) {
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  if (rollDegrees) camera.rotateZ(THREE.MathUtils.degToRad(rollDegrees));
}

function projectedBounds(object, camera) {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return null;
  const corners = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z).project(camera));
    }
  }
  const xs = corners.map(point => point.x * 0.5 + 0.5);
  const ys = corners.map(point => -point.y * 0.5 + 0.5);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { left, right, top, bottom, width: right - left, height: bottom - top, centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
}

export function createChapterSequence({
  camera,
  renderer,
  city,
  landmarks,
  heroRoot,
  chapters,
  stage,
  contentRoot,
  dimLayer,
  glowLayer,
  wipeLayer,
  onChapterChange,
  onStateChange
}) {
  const bundles = chapters.map(chapter => {
    const landmark = landmarks.find(item => item.id === chapter.landmarkId);
    const targetGroup = heroRoot.getObjectByName(chapter.landmarkName);
    if (!landmark || !targetGroup) throw new Error(`Chapter landmark unavailable: ${chapter.landmarkId}`);
    const silhouette = createLandmarkSilhouette(targetGroup, chapter.silhouette);
    const contextMeshes = city.userData.heroContextMeshesByZone?.[chapter.landmarkId] || [];
    contextMeshes.forEach(mesh => {
      mesh.material.transparent = true;
      mesh.material.depthWrite = false;
      mesh.userData.baseOpacity ??= mesh.material.opacity;
      mesh.userData.baseEmissiveIntensity ??= mesh.material.emissiveIntensity;
    });
    return { chapter, landmark, targetGroup, silhouette, contextMeshes };
  });

  let state = "overview";
  let activeIndex = -1;
  let pendingIndex = -1;
  let startedAt = 0;
  let durationMs = 0;
  let cutDone = false;
  let entryTracks = null;
  let exitTracks = null;
  let startFov = camera.fov;
  let startExposure = renderer.toneMappingExposure;
  const currentLook = new THREE.Vector3(4, 0, 12);
  const tmpCamera = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  const mobilePose = chapter => window.matchMedia("(max-width: 760px)").matches ? chapter.camera.mobile : chapter.camera.desktop;

  function setContentProgress(progress) {
    const p = clamp01(progress);
    contentRoot.style.opacity = String(p);
    contentRoot.style.transform = `translate3d(0, ${(1 - p) * 20}px, 0)`;
    dimLayer.style.opacity = String(p * 0.96);
    glowLayer.style.opacity = String(p * 0.9);
    contentRoot.setAttribute("aria-hidden", p > 0.02 ? "false" : "true");
  }

  function setWipe(progress, chapter) {
    const p = clamp01(progress);
    wipeLayer.style.opacity = String(p);
    wipeLayer.style.setProperty("--chapter-wipe", chapter?.wipe || "#315d95");
  }

  function setContextProgress(bundle, progress) {
    const p = clamp01(progress);
    const finalOpacity = bundle.chapter.context?.finalOpacity ?? 0.08;
    const finalEmissive = bundle.chapter.context?.finalEmissiveIntensity ?? 0.02;
    bundle.contextMeshes.forEach(mesh => {
      const baseOpacity = mesh.userData.baseOpacity ?? 0.82;
      const baseEmissive = mesh.userData.baseEmissiveIntensity ?? mesh.material.emissiveIntensity;
      mesh.material.opacity = THREE.MathUtils.lerp(baseOpacity, finalOpacity, p);
      mesh.material.emissiveIntensity = THREE.MathUtils.lerp(baseEmissive, finalEmissive, p);
    });
  }

  function resetBundle(bundle) {
    bundle.silhouette.reset();
    setContextProgress(bundle, 0);
  }

  function buildEntryTracks(bundle, startCamera, startLook, hiddenCut = false) {
    const pose = mobilePose(bundle.chapter);
    const base = bundle.landmark.position.clone();
    const finalCamera = worldFromLocal(city, base.clone().add(new THREE.Vector3(...pose.finalOffset)));
    const finalLook = worldFromLocal(city, base.clone().add(new THREE.Vector3(...pose.finalLookOffset)));
    const approach = worldFromLocal(city, base.clone().add(new THREE.Vector3(...pose.approachOffset)));
    const entryStart = hiddenCut
      ? worldFromLocal(city, base.clone().add(new THREE.Vector3(...(pose.entryOffset || pose.approachOffset))))
      : startCamera.clone();
    const entryLook = hiddenCut
      ? worldFromLocal(city, base.clone().add(new THREE.Vector3(0, Math.max(2, pose.finalLookOffset[1] + 1.5), 0)))
      : startLook.clone();
    const c1 = entryStart.clone().lerp(approach, 0.42).add(new THREE.Vector3(0, pose.cameraControlLift ?? 2.5, 0));
    const c2 = approach.clone();
    const cameraCurve = new THREE.CubicBezierCurve3(entryStart, c1, c2, finalCamera);
    const l1 = entryLook.clone().lerp(finalLook, 0.34).add(new THREE.Vector3(0, 1.25, 0));
    const lookControlOffset = pose.lookControlOffset ?? [-1, 1, 2.5];
    const l2 = finalLook.clone().add(new THREE.Vector3(...lookControlOffset));
    const lookCurve = new THREE.CubicBezierCurve3(entryLook, l1, l2, finalLook);
    return { pose, entryStart, entryLook, finalCamera, finalLook, cameraCurve, lookCurve };
  }

  function buildExitTracks(bundle) {
    const pose = mobilePose(bundle.chapter);
    const base = bundle.landmark.position.clone();
    const exitCamera = worldFromLocal(city, base.clone().add(new THREE.Vector3(...(pose.exitOffset || [0, 10, 3]))));
    const exitLook = worldFromLocal(city, base.clone().add(new THREE.Vector3(...(pose.exitLookOffset || [0, 5, 0]))));
    const c1 = camera.position.clone().lerp(exitCamera, 0.35).add(new THREE.Vector3(0, 2.4, 0));
    const c2 = exitCamera.clone().add(new THREE.Vector3(0, -1.2, 0));
    const cameraCurve = new THREE.CubicBezierCurve3(camera.position.clone(), c1, c2, exitCamera);
    const l1 = currentLook.clone().lerp(exitLook, 0.45);
    const l2 = exitLook.clone().add(new THREE.Vector3(0, 1.8, 0));
    const lookCurve = new THREE.CubicBezierCurve3(currentLook.clone(), l1, l2, exitLook);
    return { pose, exitCamera, exitLook, cameraCurve, lookCurve };
  }

  function prepareChapter(index) {
    activeIndex = index;
    const bundle = bundles[index];
    onChapterChange?.(index, bundle.chapter);
    glowLayer.style.background = `radial-gradient(ellipse at 79% 55%, ${bundle.chapter.glow || "rgba(80,133,197,.18)"}, transparent 37%)`;
    return bundle;
  }

  function start({ index = 0, startLook }) {
    if (state !== "overview") return false;
    bundles.forEach(resetBundle);
    const bundle = prepareChapter(index);
    currentLook.copy(startLook);
    startFov = camera.fov;
    startExposure = renderer.toneMappingExposure;
    entryTracks = buildEntryTracks(bundle, camera.position.clone(), startLook.clone(), false);
    durationMs = bundle.chapter.duration * 1000;
    startedAt = performance.now();
    state = "entering";
    stage.classList.remove("is-chapter-active");
    stage.classList.add("is-chapter-transition");
    setContentProgress(0);
    setWipe(0, bundle.chapter);
    onStateChange?.(state, index);
    return true;
  }

  function goTo(index) {
    if (state !== "chapter" || index < 0 || index >= chapters.length || index === activeIndex) return false;
    pendingIndex = index;
    const current = bundles[activeIndex];
    const next = bundles[pendingIndex];
    exitTracks = buildExitTracks(current);
    entryTracks = buildEntryTracks(next, camera.position.clone(), currentLook.clone(), true);
    durationMs = (current.chapter.handoffDuration || 4) * 1000;
    startedAt = performance.now();
    startFov = camera.fov;
    startExposure = renderer.toneMappingExposure;
    cutDone = false;
    state = "handoff";
    stage.classList.remove("is-chapter-active");
    stage.classList.add("is-chapter-transition");
    onStateChange?.(state, activeIndex);
    return true;
  }

  function finishChapter(index, tracks) {
    const bundle = bundles[index];
    const pose = tracks.pose;
    state = "chapter";
    camera.position.copy(tracks.finalCamera);
    currentLook.copy(tracks.finalLook);
    applyCameraPose(camera, currentLook, pose.finalRoll ?? 0);
    camera.fov = pose.finalFov;
    camera.updateProjectionMatrix();
    renderer.toneMappingExposure = bundle.chapter.finalExposure ?? 0.9;
    setContextProgress(bundle, 1);
    bundle.silhouette.setProgress(1);
    setContentProgress(1);
    setWipe(0, bundle.chapter);
    stage.classList.remove("is-chapter-transition");
    stage.classList.add("is-chapter-active");
    window.__h1V3ChapterFramingAudit = {
      chapter: bundle.chapter.id,
      index,
      viewport: projectedBounds(bundle.silhouette.silhouette, camera)
    };
    onStateChange?.(state, index);
  }

  function updateEntering(raw) {
    const bundle = bundles[activeIndex];
    const move = easeInOutCubic(raw);
    entryTracks.cameraCurve.getPointAt(move, tmpCamera);
    entryTracks.lookCurve.getPointAt(easeOutQuint(raw), tmpLook);
    camera.position.copy(tmpCamera);
    currentLook.copy(tmpLook);
    const roll = THREE.MathUtils.lerp(0, entryTracks.pose.finalRoll ?? 0, smoothstep(0.55, 1, raw));
    applyCameraPose(camera, currentLook, roll);
    const speedEnvelope = Math.sin(Math.PI * Math.min(1, raw / 0.82));
    const baseFov = THREE.MathUtils.lerp(startFov, entryTracks.pose.finalFov, smoothstep(0.5, 1, raw));
    camera.fov = baseFov + speedEnvelope * (entryTracks.pose.fovBoost ?? 9);
    camera.updateProjectionMatrix();
    setContextProgress(bundle, smoothstep(0.55, 0.94, raw));
    bundle.silhouette.setProgress(smoothstep(0.65, 0.96, raw));
    setContentProgress(smoothstep(0.72, 1, raw));
    renderer.toneMappingExposure = THREE.MathUtils.lerp(startExposure, bundle.chapter.finalExposure ?? 0.9, smoothstep(0.58, 1, raw));
    if (raw >= 1) finishChapter(activeIndex, entryTracks);
  }

  function updateHandoff(raw) {
    const current = bundles[activeIndex];
    const next = bundles[pendingIndex];
    if (raw < 0.5) {
      const t = clamp01(raw / 0.5);
      exitTracks.cameraCurve.getPointAt(easeInOutCubic(t), tmpCamera);
      exitTracks.lookCurve.getPointAt(easeOutQuint(t), tmpLook);
      camera.position.copy(tmpCamera);
      currentLook.copy(tmpLook);
      const roll = THREE.MathUtils.lerp(exitTracks.pose.finalRoll ?? 0, 0, t);
      applyCameraPose(camera, currentLook, roll);
      camera.fov = THREE.MathUtils.lerp(startFov, 74, smoothstep(0.1, 1, t));
      camera.updateProjectionMatrix();
      setContentProgress(1 - smoothstep(0.02, 0.36, t));
      current.silhouette.setProgress(1 - smoothstep(0.08, 0.78, t));
      setContextProgress(current, 1 - smoothstep(0.12, 0.82, t));
      renderer.toneMappingExposure = THREE.MathUtils.lerp(startExposure, 0.58, smoothstep(0.35, 1, t));
      setWipe(smoothstep(0.52, 0.98, t), next.chapter);
    } else {
      if (!cutDone) {
        cutDone = true;
        resetBundle(current);
        prepareChapter(pendingIndex);
        pendingIndex = -1;
        camera.position.copy(entryTracks.entryStart);
        currentLook.copy(entryTracks.entryLook);
        applyCameraPose(camera, currentLook, 0);
        camera.fov = 74;
        camera.updateProjectionMatrix();
        onStateChange?.("handoff-cut", activeIndex);
      }
      const t = clamp01((raw - 0.5) / 0.5);
      const bundle = bundles[activeIndex];
      entryTracks.cameraCurve.getPointAt(easeInOutCubic(t), tmpCamera);
      entryTracks.lookCurve.getPointAt(easeOutQuint(t), tmpLook);
      camera.position.copy(tmpCamera);
      currentLook.copy(tmpLook);
      const roll = THREE.MathUtils.lerp(0, entryTracks.pose.finalRoll ?? 0, smoothstep(0.35, 1, t));
      applyCameraPose(camera, currentLook, roll);
      const speedEnvelope = Math.sin(Math.PI * t);
      camera.fov = THREE.MathUtils.lerp(74, entryTracks.pose.finalFov, smoothstep(0.2, 1, t)) + speedEnvelope * 4.5;
      camera.updateProjectionMatrix();
      setWipe(1 - smoothstep(0.04, 0.42, t), bundle.chapter);
      setContextProgress(bundle, smoothstep(0.34, 0.92, t));
      bundle.silhouette.setProgress(smoothstep(0.46, 0.92, t));
      setContentProgress(smoothstep(0.58, 1, t));
      renderer.toneMappingExposure = THREE.MathUtils.lerp(0.58, bundle.chapter.finalExposure ?? 0.9, smoothstep(0.12, 1, t));
      if (raw >= 1) finishChapter(activeIndex, entryTracks);
    }
  }

  function update(now) {
    if (state !== "entering" && state !== "handoff") return false;
    const raw = clamp01((now - startedAt) / durationMs);
    if (state === "entering") updateEntering(raw);
    else updateHandoff(raw);
    return true;
  }

  function next() {
    if (activeIndex >= chapters.length - 1) return false;
    return goTo(activeIndex + 1);
  }

  function previous() {
    if (activeIndex <= 0) return false;
    return goTo(activeIndex - 1);
  }

  function reset() {
    state = "overview";
    activeIndex = -1;
    pendingIndex = -1;
    bundles.forEach(resetBundle);
    stage.classList.remove("is-chapter-transition", "is-chapter-active");
    setContentProgress(0);
    setWipe(0);
    renderer.toneMappingExposure = 1.52;
    onStateChange?.(state, -1);
  }

  return {
    start,
    goTo,
    next,
    previous,
    update,
    reset,
    get state() { return state; },
    get active() { return state === "entering" || state === "handoff"; },
    get chapterActive() { return state === "chapter"; },
    get currentIndex() { return activeIndex; },
    get currentLook() { return currentLook; }
  };
}
