import * as THREE from "three";

function bodyMaterial(color = 0x16081d, emissive = 0x2a0a28, intensity = 0.1) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, metalness: 0.34, roughness: 0.38 });
}

function warmEdge(color = 0xff8b4a, opacity = 0.62) {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
}

function brandizeGroup(group, options = {}) {
  if (!group) return;
  group.traverse(object => {
    if (!object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => {
      if (material.color) material.color.set(options.color ?? 0x17091e);
      if (material.emissive) {
        material.emissive.set(options.emissive ?? 0x2b0a2b);
        material.emissiveIntensity = Math.min(material.emissiveIntensity ?? 0.1, options.emissiveIntensity ?? 0.13);
      }
      if ("roughness" in material) material.roughness = options.roughness ?? 0.42;
      if ("metalness" in material) material.metalness = options.metalness ?? 0.28;
      material.needsUpdate = true;
    });
  });
}

function addOutlinedMesh(parent, geometry, material, edgeMaterial, name, threshold = 26) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, threshold), edgeMaterial);
  edge.renderOrder = 6;
  mesh.add(edge);
  parent.add(mesh);
  return mesh;
}

function addTube(parent, points, radius, material, name) {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, radius, 8, false), material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function createFanPetalGeometry(width = 0.55, height = 3.1) {
  const half = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-0.07, 0);
  shape.bezierCurveTo(-half * 0.55, height * 0.28, -half, height * 0.72, -half * 0.78, height * 0.95);
  shape.bezierCurveTo(-half * 0.4, height * 1.04, half * 0.4, height * 1.04, half * 0.78, height * 0.95);
  shape.bezierCurveTo(half, height * 0.72, half * 0.55, height * 0.28, 0.07, 0);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.13, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.025, bevelThickness: 0.025, curveSegments: 14 });
  geometry.translate(0, 0, -0.065);
  geometry.computeVertexNormals();
  return geometry;
}

function createWingGeometry(direction = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.35 * direction, 0.06, 0.95 * direction, 0.2, 1.38 * direction, 0.55);
  shape.bezierCurveTo(1.08 * direction, 0.92, 0.42 * direction, 1.06, 0, 0.9);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.38, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.05, bevelThickness: 0.05, curveSegments: 14 });
  geometry.translate(0, 0, -0.19);
  return geometry;
}

function createRibbonCurve(side = 1) {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.12 * side, 1.2, 0.18), new THREE.Vector3(0.35 * side, 2.35, 0.12),
    new THREE.Vector3(0.7 * side, 3.85, 0.08), new THREE.Vector3(1.12 * side, 5.25, 0.04),
    new THREE.Vector3(1.38 * side, 6.25, 0)
  ], false, "centripetal");
}

