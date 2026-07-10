import * as THREE from "three";

function cloneMaterialForFade(material) {
  const cloned = material.clone();
  cloned.transparent = true;
  cloned.opacity = material.opacity ?? 1;
  cloned.depthWrite = true;
  cloned.needsUpdate = true;
  return cloned;
}

export function createLandmarkSilhouette(targetGroup, options = {}) {
  if (!targetGroup) throw new Error("Landmark group is required for silhouette transition");

  const fillColor = options.fill ?? 0x122139;
  const edgeColor = options.edge ?? 0x6e91bd;
  const edgeOpacity = options.edgeOpacity ?? 0.5;
  const originalMaterials = [];
  const seenOriginal = new Map();

  targetGroup.traverse(object => {
    if (!object.material) return;
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const replacement = sourceMaterials.map(material => {
      if (!seenOriginal.has(material)) {
        const cloned = cloneMaterialForFade(material);
        seenOriginal.set(material, cloned);
        originalMaterials.push({
          material: cloned,
          baseOpacity: cloned.opacity,
          baseEmissiveIntensity: "emissiveIntensity" in cloned ? cloned.emissiveIntensity : null
        });
      }
      return seenOriginal.get(material);
    });
    object.material = Array.isArray(object.material) ? replacement : replacement[0];
  });

  const silhouette = targetGroup.clone(true);
  silhouette.name = `${targetGroup.name || "landmark"}-chapter-silhouette`;
  silhouette.renderOrder = 30;
  const silhouetteMaterials = [];
  const edgeMaterials = [];
  const meshNodes = [];

  silhouette.traverse(object => {
    if (object.isMesh) {
      if (object.geometry?.type === "RingGeometry") {
        object.visible = false;
        return;
      }
      const material = new THREE.MeshBasicMaterial({
        color: fillColor,
        transparent: true,
        opacity: 0,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });
      object.material = material;
      silhouetteMaterials.push(material);
      meshNodes.push(object);
    } else if (object.isLine || object.isLineSegments) {
      const material = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      object.material = material;
      edgeMaterials.push(material);
    }
  });

  meshNodes.forEach(mesh => {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 34),
      new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    edges.renderOrder = 31;
    mesh.add(edges);
    edgeMaterials.push(edges.material);
  });

  silhouette.visible = false;
  targetGroup.parent.add(silhouette);

  function setProgress(value) {
    const progress = THREE.MathUtils.clamp(value, 0, 1);
    silhouette.visible = progress > 0.001;
    originalMaterials.forEach(entry => {
      entry.material.opacity = entry.baseOpacity * (1 - progress * 0.96);
      if (entry.baseEmissiveIntensity !== null) {
        entry.material.emissiveIntensity = entry.baseEmissiveIntensity * (1 - progress);
      }
    });
    silhouetteMaterials.forEach(material => { material.opacity = progress * 0.94; });
    edgeMaterials.forEach(material => { material.opacity = progress * edgeOpacity; });
    targetGroup.visible = progress < 0.995;
  }

  function reset() {
    targetGroup.visible = true;
    silhouette.visible = false;
    originalMaterials.forEach(entry => {
      entry.material.opacity = entry.baseOpacity;
      if (entry.baseEmissiveIntensity !== null) entry.material.emissiveIntensity = entry.baseEmissiveIntensity;
    });
    silhouetteMaterials.forEach(material => { material.opacity = 0; });
    edgeMaterials.forEach(material => { material.opacity = 0; });
  }

  function dispose() {
    silhouette.traverse(object => {
      if (object.geometry?.type === "EdgesGeometry") object.geometry.dispose();
      if (object.material && !Array.isArray(object.material)) object.material.dispose();
    });
    silhouette.removeFromParent();
  }

  return { silhouette, setProgress, reset, dispose };
}
