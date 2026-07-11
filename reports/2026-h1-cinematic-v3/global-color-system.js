import * as THREE from "three";

const clamp01 = value => Math.max(0, Math.min(1, value));
const smoothstep = (a, b, value) => {
  const t = clamp01((value - a) / Math.max(1e-6, b - a));
  return t * t * (3 - 2 * t);
};

function createLayer(id, className) {
  const layer = document.createElement("div");
  layer.id = id;
  layer.className = className;
  layer.setAttribute("aria-hidden", "true");
  return layer;
}

function warmColorForIndex(index) {
  return [0x2a0b23, 0x351026, 0x41112d, 0x2d0d2a, 0x48162d][index % 5];
}

function warmEmissiveForIndex(index) {
  return [0xff8a42, 0xff4f83, 0xffb46b, 0xff6b58, 0xffd1a6][index % 5];
}

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function recolorCity(city) {
  const seen = new Set();
  let materialIndex = 0;

  city.traverse(object => {
    if (!object.material) return;
    materialList(object.material).forEach(material => {
      if (!material || seen.has(material)) return;
      seen.add(material);
      const index = materialIndex++;

      if (material.color) {
        if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
          const original = material.color.getHex();
          const isWater = original === 0x0a1b33 || original === 0x061631 || original === 0x010713;
          const isLand = original === 0x1a2638 || original === 0x080d18;
          if (isWater) {
            material.color.set(0x2a0a23);
            material.roughness = Math.min(material.roughness ?? 1, 0.38);
            material.metalness = Math.max(material.metalness ?? 0, 0.34);
          } else if (isLand) {
            material.color.set(0x3b1328);
            material.roughness = 0.88;
          } else {
            material.color.set(warmColorForIndex(index));
            material.roughness = Math.max(0.38, Math.min(material.roughness ?? 0.65, 0.72));
          }

          if (material.emissive) {
            material.emissive.set(warmEmissiveForIndex(index));
            const base = material.emissiveIntensity ?? 0;
            material.emissiveIntensity = material.emissiveMap
              ? THREE.MathUtils.clamp(Math.max(base, 0.46), 0.46, 0.82)
              : THREE.MathUtils.clamp(base * 0.72, 0.04, 0.5);
          }
        } else if (material.isMeshBasicMaterial) {
          material.color.set(index % 3 === 0 ? 0x3a1028 : 0x2a0a22);
        } else if (material.isLineBasicMaterial) {
          material.color.set(index % 3 === 0 ? 0xff8a42 : index % 2 ? 0xff4f83 : 0xffb46b);
          material.opacity = Math.min(material.opacity ?? 1, 0.76);
        } else if (material.isPointsMaterial) {
          material.color.set(index % 2 ? 0xff8a42 : 0xfff0df);
        }
      }
      material.needsUpdate = true;
    });
  });
}

function warmSceneLights(scene, lightingRig) {
  if (scene.fog) {
    scene.fog.color.set(0x8a2741);
    scene.fog.density = 0.0042;
  }

  scene.traverse(object => {
    if (object.isHemisphereLight) {
      object.color.set(0xff9a8c);
      object.groundColor.set(0x351028);
      object.intensity = Math.min(object.intensity, 1.18);
    } else if (object.isDirectionalLight) {
      object.color.set(object.position.x >= 0 ? 0xff7b36 : 0xff7697);
      object.intensity = Math.min(Math.max(object.intensity, 0.45), 1.65);
    } else if (object.isPointLight) {
      object.color.set(object.position.x >= 0 ? 0xff7545 : 0xff3f88);
      object.intensity *= 0.72;
      object.userData.baseIntensity = object.intensity;
    } else if (object.isAmbientLight) {
      object.color.set(0xff8b8e);
      object.intensity = Math.min(object.intensity, 0.4);
    }
  });

  if (!lightingRig) return;
  lightingRig.ambient.color.set(0xff8b8e);
  lightingRig.ambient.intensity = 0.36;
  lightingRig.sky.color.set(0xff9a8c);
  lightingRig.sky.groundColor.set(0x351028);
  lightingRig.sky.intensity = 1.12;
  lightingRig.moon.color.set(0xff9278);
  lightingRig.moon.intensity = 0.62;
  lightingRig.rim.color.set(0xff3f97);
  lightingRig.rim.intensity = 1.55;
  lightingRig.warmBounce.color.set(0xff7b36);
  lightingRig.warmBounce.intensity = 1.95;
  lightingRig.districtLights.forEach((light, index) => {
    light.color.set(index % 2 ? 0xff3f88 : 0xff8545);
    light.intensity = Math.max(8, (light.userData.baseIntensity || light.intensity) * 0.44);
    light.userData.baseIntensity = light.intensity;
  });
}