function enhanceLisboa(group) {
  if (!group || group.userData.brandEnhancedV3) return;
  group.userData.brandEnhancedV3 = true;
  brandizeGroup(group);
  const oldV2 = group.getObjectByName("新葡京识别轮廓V2");
  if (oldV2) oldV2.removeFromParent();
  const oldPetals = group.getObjectByName("新葡京莲瓣轮廓");
  if (oldPetals) oldPetals.removeFromParent();

  const dark = bodyMaterial();
  const orangeEdge = warmEdge(0xff914f, 0.72);
  const magentaEdge = warmEdge(0xff4c9a, 0.48);
  const architecture = new THREE.Group();
  architecture.name = "新葡京识别轮廓V3";

  const lowerCore = addOutlinedMesh(architecture, new THREE.SphereGeometry(1.02, 40, 20), dark, magentaEdge, "新葡京下部圆顶");
  lowerCore.scale.set(1.38, 0.58, 0.96);
  lowerCore.position.y = 0.72;
  const leftWing = addOutlinedMesh(architecture, createWingGeometry(-1), dark, orangeEdge, "新葡京左裙楼");
  leftWing.position.set(-0.45, 0.22, 0.02);
  leftWing.scale.set(1.12, 0.88, 1);
  const rightWing = addOutlinedMesh(architecture, createWingGeometry(1), dark, orangeEdge, "新葡京右裙楼");
  rightWing.position.set(0.45, 0.22, 0.02);
  rightWing.scale.set(1.12, 0.88, 1);

  const stemProfile = [[0.5,0],[0.58,0.5],[0.46,1.25],[0.34,2.15],[0.29,3.15],[0.25,4.15],[0.2,4.65]].map(([r,y]) => new THREE.Vector2(r,y));
  const stem = addOutlinedMesh(architecture, new THREE.LatheGeometry(stemProfile, 40), dark, magentaEdge, "新葡京中央塔身");
  stem.position.y = 1.28;
  stem.scale.z = 0.78;

  const fan = new THREE.Group();
  fan.name = "新葡京莲花塔冠";
  const count = 9;
  for (let index = 0; index < count; index++) {
    const spread = THREE.MathUtils.lerp(-1, 1, index / (count - 1));
    const petal = addOutlinedMesh(fan, createFanPetalGeometry(0.5 + (1 - Math.abs(spread)) * 0.16, 2.75 + (1 - Math.abs(spread)) * 0.25), dark, index % 2 ? magentaEdge : orangeEdge, `新葡京塔冠莲瓣-${index + 1}`);
    petal.position.set(spread * 0.56, 0, -Math.abs(spread) * 0.08);
    petal.rotation.z = THREE.MathUtils.degToRad(spread * -24);
    petal.rotation.y = THREE.MathUtils.degToRad(spread * 8);
    petal.scale.set(0.9 + (1 - Math.abs(spread)) * 0.15, 1, 1);
  }
  fan.position.y = 4.15;
  architecture.add(fan);
  const crown = addOutlinedMesh(architecture, new THREE.SphereGeometry(0.2, 20, 12), dark, orangeEdge, "新葡京塔冠核心");
  crown.scale.set(1.3, 0.9, 0.9);
  crown.position.y = 6.9;
  const mast = addOutlinedMesh(architecture, new THREE.CylinderGeometry(0.035, 0.065, 0.72, 12), dark, orangeEdge, "新葡京尖顶");
  mast.position.y = 7.28;
  for (const side of [-1, 1]) {
    const ribbon = new THREE.Mesh(new THREE.TubeGeometry(createRibbonCurve(side), 48, 0.025, 8, false), new THREE.MeshBasicMaterial({ color: side > 0 ? 0xff8d4a : 0xff4d98, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    ribbon.name = side > 0 ? "新葡京暖色轮廓" : "新葡京洋红轮廓";
    architecture.add(ribbon);
  }
  architecture.position.set(0, 0.02, 0.02);
  group.add(architecture);
  group.userData.brandModelAudit = { version: 3, silhouette: "lotus-fan-with-podium-and-spire", fanPetals: count, dualRim: true, darkVolume: true };
}

function createStPaulsFacadeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-1.42,0); shape.lineTo(1.42,0); shape.lineTo(1.42,0.92); shape.lineTo(1.18,0.92);
  shape.lineTo(1.18,1.72); shape.lineTo(0.94,1.72); shape.lineTo(0.94,2.32); shape.lineTo(0.62,2.32);
  shape.lineTo(0.62,2.72); shape.lineTo(0,3.28); shape.lineTo(-0.62,2.72); shape.lineTo(-0.62,2.32);
  shape.lineTo(-0.94,2.32); shape.lineTo(-0.94,1.72); shape.lineTo(-1.18,1.72); shape.lineTo(-1.18,0.92);
  shape.lineTo(-1.42,0.92); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false, curveSegments: 2 });
  geometry.translate(0, 0, -0.15);
  return geometry;
}

