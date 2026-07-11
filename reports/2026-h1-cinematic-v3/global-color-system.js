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

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function warmWindowColor(index) {
  return [0xffb36b, 0xffd1a2, 0xff8a57, 0xffc17b][index % 4];
}

function deepFacadeColor(index) {
  return [0x130b16, 0x170d1a, 0x1b0e1d, 0x201020][index % 4];
}

function recolorCityForBacklight(city) {
  const seen = new Set();
  const stats = { water: 0, land: 0, facade: 0, windows: 0, lines: 0, points: 0, accents: 0 };
  let materialIndex = 0;

  city.traverse(object => {
    if (!object.material) return;

    materialList(object.material).forEach(material => {
      if (!material || seen.has(material)) return;
      seen.add(material);

      const index = materialIndex++;
      const original = material.color?.getHex?.() ?? null;

      if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
        const isWater = [0x0a1b33, 0x061631, 0x010713].includes(original);
        const isLand = [0x1a2638, 0x080d18].includes(original);
        const hasWindowMask = Boolean(material.emissiveMap);

        if (isWater) {
          material.color.set(0x100912);
          material.roughness = Math.min(material.roughness ?? 1, 0.32);
          material.metalness = Math.max(material.metalness ?? 0, 0.46);
          if (material.emissive) {
            material.emissive.set(0x17090e);
            material.emissiveIntensity = 0.025;
          }
          material.userData.sunsetRole = "water";
          stats.water++;
        } else if (isLand) {
          material.color.set(0x120a13);
          material.roughness = 0.94;
          material.metalness = 0.02;
          if (material.emissive) {
            material.emissive.set(0x000000);
            material.emissiveIntensity = 0;
          }
          material.userData.sunsetRole = "land";
          stats.land++;
        } else {
          material.color.set(deepFacadeColor(index));
          material.roughness = Math.max(0.54, Math.min(material.roughness ?? 0.68, 0.82));
          material.metalness = Math.min(material.metalness ?? 0.1, 0.28);

          if (material.emissive) {
            if (hasWindowMask) {
              material.emissive.set(warmWindowColor(index));
              material.emissiveIntensity = THREE.MathUtils.clamp(
                Math.max(material.emissiveIntensity ?? 0, 0.34),
                0.34,
                0.58
              );
              stats.windows++;
            } else {
              material.emissive.set(0x260b1d);
              material.emissiveIntensity = Math.min(material.emissiveIntensity ?? 0, 0.11);
            }
          }

          material.userData.sunsetRole = hasWindowMask ? "facade-windowed" : "facade";
          stats.facade++;
        }
      } else if (material.isMeshBasicMaterial) {
        const isFlatWater = original === 0x061631;
        const isAura = object.geometry?.type === "RingGeometry";

        if (isFlatWater) {
          material.color.set(0x100912);
          material.opacity = Math.min(material.opacity ?? 1, 0.88);
          material.userData.sunsetRole = "water-flat";
          stats.water++;
        } else if (isAura) {
          material.color.set(index % 2 ? 0xff6c58 : 0xff9b55);
          material.opacity = Math.min(material.opacity ?? 1, 0.14);
          material.userData.sunsetRole = "accent";
          stats.accents++;
        } else {
          material.color.set(0x170a19);
          material.userData.sunsetRole = "graphic-dark";
          stats.facade++;
        }
      } else if (material.isLineBasicMaterial) {
        const source = material.color.clone();
        const warmSource = source.r > source.b * 1.08;
        material.color.set(warmSource ? 0xe99361 : index % 2 ? 0xa54d68 : 0x7d405c);
        material.opacity = Math.min(material.opacity ?? 1, warmSource ? 0.58 : 0.36);
        material.userData.sunsetRole = "line";
        stats.lines++;
      } else if (material.isPointsMaterial) {
        material.color.set(index % 3 === 0 ? 0xffc184 : 0xff8a57);
        material.opacity = Math.min(material.opacity ?? 1, 0.72);
        material.userData.sunsetRole = "point";
        stats.points++;
      }

      material.needsUpdate = true;
    });
  });

  return stats;
}

function createBacklightRig(scene, city, lightingRig) {
  if (scene.fog) {
    scene.fog.color.set(0x5a3d49);
    scene.fog.density = 0.00315;
  }

  scene.traverse(object => {
    if (object.isHemisphereLight) {
      object.color.set(0xff8b73);
      object.groundColor.set(0x100811);
      object.intensity = Math.min(object.intensity, 0.32);
    } else if (object.isDirectionalLight) {
      object.color.set(object.position.x >= 0 ? 0xff8d61 : 0x8c496c);
      object.intensity = Math.min(object.intensity, 0.22);
    } else if (object.isPointLight) {
      object.color.set(object.position.x >= 0 ? 0xff8a54 : 0xc94b76);
      object.intensity = Math.max(3.5, object.intensity * 0.22);
      object.userData.baseIntensity = object.intensity;
    } else if (object.isAmbientLight) {
      object.color.set(0x3c2438);
      object.intensity = Math.min(object.intensity, 0.13);
    }
  });

  if (lightingRig) {
    lightingRig.ambient.color.set(0x3c2438);
    lightingRig.ambient.intensity = 0.12;
    lightingRig.sky.color.set(0xff8b73);
    lightingRig.sky.groundColor.set(0x100811);
    lightingRig.sky.intensity = 0.28;
    lightingRig.moon.color.set(0x7d4667);
    lightingRig.moon.intensity = 0.12;
    lightingRig.rim.color.set(0xff3c8b);
    lightingRig.rim.intensity = 0.52;
    lightingRig.warmBounce.color.set(0xff8d4f);
    lightingRig.warmBounce.intensity = 0.34;
    lightingRig.districtLights.forEach((light, index) => {
      light.color.set(index % 2 ? 0xff5b76 : 0xff9a58);
      light.intensity = Math.max(4.5, (light.userData.baseIntensity || light.intensity) * 0.24);
      light.userData.baseIntensity = light.intensity;
    });
  }

  const sunTarget = new THREE.Object3D();
  sunTarget.name = "sunset-backlight-target";
  sunTarget.position.set(city?.position?.x || 0, -2, (city?.position?.z || 0) - 4);

  const sun = new THREE.DirectionalLight(0xffa45f, 3.15);
  sun.name = "sunset-backlight";
  sun.position.set(48, 18, -132);
  sun.target = sunTarget;

  const magentaRim = new THREE.DirectionalLight(0xff3c8f, 0.62);
  magentaRim.name = "sunset-magenta-rim";
  magentaRim.position.set(-82, 36, 76);
  magentaRim.target = sunTarget;

  scene.add(sunTarget, sun, magentaRim);
  return { sun, magentaRim, target: sunTarget };
}