function harmonizeSilhouettes(city) {
  const palette = [0xff8a42, 0xff4f83, 0xffb46b];
  let edgeIndex = 0;
  city.traverse(object => {
    let node = object;
    let isChapterSilhouette = false;
    while (node) {
      if (node.name?.endsWith("-chapter-silhouette")) {
        isChapterSilhouette = true;
        break;
      }
      node = node.parent;
    }
    if (!isChapterSilhouette || !object.material) return;
    materialList(object.material).forEach(material => {
      if (material.isMeshBasicMaterial) material.color.set(0x19071f);
      if (material.isLineBasicMaterial) material.color.set(palette[edgeIndex++ % palette.length]);
      material.needsUpdate = true;
    });
  });
}

export function createGlobalColorSystem({ stage, sceneCanvas, cityCanvas }) {
  const spaceTint = createLayer("global-space-tint", "global-color-layer");
  const warmField = createLayer("global-macau-field", "global-color-layer");
  const warpBridge = createLayer("global-warp-bridge", "global-color-layer");
  stage.insertBefore(spaceTint, cityCanvas);
  stage.insertBefore(warmField, cityCanvas);
  stage.insertBefore(warpBridge, cityCanvas);

  let disposed = false;
  let warmProgress = 0;
  let raf = 0;

  function tick() {
    if (disposed) return;
    const globalState = window.__h1V3State || { phase: "loading", warpProgress: 0 };
    const phase = globalState.phase;
    const warp = clamp01(globalState.warpProgress || 0);

    const targetWarm = phase === "arrival" ? 1 : phase === "warp" ? smoothstep(0.52, 0.98, warp) : 0;
    const targetSpace = phase === "orbit" || phase === "loading"
      ? 1
      : phase === "warp" ? 1 - smoothstep(0.34, 0.86, warp) : 0;
    const bridge = phase === "warp" ? Math.sin(Math.PI * clamp01(warp)) : 0;

    warmProgress += (targetWarm - warmProgress) * 0.085;
    if (Math.abs(targetWarm - warmProgress) < 0.001) warmProgress = targetWarm;

    const warm = clamp01(warmProgress);
    spaceTint.style.opacity = String(targetSpace * 0.58);
    warmField.style.opacity = String(Math.pow(warm, 1.12));
    warpBridge.style.opacity = String(bridge * (0.42 + warm * 0.34));
    stage.style.setProperty("--global-warm-progress", warm.toFixed(4));
    stage.style.setProperty("--global-warp-progress", warp.toFixed(4));
    stage.classList.toggle("is-global-warm", warm > 0.28 || phase === "arrival");
    stage.classList.toggle("is-global-space", targetSpace > 0.1);

    const phaseLabel = document.getElementById("phase-label");
    if (phase === "arrival" && phaseLabel) phaseLabel.textContent = "MACAU WARM APPROACH";

    window.__h1V3GlobalColorAudit = {
      phase,
      warpProgress: Number(warp.toFixed(4)),
      warmProgress: Number(warm.toFixed(4)),
      spaceTint: Number((targetSpace * 0.58).toFixed(4)),
      bridgeOpacity: Number((bridge * (0.42 + warm * 0.34)).toFixed(4)),
      palette: phase === "arrival" ? "coral-macau" : phase === "warp" ? "violet-to-coral" : "violet-blue-space",
      hardColorCut: false
    };

    raf = requestAnimationFrame(tick);
  }
  tick();

  function attachCity({ city, scene, lightingRig }) {
    recolorCity(city);
    warmSceneLights(scene, lightingRig);
    cityCanvas.style.filter = "saturate(.92) contrast(.96) brightness(1.03)";
  }

  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    spaceTint.remove();
    warmField.remove();
    warpBridge.remove();
    sceneCanvas.style.filter = "";
    cityCanvas.style.filter = "";
  }

  return { attachCity, harmonizeSilhouettes, dispose, get warmProgress() { return warmProgress; } };
}