function enhanceStPauls(group) {
  if (!group || group.userData.brandEnhanced) return;
  group.userData.brandEnhanced = true;
  brandizeGroup(group, { color: 0x1a0d19, emissive: 0x351321, emissiveIntensity: 0.09, roughness: 0.52 });
  const dark = bodyMaterial(0x1a0d19, 0x351321, 0.09);
  const orange = warmEdge(0xffa25f, 0.68);
  const magenta = warmEdge(0xff5b98, 0.34);
  const architecture = new THREE.Group();
  architecture.name = "大三巴识别轮廓";
  const facade = addOutlinedMesh(architecture, createStPaulsFacadeGeometry(), dark, orange, "大三巴五层立面", 18);
  facade.position.y = 0.46;
  facade.position.z = -0.12;
  for (const x of [-0.92,-0.46,0,0.46,0.92]) {
    const column = addOutlinedMesh(architecture, new THREE.BoxGeometry(0.1,1.52,0.34), dark, magenta, "大三巴立柱", 12);
    column.position.set(x,1.36,0.1);
  }
  [1.08,1.82,2.42].forEach((y,index) => {
    const band = addOutlinedMesh(architecture, new THREE.BoxGeometry(2.38-index*0.5,0.09,0.36), dark, orange, "大三巴横向层级", 12);
    band.position.set(0,y,0.11);
  });
  const rose = addOutlinedMesh(architecture, new THREE.TorusGeometry(0.24,0.035,10,28), bodyMaterial(0x260b20,0x4b143b,0.12), magenta, "大三巴玫瑰窗", 16);
  rose.position.set(0,2.36,0.2);
  architecture.position.z = 0.02;
  group.add(architecture);
  group.scale.multiplyScalar(1.08);
  group.userData.brandModelAudit = { version: 2, silhouette: "five-tier-facade", steppedTop: true, warmRim: true };
}

function createHotelTowerShape(width, height, crown = 0.3) {
  const half = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half,0); shape.lineTo(half,0); shape.lineTo(half,height-crown);
  shape.quadraticCurveTo(half*0.55,height,0,height); shape.quadraticCurveTo(-half*0.55,height,-half,height-crown); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.58, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 1 });
  geometry.translate(0,0,-0.29);
  return geometry;
}

function enhanceCotai(group) {
  if (!group || group.userData.brandEnhanced) return;
  group.userData.brandEnhanced = true;
  brandizeGroup(group);
  const dark = bodyMaterial();
  const orange = warmEdge(0xff9b54,0.62);
  const magenta = warmEdge(0xff4f9c,0.38);
  const skyline = new THREE.Group();
  skyline.name = "路氹品牌天际线";
  const towers = [[-2.8,0.82,3.0,0.2,orange],[-1.48,1.08,3.9,0.32,magenta],[0,1.28,3.2,0.5,orange],[1.55,1.0,4.1,0.28,magenta],[2.75,0.78,2.85,0.22,orange]];
  for (const [x,width,height,crown,edge] of towers) {
    const tower = addOutlinedMesh(skyline, createHotelTowerShape(width,height,crown), dark, edge, "路氹酒店塔楼", 18);
    tower.position.set(x,0.18,0);
  }
  const dome = addOutlinedMesh(skyline, new THREE.SphereGeometry(0.66,30,14,0,Math.PI*2,0,Math.PI*0.54), dark, orange, "路氹中央穹顶", 18);
  dome.scale.set(1.35,0.7,1); dome.position.set(0,3.18,0.02);
  const base = addOutlinedMesh(skyline, new THREE.BoxGeometry(6.8,0.48,1.1), dark, magenta, "路氹综合体裙楼", 12);
  base.position.set(0,0.28,0);
  for (const x of [-2.35,-1.15,0,1.15,2.35]) {
    const crown = addOutlinedMesh(skyline, new THREE.ConeGeometry(0.14,0.42,8), dark, orange, "路氹塔冠", 10);
    crown.position.set(x,3.48-Math.abs(x)*0.12,0);
  }
  group.add(skyline);
  group.userData.brandModelAudit = { version: 2, silhouette: "layered-resort-skyline", towers: towers.length, dome: true, warmRim: true };
}

function createMorpheusLobe(side) {
  const shape = new THREE.Shape();
  shape.moveTo(0.28*side,0); shape.lineTo(1.25*side,0); shape.lineTo(1.25*side,4.55); shape.lineTo(0.48*side,4.55);
  shape.bezierCurveTo(0.72*side,3.8,0.36*side,3.15,0.62*side,2.45);
  shape.bezierCurveTo(0.3*side,1.78,0.7*side,1.04,0.28*side,0); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1.15, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1, curveSegments: 12 });
  geometry.translate(0,0,-0.575);
  return geometry;
}

