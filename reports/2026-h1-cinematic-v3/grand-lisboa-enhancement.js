import * as THREE from "three";

function createPetalGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.18, 0.45, 0.62, 1.25, 0.76, 2.35);
  shape.bezierCurveTo(0.9, 3.35, 0.62, 4.45, 0.18, 5.2);
  shape.bezierCurveTo(0.08, 5.38, 0.025, 5.24, 0, 5.02);
  shape.lineTo(0, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.085,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    curveSegments: 12
  });
  geometry.translate(0, 0, -0.0425);
  geometry.computeVertexNormals();
  return geometry;
}

export function enhanceGrandLisboa(heroRoot) {
  const group = heroRoot?.getObjectByName("新葡京");
  if (!group || group.userData.brandEnhanced) return group;
  group.userData.brandEnhanced = true;

  const petalGeometry = createPetalGeometry();
  const petalMaterial = new THREE.MeshStandardMaterial({
    color: 0x35133e,
    emissive: 0x4f1745,
    emissiveIntensity: 0.34,
    metalness: 0.34,
    roughness: 0.31
  });
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xff8a4a,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const petals = new THREE.Group();
  petals.name = "新葡京莲瓣轮廓";
  const count = 12;
  for (let index = 0; index < count; index++) {
    const angle = index / count * Math.PI * 2;
    const mesh = new THREE.Mesh(petalGeometry, petalMaterial);
    const frontWeight = 0.86 + Math.cos(angle) * 0.09;
    mesh.scale.set(frontWeight, 0.92 + (index % 3) * 0.025, 1);
    mesh.position.set(Math.cos(angle) * 0.2, 1.05 + (index % 2) * 0.035, Math.sin(angle) * 0.16);
    mesh.rotation.y = -angle;
    mesh.rotation.z = THREE.MathUtils.degToRad((index % 2 ? 1 : -1) * 2.2);

    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(petalGeometry, 28), edgeMaterial);
    edge.renderOrder = 4;
    mesh.add(edge);
    petals.add(mesh);
  }
  group.add(petals);

  const podium = group.children.find(child => child.isMesh && child.geometry?.type === "SphereGeometry");
  if (podium) {
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(podium.geometry),
      new THREE.LineBasicMaterial({
        color: 0xff5f9b,
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    wire.scale.copy(podium.scale);
    wire.position.copy(podium.position);
    wire.renderOrder = 5;
    group.add(wire);
  }

  const mastMaterial = new THREE.MeshStandardMaterial({
    color: 0x35133e,
    emissive: 0xff6a52,
    emissiveIntensity: 0.5,
    metalness: 0.42,
    roughness: 0.28
  });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.055, 0.78, 10), mastMaterial);
  mast.position.y = 7.03;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), mastMaterial);
  finial.position.y = 7.43;
  group.add(mast, finial);

  return group;
}
