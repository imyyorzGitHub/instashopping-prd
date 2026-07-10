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
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2
  };
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
  let handoffFromIndex = -1;
  let handoffToIndex = -1;
  let startedAt = 0;
  let durationMs = 0;
  let entryTracks = null;
  let handoffTracks = null;
  let contentSwapped = false;
  let startFov = camera.fov;
  let startExposure = renderer.toneMappingExposure;
  let startRoll = 0;

  const currentLook = new THREE.Vector3(4, 0, 12);
  const tmpCamera = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  const mobilePose = chapter => window.matchMedia("(max-width: 760px)").matches
    ? chapter.camera.mobile
    : chapter.camera.desktop;

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

  function setChapterPresentation(index) {
    const bundle = bundles[index];
    onChapterChange?.(index, bundle.chapter);
    glowLayer.style.background = `radial-gradient(ellipse at 79% 55%, ${bundle.chapter.glow || "rgba(80,133,197,.18)"}, transparent 37%)`;
  }

  function buildEntryTracks(bundle, startCamera, startLook) {
    const pose = mobilePose(bundle.chapter);
    const base = bundle.landmark.position.clone();
    const finalCamera = worldFromLocal(city, base.clone().add(new THREE.Vector3(...pose.finalOffset)));
    const finalLook = worldFromLocal(city, base.clone().add(new THREE.Vector3(...pose.finalLookOffset)));
    const approach = worldFromLocal(city, base.clone().add(new THREE.Vector3(...pose.approachOffset)));
    const c1 = startCamera.clone().lerp(approach, 0.42).add(new THREE.Vector3(0, pose.cameraControlLift ?? 2.5, 0));
    const c2 = approach.clone();
    const cameraCurve = new THREE.CubicBezierCurve3(startCamera.clone(), c1, c2, finalCamera.clone());
    const l1 = startLook.clone().lerp(finalLook, 0.34).add(new THREE.Vector3(0, 1.25, 0));
    const lookControlOffset = pose.lookControlOffset ?? [-1, 1, 2.5];
    const l2 = finalLook.clone().add(new THREE.Vector3(...lookControlOffset));
    const lookCurve = new THREE.CubicBezierCurve3(startLook.clone(), l1, l2, finalLook.clone());
    return { pose, finalCamera, finalLook, cameraCurve, lookCurve };
  }

  function buildHandoffTracks(current, next) {
    const currentPose = mobilePose(current.chapter);
    const nextPose = mobilePose(next.chapter);
    const currentBase = current.landmark.position.clone();
    const nextBase = next.landmark.position.clone();

    const startCamera = camera.position.clone();
    const startLook = currentLook.clone();
    const currentExit = worldFromLocal(city, currentBase.clone().add(new THREE.Vector3(...(currentPose.exitOffset || [0, 10, 3]))));
    const currentExitLook = worldFromLocal(city, currentBase.clone().add(new THREE.Vector3(...(currentPose.exitLookOffset || [0, 5, 0]))));
    const nextApproach = worldFromLocal(city, nextBase.clone().add(new THREE.Vector3(...nextPose.approachOffset)));
    const finalCamera = worldFromLocal(city, nextBase.clone().add(new THREE.Vector3(...nextPose.finalOffset)));
    const finalLook = worldFromLocal(city, nextBase.clone().add(new THREE.Vector3(...nextPose.finalLookOffset)));

    const routeDistance = currentExit.distanceTo(nextApproach);
    const cruiseLift = THREE.MathUtils.clamp(routeDistance * 0.26, 5.5, 17);
    const routeMid = currentExit.clone().lerp(nextApproach, 0.5);
    routeMid.y += cruiseLift;
    const routeQuarter = currentExit.clone().lerp(routeMid, 0.58);
    routeQuarter.y += cruiseLift * 0.18;
    const routeThreeQuarter = routeMid.clone().lerp(nextApproach, 0.62);
    routeThreeQuarter.y += cruiseLift * 0.08;

    const cameraCurve = new THREE.CatmullRomCurve3([
      startCamera,
      currentExit,
      routeQuarter,
      routeMid,
      routeThreeQuarter,
      nextApproach,
      finalCamera
    ], false, "centripetal", 0.5);

    const currentAnchor = worldFromLocal(city, currentBase);
    const nextAnchor = worldFromLocal(city, nextBase);
    const routeLookMid = currentAnchor.clone().lerp(nextAnchor, 0.5);
    routeLookMid.y += THREE.MathUtils.clamp(3.2 + routeDistance * 0.04, 3.5, 8.5);
    const nextEntryLook = worldFromLocal(
      city,
      nextBase.clone().add(new THREE.Vector3(0, Math.max(2, nextPose.finalLookOffset[1] + 1.4), 0))
    );
    const lookCurve = new THREE.CatmullRomCurve3([
      startLook,
      currentExitLook,
      routeLookMid,
      nextEntryLook,
      finalLook
    ], false, "centripetal", 0.5);

    return {
      pose: nextPose,
      currentPose,
      finalCamera,
      finalLook,
      cameraCurve,
      lookCurve,
      routeDistance,
      cruiseLift,
      cruiseFov: THREE.MathUtils.clamp(Math.max(camera.fov, nextPose.finalFov) + 9, 70, 78)
    };
  }

  function start({ index = 0, startLook }) {
    if (state !== "overview") return false;
    bundles.forEach(resetBundle);
    activeIndex = index;
    setChapterPresentation(index);
    currentLook.copy(startLook);
    startFov = camera.fov;
    startExposure = renderer.toneMappingExposure;
    startRoll = 0;
    entryTracks = buildEntryTracks(bundles[index], camera.position.clone(), startLook.clone());
    durationMs = bundles[index].chapter.duration * 1000;
    startedAt = performance.now();
    state = "entering";
    stage.classList.remove("is-chapter-active");
    stage.classList.add("is-chapter-transition");
    setContentProgress(0);
    setWipe(0, bundles[index].chapter);
    onStateChange?.(state, index);
    return true;
  }

  function goTo(index) {
    if (state !== "chapter" || index < 0 || index >= chapters.length || index === activeIndex) return false;

    handoffFromIndex = activeIndex;
    handoffToIndex = index;
    const current = bundles[handoffFromIndex];
    const next = bundles[handoffToIndex];
    resetBundle(next);
    handoffTracks = buildHandoffTracks(current, next);
    durationMs = (current.chapter.handoffDuration || 3.8) * 1000;
    startedAt = performance.now();
    startFov = camera.fov;
    startExposure = renderer.toneMappingExposure;
    startRoll = mobilePose(current.chapter).finalRoll ?? 0;
    contentSwapped = false;
    state = "handoff";
    stage.classList.remove("is-chapter-active");
    stage.classList.add("is-chapter-transition");
    setWipe(0, next.chapter);
    onStateChange?.(state, handoffFromIndex);

    window.__h1V3HandoffAudit = {
      mode: "continuous-city-spline",
      from: current.chapter.id,
      to: next.chapter.id,
      duration: durationMs / 1000,
      routeDistance: handoffTracks.routeDistance,
      cruiseLift: handoffTracks.cruiseLift,
      hiddenCut: false
    };
    return true;
  }

  function finishChapter(index, tracks) {
    const bundle = bundles[index];
    const pose = tracks.pose;
    activeIndex = index;
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
    renderer.toneMappingExposure = THREE.MathUtils.lerp(
      startExposure,
      bundle.chapter.finalExposure ?? 0.9,
      smoothstep(0.58, 1, raw)
    );
    if (raw >= 1) finishChapter(activeIndex, entryTracks);
  }

  function updateHandoff(raw) {
    const current = bundles[handoffFromIndex];
    const next = bundles[handoffToIndex];
    const move = easeInOutCubic(raw);
    handoffTracks.cameraCurve.getPointAt(move, tmpCamera);
    handoffTracks.lookCurve.getPointAt(move, tmpLook);
    camera.position.copy(tmpCamera);
    currentLook.copy(tmpLook);

    const routeBank = Math.sin(Math.PI * raw) * Math.sign((handoffTracks.pose.finalRoll ?? 0) - startRoll || 1) * 0.55;
    const roll = THREE.MathUtils.lerp(startRoll, handoffTracks.pose.finalRoll ?? 0, smoothstep(0.2, 0.94, raw)) + routeBank;
    applyCameraPose(camera, currentLook, roll);

    const fovBase = THREE.MathUtils.lerp(startFov, handoffTracks.pose.finalFov, smoothstep(0.5, 1, raw));
    const fovArc = Math.sin(Math.PI * raw) * (handoffTracks.cruiseFov - Math.max(startFov, handoffTracks.pose.finalFov));
    camera.fov = fovBase + fovArc;
    camera.updateProjectionMatrix();

    const currentFade = smoothstep(0.04, 0.36, raw);
    current.silhouette.setProgress(1 - currentFade);
    setContextProgress(current, 1 - smoothstep(0.08, 0.42, raw));

    if (!contentSwapped && raw >= 0.5) {
      contentSwapped = true;
      setChapterPresentation(handoffToIndex);
    }

    const nextSceneProgress = smoothstep(0.48, 0.94, raw);
    setContextProgress(next, nextSceneProgress);
    next.silhouette.setProgress(smoothstep(0.58, 0.96, raw));

    const oldContent = 1 - smoothstep(0.01, 0.28, raw);
    const newContent = contentSwapped ? smoothstep(0.64, 1, raw) : 0;
    setContentProgress(raw < 0.5 ? oldContent : newContent);

    const destinationExposure = next.chapter.finalExposure ?? 0.9;
    const exposureBase = THREE.MathUtils.lerp(startExposure, destinationExposure, smoothstep(0.42, 1, raw));
    renderer.toneMappingExposure = Math.max(0.58, exposureBase - Math.sin(Math.PI * raw) * 0.1);
    setWipe(0, next.chapter);

    if (raw >= 1) {
      resetBundle(current);
      if (!contentSwapped) setChapterPresentation(handoffToIndex);
      finishChapter(handoffToIndex, handoffTracks);
      handoffFromIndex = -1;
      handoffToIndex = -1;
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
    handoffFromIndex = -1;
    handoffToIndex = -1;
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
