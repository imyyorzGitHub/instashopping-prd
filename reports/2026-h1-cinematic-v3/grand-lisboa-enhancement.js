import * as THREE from "three";

function bodyMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x16081d,
    emissive: 0x2a0a28,
    emissiveIntensity: 0.1,
    metalness: 0.34,
    roughness: 0.38
  });
}

function warmEdge(color = 0xff8b4a, opacity = 0.62) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

function createFanPetalGeometry(width = 0.55, height = 3.1) {
  const half = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-0.07, 0);
  shape.bezierCurveTo(-half * 0.55, height * 0.28, -half, height * 0.72, -half * 0.78, height * 0.95);
  shape.bezierCurveTo(-half * 0.4, height * 1.04, half * 0.4, height * 1.04, half * 0.78, height * 0.95);
  shape.bezierCurveTo(half, height * 0.72, half * 0.55, height * 0.28, 0.07, 0);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.13,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 14
  });
  geometry.translate(0, 0, -0.065);
  geometry.computeVertexNormals();
  return geometry;
}

function addOutlinedMesh(parent, geometry, material, edgeMaterial, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 26), edgeMaterial);
  edge.renderOrder = 6;
  mesh.add(edge);
  parent.add(mesh);
  return mesh;
}

function createWingGeometry(direction = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.35 * direction, 0.06, 0.95 * direction, 0.2, 1.38 * direction, 0.55);
  shape.bezierCurveTo(1.08 * direction, 0.92, 0.42 * direction, 1.06, 0, 0.9);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.38,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.05,
    bevelThickness: 0.05,
    curveSegments: 14
  });
  geometry.translate(0, 0, -0.19);
  return geometry;
}

function createRibbonCurve(side = 1) {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.12 * side, 1.2, 0.18),
    new THREE.Vector3(0.35 * side, 2.35, 0.12),
    new THREE.Vector3(0.7 * side, 3.85, 0.08),
    new THREE.Vector3(1.12 * side, 5.25, 0.04),
    new THREE.Vector3(1.38 * side, 6.25, 0)
  ], false, "centripetal");
}

export function enhanceGrandLisboa(heroRoot) {
  const group = heroRoot?.getObjectByName("新葡京");
  if (!group || group.userData.brandEnhancedV2) return group;
  group.userData.brandEnhancedV2 = true;

  group.traverse(object => {
    if (!object.isMesh || !object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => {
      if (material.color) material.color.set(0x17091e);
      if (material.emissive) {
        material.emissive.set(0x2b0a2b);
        material.emissiveIntensity = Math.min(material.emissiveIntensity ?? 0.1, 0.12);
      }
      if ("roughness" in material) material.roughness = 0.42;
      if ("metalness" in material) material.metalness = 0.28;
      material.needsUpdate = true;
    });
  });

  const oldPetals = group.getObjectByName("新葡京莲瓣轮廓");
  if (oldPetals) oldPetals.removeFromParent();

  const dark = bodyMaterial();
  const orangeEdge = warmEdge(0xff914f, 0.72);
  const magentaEdge = warmEdge(0xff4c9a, 0.48);

  const architecture = new THREE.Group();
  architecture.name = "新葡京识别轮廓V2";

  const lowerCore = addOutlinedMesh(
    architecture,
    new THREE.SphereGeometry(1.02, 40, 20),
    dark,
    magentaEdge,
    "新葡京下部圆顶"
  );
  lowerCore.scale.set(1.38, 0.58, 0.96);
  lowerCore.position.y = 0.72;

  const leftWing = addOutlinedMesh(architecture, createWingGeometry(-1), dark, orangeEdge, "新葡京左裙楼");
  leftWing.position.set(-0.45, 0.22, 0.02);
  leftWing.scale.set(1.12, 0.88, 1);
  const rightWing = addOutlinedMesh(architecture, createWingGeometry(1), dark, orangeEdge, "新葡京右裙楼");
  rightWing.position.set(0.45, 0.22, 0.02);
  rightWing.scale.set(1.12, 0.88, 1);

  const stemProfile = [
    [0.5, 0], [0.58, 0.5], [0.46, 1.25], [0.34, 2.15],
    [0.29, 3.15], [0.25, 4.15], [0.2, 4.65]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const stem = addOutlinedMesh(
    architecture,
    new THREE.LatheGeometry(stemProfile, 40),
    dark,
    magentaEdge,
    "新葡京中央塔身"
  );
  stem.position.y = 1.28;
  stem.scale.z = 0.78;

  const fan = new THREE.Group();
  fan.name = "新葡京莲花塔冠";
  const count = 9;
  for (let index = 0; index < count; index++) {
    const t = index / (count - 1);
    const spread = THREE.MathUtils.lerp(-1, 1, t);
    const petal = addOutlinedMesh(
      fan,
      createFanPetalGeometry(0.5 + (1 - Math.abs(spread)) * 0.16, 2.75 + (1 - Math.abs(spread)) * 0.25),
      dark,
      index % 2 ? magentaEdge : orangeEdge,
      `新葡京塔冠莲瓣-${index + 1}`
    );
    petal.position.set(spread * 0.56, 0, -Math.abs(spread) * 0.08);
    petal.rotation.z = THREE.MathUtils.degToRad(spread * -24);
    petal.rotation.y = THREE.MathUtils.degToRad(spread * 8);
    petal.scale.set(0.9 + (1 - Math.abs(spread)) * 0.15, 1, 1);
  }
  fan.position.y = 4.15;
  architecture.add(fan);

  const crown = addOutlinedMesh(
    architecture,
    new THREE.SphereGeometry(0.2, 20, 12),
    dark,
    orangeEdge,
    "新葡京塔冠核心"
  );
  crown.scale.set(1.3, 0.9, 0.9);
  crown.position.y = 6.9;

  const mast = addOutlinedMesh(
    architecture,
    new THREE.CylinderGeometry(0.035, 0.065, 0.72, 12),
    dark,
    orangeEdge,
    "新葡京尖顶"
  );
  mast.position.y = 7.28;

  for (const side of [-1, 1]) {
    const ribbon = new THREE.Mesh(
      new THREE.TubeGeometry(createRibbonCurve(side), 48, 0.025, 8, false),
      new THREE.MeshBasicMaterial({
        color: side > 0 ? 0xff8d4a : 0xff4d98,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ribbon.name = side > 0 ? "新葡京暖色轮廓" : "新葡京洋红轮廓";
    architecture.add(ribbon);
  }

  architecture.position.set(0, 0.02, 0.02);
  group.add(architecture);
  group.userData.brandModelAudit = {
    version: 2,
    silhouette: "lotus-fan-with-podium-and-spire",
    fanPetals: count,
    dualRim: true,
    darkVolume: true
  };

  return group;
}