function harmonizeSilhouettes(city) {
  const palette = [0xff9a55, 0xff4f86, 0xffc079];
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
      if (material.isMeshBasicMaterial) material.color.set(0x150916);
      if (material.isLineBasicMaterial) material.color.set(palette[edgeIndex++ % palette.length]);
      material.needsUpdate = true;
    });
  });
}

export function createGlobalColorSystem({ stage, sceneCanvas, cityCanvas }) {
  const spaceTint = createLayer("global-space-tint", "global-color-layer");
  const sunsetField = createLayer("global-macau-field", "global-color-layer");
  const warpBridge = createLayer("global-warp-bridge", "global-color-layer");
  const sunsetSun = createLayer("global-sunset-sun", "global-color-layer");
  const sunsetReflection = createLayer("global-sunset-reflection", "global-color-layer");

  stage.insertBefore(spaceTint, cityCanvas);
  stage.insertBefore(sunsetField, cityCanvas);
  stage.insertBefore(warpBridge, cityCanvas);
  stage.insertBefore(sunsetSun, cityCanvas);
  stage.insertBefore(sunsetReflection, cityCanvas);

  let disposed = false;
  let warmProgress = 0;
  let raf = 0;
  let sunsetRig = null;
  let materialStats = null;

  function tick() {
    if (disposed) return;

    const globalState = window.__h1V3State || { phase: "loading", warpProgress: 0 };
    const phase = globalState.phase;
    const warp = clamp01(globalState.warpProgress || 0);

    const targetWarm = phase === "arrival" ? 1 : phase === "warp" ? smoothstep(0.56, 0.98, warp) : 0;
    const targetSpace = phase === "orbit" || phase === "loading"
      ? 1
      : phase === "warp" ? 1 - smoothstep(0.34, 0.86, warp) : 0;
    const bridge = phase === "warp" ? Math.sin(Math.PI * clamp01(warp)) : 0;

    warmProgress += (targetWarm - warmProgress) * 0.072;
    if (Math.abs(targetWarm - warmProgress) < 0.001) warmProgress = targetWarm;

    const warm = clamp01(warmProgress);
    spaceTint.style.opacity = String(targetSpace * 0.56);
    sunsetField.style.opacity = String(Math.pow(warm, 1.06));
    warpBridge.style.opacity = String(bridge * (0.32 + warm * 0.24));
    sunsetSun.style.opacity = String(Math.pow(warm, 1.2) * 0.94);
    sunsetReflection.style.opacity = String(Math.pow(warm, 1.35) * 0.46);

    stage.style.setProperty("--global-warm-progress", warm.toFixed(4));
    stage.style.setProperty("--global-warp-progress", warp.toFixed(4));
    stage.classList.toggle("is-global-warm", warm > 0.22 || phase === "arrival");
    stage.classList.toggle("is-global-space", targetSpace > 0.1);

    const phaseLabel = document.getElementById("phase-label");
    if (phase === "arrival" && phaseLabel) phaseLabel.textContent = "MACAU SUNSET APPROACH";

    window.__h1V3GlobalColorAudit = {
      phase,
      warpProgress: Number(warp.toFixed(4)),
      warmProgress: Number(warm.toFixed(4)),
      spaceTint: Number((targetSpace * 0.56).toFixed(4)),
      bridgeOpacity: Number((bridge * (0.32 + warm * 0.24)).toFixed(4)),
      sunOpacity: Number((Math.pow(warm, 1.2) * 0.94).toFixed(4)),
      palette: phase === "arrival" ? "coral-sky-deep-plum-city" : phase === "warp" ? "violet-to-sunset" : "violet-blue-space",
      lightingModel: "low-sun-backlight",
      cityMaterials: materialStats,
      hardColorCut: false
    };

    raf = requestAnimationFrame(tick);
  }

  tick();

  function attachCity({ city, scene, lightingRig, renderer }) {
    materialStats = recolorCityForBacklight(city);
    sunsetRig = createBacklightRig(scene, city, lightingRig);
    if (renderer) renderer.toneMappingExposure = 1.08;
    cityCanvas.style.filter = "saturate(.78) contrast(1.14) brightness(.84)";
  }

  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    spaceTint.remove();
    sunsetField.remove();
    warpBridge.remove();
    sunsetSun.remove();
    sunsetReflection.remove();
    if (sunsetRig) {
      sunsetRig.sun.removeFromParent();
      sunsetRig.magentaRim.removeFromParent();
      sunsetRig.target.removeFromParent();
    }
    sceneCanvas.style.filter = "";
    cityCanvas.style.filter = "";
  }

  return {
    attachCity,
    harmonizeSilhouettes,
    dispose,
    get warmProgress() { return warmProgress; }
  };
}
