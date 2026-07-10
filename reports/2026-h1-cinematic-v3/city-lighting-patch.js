import * as THREE from "three";

function liftColor(color, minimumLightness, saturationBoost = 1) {
  const hsl = {};
  color.getHSL(hsl);
  color.setHSL(hsl.h, Math.min(1, hsl.s * saturationBoost), Math.max(minimumLightness, hsl.l));
}

export function applyReadableNightLighting({ scene, renderer, city }) {
  renderer.toneMappingExposure = 1.52;
  scene.fog = new THREE.FogExp2(0x07111f, 0.0047);

  city.traverse(object => {
    if (!object.isMesh || !object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material.color) continue;

      // The Phase 2 window atlas was unintentionally used as both albedo and emissive.
      // Keep it only as an emissive mask so the wall base colour remains visible.
      if (material.map && material.emissiveMap === material.map) {
        material.map = null;
      }

      if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
        const currentHex = material.color.getHex();
        const isWater = currentHex === 0x010713 || currentHex === 0x061631;
        const isLand = currentHex === 0x080d18;

        if (isWater) {
          material.color.set(0x0a1b33);
          material.roughness = Math.min(material.roughness ?? 1, 0.34);
          material.metalness = Math.max(material.metalness ?? 0, 0.32);
        } else if (isLand) {
          material.color.set(0x1a2638);
          material.roughness = 0.86;
        } else {
          liftColor(material.color, 0.18, 1.08);
          material.roughness = Math.min(material.roughness ?? 1, 0.7);
          if (material.emissiveMap) {
            material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, 0.72);
          }
        }
      }
      material.needsUpdate = true;
    }
  });

  const ambient = new THREE.AmbientLight(0x6f86ad, 0.48);
  const sky = new THREE.HemisphereLight(0xa8c3ef, 0x3f2030, 1.48);
  const moon = new THREE.DirectionalLight(0xd7e7ff, 2.35);
  moon.position.set(-70, 125, 84);
  const rim = new THREE.DirectionalLight(0x7a8cff, 0.72);
  rim.position.set(84, 42, 118);
  const warmBounce = new THREE.DirectionalLight(0xff9b70, 0.78);
  warmBounce.position.set(80, 32, -58);

  const districtLights = [
    [-30, 18, 18, 0xff9a62, 28],
    [8, 22, 6, 0xff6eb7, 34],
    [34, 18, -22, 0x68cfff, 30],
    [18, 16, 46, 0xffc173, 24]
  ].map(([x, y, z, color, intensity]) => {
    const light = new THREE.PointLight(color, intensity, 92, 1.65);
    light.position.set(x, y, z);
    return light;
  });

  scene.add(ambient, sky, moon, rim, warmBounce, ...districtLights);

  return { ambient, sky, moon, rim, warmBounce, districtLights };
}