function enhanceMorpheus(group) {
  if (!group || group.userData.brandEnhanced) return;
  group.userData.brandEnhanced = true;
  group.children.forEach(child => { if (child.isMesh && child.geometry?.type === "BoxGeometry") child.visible = false; });
  brandizeGroup(group);
  const dark = bodyMaterial(0x15091d,0x2d0b31,0.11);
  const orange = warmEdge(0xff9552,0.62);
  const magenta = warmEdge(0xff4c9e,0.44);
  const architecture = new THREE.Group();
  architecture.name = "摩珀斯外骨骼";
  addOutlinedMesh(architecture, createMorpheusLobe(-1), dark, magenta, "摩珀斯左塔", 18);
  addOutlinedMesh(architecture, createMorpheusLobe(1), dark, orange, "摩珀斯右塔", 18);
  [0.62,2.18,3.82].forEach((y,index) => {
    const bridge = addOutlinedMesh(architecture, new THREE.BoxGeometry(index===1?0.82:1.12,0.34,1.08), dark, index%2?magenta:orange, "摩珀斯空中桥", 12);
    bridge.position.set(0,y,0);
  });
  const tubeMatA = new THREE.MeshBasicMaterial({ color: 0xff8d4d, transparent: true, opacity: 0.74, blending: THREE.AdditiveBlending, depthWrite: false });
  const tubeMatB = new THREE.MeshBasicMaterial({ color: 0xff4c9b, transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthWrite: false });
  addTube(architecture,[new THREE.Vector3(-1.18,0.1,0.62),new THREE.Vector3(0.1,1.3,0.62),new THREE.Vector3(-0.45,2.5,0.62),new THREE.Vector3(1.18,4.45,0.62)],0.035,tubeMatA,"摩珀斯前侧外骨骼");
  addTube(architecture,[new THREE.Vector3(1.18,0.1,-0.62),new THREE.Vector3(-0.15,1.5,-0.62),new THREE.Vector3(0.48,2.75,-0.62),new THREE.Vector3(-1.18,4.45,-0.62)],0.035,tubeMatB,"摩珀斯后侧外骨骼");
  group.add(architecture);
  group.scale.multiplyScalar(1.16);
  group.userData.brandModelAudit = { version: 2, silhouette: "voided-exoskeleton", openCore: true, skyBridges: 3, diagonalFrame: true };
}

function enhanceAirport(group) {
  if (!group || group.userData.brandEnhanced) return;
  group.userData.brandEnhanced = true;
  group.children.forEach(child => {
    if (child.isMesh && child.geometry?.type === "BoxGeometry") {
      const { depth = 0 } = child.geometry.parameters || {};
      if (depth > 20) child.visible = false;
    }
  });
  brandizeGroup(group, { color: 0x160b1b, emissive: 0x311020, emissiveIntensity: 0.08 });
  const dark = bodyMaterial(0x160b1b,0x311020,0.08);
  const orange = warmEdge(0xffa15b,0.64);
  const magenta = warmEdge(0xff4f96,0.34);
  const architecture = new THREE.Group();
  architecture.name = "澳门机场品牌构图";
  const runway = addOutlinedMesh(architecture,new THREE.BoxGeometry(1.25,0.08,17),dark,orange,"澳门机场透视跑道",12);
  runway.position.set(2.15,0.08,0.8);
  const terminal = addOutlinedMesh(architecture,new THREE.BoxGeometry(6.2,0.72,1.35),dark,magenta,"澳门机场航站楼",12);
  terminal.position.set(-2.35,0.44,-2.2);
  const roof = addOutlinedMesh(architecture,new THREE.CylinderGeometry(0.72,0.72,6.2,24,1,false,0,Math.PI),dark,orange,"澳门机场弧形屋顶",14);
  roof.rotation.z = Math.PI/2; roof.rotation.y = Math.PI/2; roof.position.set(-2.35,0.82,-2.2);
  for (let index=-7; index<=7; index++) {
    const z = index*1.05+0.8;
    for (const x of [1.62,2.68]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.055,8,6), new THREE.MeshBasicMaterial({ color: index%2?0xffc078:0xff7d68, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false }));
      lamp.position.set(x,0.16,z); architecture.add(lamp);
    }
  }
  const tower = addOutlinedMesh(architecture,new THREE.CylinderGeometry(0.16,0.24,2.5,12),dark,magenta,"澳门机场塔台",12);
  tower.position.set(-5.35,1.35,-1.6);
  const cab = addOutlinedMesh(architecture,new THREE.CylinderGeometry(0.42,0.32,0.42,12),dark,orange,"澳门机场塔台驾驶舱",12);
  cab.position.set(-5.35,2.78,-1.6);
  architecture.rotation.y = THREE.MathUtils.degToRad(-18);
  group.add(architecture);
  group.scale.set(0.9,0.9,0.9);
  group.userData.brandModelAudit = { version: 2, silhouette: "terminal-runway-perspective", runwayLength: 17, terminalRoof: "arched", floatingBarRemoved: true };
}

