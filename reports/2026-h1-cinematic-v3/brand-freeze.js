import * as THREE from "three";

const clamp01 = value => Math.max(0, Math.min(1, value));

function createLayer(id, className) {
  const layer = document.createElement("div");
  layer.id = id;
  layer.className = className;
  layer.setAttribute("aria-hidden", "true");
  return layer;
}

export function createFirstChapterBrandSystem({ stage, scene, canvas, lightingRig }) {
  const field = createLayer("chapter-brand-field", "chapter-brand-layer");
  const haze = createLayer("chapter-brand-haze", "chapter-brand-layer");
  const light = createLayer("chapter-brand-light", "chapter-brand-layer");
  stage.insertBefore(field, canvas);
  stage.insertBefore(haze, stage.querySelector("#chapter-dim"));
  stage.insertBefore(light, stage.querySelector("#chapter-dim"));

  const baseFog = scene.fog
    ? { color: scene.fog.color.clone(), density: scene.fog.density }
    : null;
  const refinedFog = new THREE.Color(0xff7054);

  const lights = lightingRig ? {
    ambient: { light: lightingRig.ambient, color: lightingRig.ambient.color.clone(), intensity: lightingRig.ambient.intensity, target: new THREE.Color(0xff8b8e), targetIntensity: 0.3 },
    sky: { light: lightingRig.sky, color: lightingRig.sky.color.clone(), groundColor: lightingRig.sky.groundColor.clone(), intensity: lightingRig.sky.intensity, target: new THREE.Color(0xff9b8f), targetGround: new THREE.Color(0x2b0924), targetIntensity: 1.04 },
    moon: { light: lightingRig.moon, color: lightingRig.moon.color.clone(), intensity: lightingRig.moon.intensity, target: new THREE.Color(0xff9a76), targetIntensity: 0.38 },
    rim: { light: lightingRig.rim, color: lightingRig.rim.color.clone(), intensity: lightingRig.rim.intensity, target: new THREE.Color(0xff3f97), targetIntensity: 2.25 },
    warmBounce: { light: lightingRig.warmBounce, color: lightingRig.warmBounce.color.clone(), intensity: lightingRig.warmBounce.intensity, target: new THREE.Color(0xff7b36), targetIntensity: 2.55 },
    district: lightingRig.districtLights.map(item => ({ light: item, color: item.color.clone(), intensity: item.intensity }))
  } : null;

  let progress = 0;

  function applyLights(p) {
    if (!lights) return;
    for (const key of ["ambient", "moon", "rim", "warmBounce"]) {
      const entry = lights[key];
      entry.light.color.copy(entry.color).lerp(entry.target, p);
      entry.light.intensity = THREE.MathUtils.lerp(entry.intensity, entry.targetIntensity, p);
    }
    lights.sky.light.color.copy(lights.sky.color).lerp(lights.sky.target, p);
    lights.sky.light.groundColor.copy(lights.sky.groundColor).lerp(lights.sky.targetGround, p);
    lights.sky.light.intensity = THREE.MathUtils.lerp(lights.sky.intensity, lights.sky.targetIntensity, p);
    lights.district.forEach((entry, index) => {
      entry.light.color.copy(entry.color).lerp(index % 2 ? new THREE.Color(0xff427f) : new THREE.Color(0xff8a42), p * 0.42);
      entry.light.intensity = THREE.MathUtils.lerp(entry.intensity, entry.intensity * 0.34, p);
    });
  }

  function update(delta, controller) {
    const state = controller?.state || "overview";
    const performanceSelected = stage.dataset.chapter === "performance";
    const leavingPerformance = state === "handoff" && controller?.currentIndex === 0;
    const target = performanceSelected && state !== "overview" && !leavingPerformance ? 1 : 0;
    const response = target > progress ? 1.7 : 2.7;
    progress = THREE.MathUtils.lerp(progress, target, 1 - Math.exp(-response * Math.max(0.001, delta)));
    if (Math.abs(progress - target) < 0.001) progress = target;

    const p = clamp01(progress);
    field.style.opacity = String(p * 0.18);
    haze.style.opacity = String(p * 0.28);
    light.style.opacity = String(p * 0.74);
    stage.style.setProperty("--brand-progress", p.toFixed(4));
    stage.classList.toggle("is-brand-freeze", p > 0.015);

    const saturation = THREE.MathUtils.lerp(0.92, 0.82, p);
    const contrast = THREE.MathUtils.lerp(0.96, 0.9, p);
    const brightness = THREE.MathUtils.lerp(1.03, 1.07, p);
    canvas.style.filter = `saturate(${saturation.toFixed(3)}) contrast(${contrast.toFixed(3)}) brightness(${brightness.toFixed(3)})`;

    if (baseFog && scene.fog) {
      scene.fog.color.copy(baseFog.color).lerp(refinedFog, p * 0.55);
      scene.fog.density = THREE.MathUtils.lerp(baseFog.density, baseFog.density * 0.82, p);
    }
    applyLights(p);

    window.__h1V3BrandTransitionAudit = {
      chapter: stage.dataset.chapter || null,
      state,
      progress: Number(p.toFixed(4)),
      target,
      globalWarmBaseline: true,
      environmentShift: "warm-city-to-clean-brand-freeze",
      citySaturation: Number(saturation.toFixed(3)),
      cityContrast: Number(contrast.toFixed(3)),
      hiddenCut: false,
      materialMode: "shared-geometry-brand-rim"
    };
  }

  function dispose() {
    field.remove();
    haze.remove();
    light.remove();
    canvas.style.filter = "";
  }

  return { update, dispose, get progress() { return progress; } };
}
