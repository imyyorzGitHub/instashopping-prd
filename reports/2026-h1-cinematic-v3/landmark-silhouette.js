import * as THREE from "three";

function cloneMaterialForFade(material) {
  const cloned = material.clone();
  cloned.transparent = true;
  cloned.opacity = material.opacity ?? 1;
  cloned.depthWrite = true;
  cloned.needsUpdate = true;
  return cloned;
}

function createBrandMaterial(options = {}) {
  const fill = new THREE.Color(options.brandFill ?? 0x16051f);
  const rimA = new THREE.Color(options.brandRimA ?? 0xff3f98);
  const rimB = new THREE.Color(options.brandRimB ?? 0xff8a3d);
  return new THREE.ShaderMaterial({
    uniforms: {
      uFill: { value: fill },
      uRimA: { value: rimA },
      uRimB: { value: rimB },
      uProgress: { value: 0 },
      uOpacity: { value: options.fillOpacity ?? 0.97 },
      uRimPower: { value: options.brandRimPower ?? 2.15 },
      uRimStrength: { value: options.brandRimStrength ?? 1.55 }
    },
    vertexShader: `
      varying vec3 vViewNormal;
      varying vec3 vViewDir;
      varying float vHeight;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        vHeight = position.y;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uFill;
      uniform vec3 uRimA;
      uniform vec3 uRimB;
      uniform float uProgress;
      uniform float uOpacity;
      uniform float uRimPower;
      uniform float uRimStrength;
      varying vec3 vViewNormal;
      varying vec3 vViewDir;
      varying float vHeight;
      void main() {
        float facing = clamp(abs(dot(normalize(vViewNormal), normalize(vViewDir))), 0.0, 1.0);
        float rim = pow(1.0 - facing, uRimPower);
        float vertical = smoothstep(0.1, 6.6, vHeight);
        vec3 rimColor = mix(uRimA, uRimB, vertical);
        vec3 color = uFill + rimColor * rim * uRimStrength;
        float alpha = uProgress * uOpacity * (0.94 + rim * 0.06);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    toneMapped: false
  });
}

export function createLandmarkSilhouette(targetGroup, options = {}) {
  if (!targetGroup) throw new Error("Landmark group is required for silhouette transition");

  const brandMode = options.mode === "brand" || targetGroup.name === "新葡京";
  const fillColor = brandMode ? (options.brandFill ?? 0x16051f) : (options.fill ?? 0x122139);
  const fillOpacity = options.fillOpacity ?? (brandMode ? 0.97 : 0.94);
  const edgeColor = brandMode ? (options.brandEdge ?? 0xff7a3f) : (options.edge ?? 0x6e91bd);
  const edgeOpacity = options.edgeOpacity ?? (brandMode ? 0.42 : 0.5);
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
  const brandMaterials = [];
  const edgeMaterials = [];
  const meshNodes = [];

  silhouette.traverse(object => {
    if (object.isMesh) {
      if (object.geometry?.type === "RingGeometry") {
        object.visible = false;
        return;
      }
      const material = brandMode
        ? createBrandMaterial({ ...options, brandFill: fillColor, fillOpacity })
        : new THREE.MeshBasicMaterial({
            color: fillColor,
            transparent: true,
            opacity: 0,
            depthWrite: true,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
          });
      object.material = material;
      if (brandMode) brandMaterials.push(material);
      else silhouetteMaterials.push(material);
      meshNodes.push(object);
    } else if (object.isLine || object.isLineSegments) {
      const material = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: brandMode ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      object.material = material;
      edgeMaterials.push(material);
    }
  });

  meshNodes.forEach(mesh => {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, brandMode ? 26 : 34),
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
    silhouetteMaterials.forEach(material => { material.opacity = progress * fillOpacity; });
    brandMaterials.forEach(material => { material.uniforms.uProgress.value = progress; });
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
    brandMaterials.forEach(material => { material.uniforms.uProgress.value = 0; });
    edgeMaterials.forEach(material => { material.opacity = 0; });
  }

  function dispose() {
    silhouette.traverse(object => {
      if (object.geometry?.type === "EdgesGeometry") object.geometry.dispose();
      if (object.material && !Array.isArray(object.material)) object.material.dispose();
    });
    silhouette.removeFromParent();
  }

  return { silhouette, setProgress, reset, dispose, mode: brandMode ? "brand" : "silhouette" };
}