function enhanceMacauTower(group) {
  if (!group || group.userData.brandEnhanced) return;
  group.userData.brandEnhanced = true;
  brandizeGroup(group, { color: 0x170a1d, emissive: 0x2f0b2c, emissiveIntensity: 0.1 });
  const dark = bodyMaterial(0x170a1d,0x2f0b2c,0.1);
  const orange = warmEdge(0xff9a55,0.68);
  const magenta = warmEdge(0xff4f9a,0.42);
  const architecture = new THREE.Group();
  architecture.name = "澳门塔品牌轮廓";
  const pod = addOutlinedMesh(architecture,new THREE.CylinderGeometry(0.82,0.58,0.58,36),dark,orange,"澳门塔观景舱",18);
  pod.position.y = 5.92;
  const upperRing = addOutlinedMesh(architecture,new THREE.TorusGeometry(0.83,0.055,10,48),dark,magenta,"澳门塔上环",16);
  upperRing.rotation.x = Math.PI/2; upperRing.position.y = 6.18;
  const lowerRing = addOutlinedMesh(architecture,new THREE.TorusGeometry(0.72,0.045,10,48),dark,orange,"澳门塔下环",16);
  lowerRing.rotation.x = Math.PI/2; lowerRing.position.y = 5.62;
  for (const angle of [-0.38,0,0.38]) {
    const leg = addOutlinedMesh(architecture,new THREE.CylinderGeometry(0.07,0.14,2.2,12),dark,angle===0?magenta:orange,"澳门塔三脚基座",12);
    leg.position.set(Math.sin(angle)*0.44,1.05,Math.cos(angle)*0.24); leg.rotation.z = angle*0.55;
  }
  group.add(architecture);
  group.scale.multiplyScalar(1.1);
  group.userData.brandModelAudit = { version: 2, silhouette: "tower-with-layered-observation-pod", observationRings: 2, tripodBase: true };
}

export function enhanceGrandLisboa(heroRoot) {
  if (!heroRoot) return null;
  const lisboa = heroRoot.getObjectByName("新葡京");
  enhanceLisboa(lisboa);
  enhanceStPauls(heroRoot.getObjectByName("大三巴"));
  enhanceCotai(heroRoot.getObjectByName("路氹酒店群"));
  enhanceMorpheus(heroRoot.getObjectByName("摩珀斯"));
  enhanceAirport(heroRoot.getObjectByName("澳门国际机场"));
  enhanceMacauTower(heroRoot.getObjectByName("澳门塔"));
  heroRoot.userData.brandHeroAudit = { version: 2, enhanced: ["新葡京","大三巴","路氹酒店群","摩珀斯","澳门国际机场","澳门塔"], sharedLanguage: "deep-plum-volume-with-orange-magenta-rim" };
  return lisboa;
}
