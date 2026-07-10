import * as THREE from "three";

const HEIGHT_SCALE = 1 / 40;

export const LANDMARK_SPECS = [
  {
    id: "macau-tower",
    label: "澳门塔",
    lat: 22.179767,
    lon: 113.536794,
    cameraOffset: [-8.5, 4.8, 10.5],
    lookHeight: 4.2,
    clearance: 2.4
  },
  {
    id: "grand-lisboa",
    label: "新葡京",
    lat: 22.190863,
    lon: 113.543327,
    cameraOffset: [-7.2, 3.8, 9.2],
    lookHeight: 3.2,
    clearance: 2.2
  },
  {
    id: "st-pauls",
    label: "大三巴",
    lat: 22.19758,
    lon: 113.54095,
    cameraOffset: [-5.8, 2.3, 6.2],
    lookHeight: 1.3,
    clearance: 1.8
  },
  {
    id: "cotai",
    label: "路氹酒店群",
    lat: 22.140556,
    lon: 113.563056,
    cameraOffset: [-10.5, 5.6, 12.0],
    lookHeight: 2.6,
    clearance: 5.2
  },
  {
    id: "morpheus",
    label: "摩珀斯",
    lat: 22.15,
    lon: 113.5667,
    cameraOffset: [-7.8, 4.2, 9.0],
    lookHeight: 2.5,
    clearance: 2.4
  },
  {
    id: "airport",
    label: "澳门国际机场",
    lat: 22.150444,
    lon: 113.591509,
    cameraOffset: [-18.0, 7.0, 18.0],
    lookHeight: 1.2,
    clearance: 5.0
  }
];

export function localFromLatLon(lat, lon, meta) {
  const [centerLat, centerLon] = meta.center;
  const scale = meta.scaleMetersPerUnit || 55;
  const x = (lon - centerLon) * 111320 * Math.cos(THREE.MathUtils.degToRad(centerLat)) / scale;
  const z = -(lat - centerLat) * 110540 / scale;
  return new THREE.Vector3(x, 0, z);
}

function material(color, emissive = color, intensity = 0.25, metalness = 0.3, roughness = 0.45) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, metalness, roughness });
}

function glow(color, opacity = 0.95) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
}

function addPlatform(group, radius, color = 0x17243a) {
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.08, 0.16, 48),
    material(color, 0x0b1629, 0.2, 0.25, 0.68)
  );
  platform.position.y = 0.02;
  group.add(platform);
}

function createMacauTower() {
  const group = new THREE.Group();
  group.name = "澳门塔";
  addPlatform(group, 1.1, 0x1a2434);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.24, 6.3, 20),
    material(0xb5c4d8, 0x5f82ad, 0.32, 0.58, 0.3)
  );
  shaft.position.y = 3.2;
  group.add(shaft);

  const pod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.52, 0.52, 32),
    material(0xd7e5f2, 0x79caff, 0.7, 0.46, 0.24)
  );
  pod.position.y = 5.9;
  group.add(pod);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.055, 10, 48), glow(0x79d8ff, 0.9));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 5.92;
  group.add(ring);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.075, 2.1, 12),
    material(0xd6deea, 0x9ebcff, 0.42, 0.5, 0.26)
  );
  mast.position.y = 7.2;
  group.add(mast);

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), glow(0xff4f64));
  beacon.position.y = 8.28;
  group.add(beacon);
  return group;
}

function createGrandLisboa() {
  const group = new THREE.Group();
  group.name = "新葡京";
  addPlatform(group, 1.45, 0x26172c);

  const podium = new THREE.Mesh(
    new THREE.SphereGeometry(0.92, 32, 18),
    material(0x51325f, 0xff72cf, 0.62, 0.56, 0.28)
  );
  podium.scale.set(1.25, 0.62, 1.02);
  podium.position.y = 0.65;
  group.add(podium);

  const profile = [
    [0.44, 0.95], [0.72, 1.45], [0.58, 2.0], [0.43, 2.8],
    [0.36, 3.8], [0.29, 4.9], [0.19, 5.9], [0.07, 6.55]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tower = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 32),
    material(0x7d5a82, 0xffb65e, 0.68, 0.52, 0.25)
  );
  tower.scale.z = 0.78;
  group.add(tower);

  const ribMaterial = new THREE.LineBasicMaterial({ color: 0xffdc7e, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * Math.PI * 2;
    const points = [];
    for (let j = 0; j <= 18; j++) {
      const y = 1.1 + j / 18 * 5.35;
      const t = (y - 1.1) / 5.35;
      const r = THREE.MathUtils.lerp(0.66, 0.07, Math.pow(t, 0.82)) * (1 + Math.sin(t * Math.PI) * 0.18);
      points.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r * 0.76));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ribMaterial));
  }

  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), glow(0xffdf86));
  crown.position.y = 6.65;
  group.add(crown);
  return group;
}

function createStPauls() {
  const group = new THREE.Group();
  group.name = "大三巴";
  addPlatform(group, 1.65, 0x2a241e);

  const stone = material(0xb0906d, 0x6b4930, 0.22, 0.08, 0.78);
  const dark = new THREE.MeshBasicMaterial({ color: 0x07080d });
  const stepMat = material(0x746454, 0x2e241d, 0.1, 0.02, 0.9);

  for (let i = 0; i < 7; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.7 - i * 0.14, 0.09, 0.42), stepMat);
    step.position.set(0, 0.08 + i * 0.08, 0.95 - i * 0.22);
    group.add(step);
  }

  const baseY = 0.68;
  for (const x of [-1.0, -0.5, 0, 0.5, 1.0]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.65, 0.22), stone);
    col.position.set(x, baseY + 0.82, 0);
    group.add(col);
  }

  const bands = [
    [2.25, 0.16, baseY + 0.05], [2.1, 0.14, baseY + 0.82], [1.82, 0.13, baseY + 1.48],
    [1.5, 0.12, baseY + 2.02], [1.05, 0.11, baseY + 2.44]
  ];
  for (const [w, h, y] of bands) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.24), stone);
    band.position.set(0, y, 0);
    group.add(band);
  }

  [1.75, 1.45, 1.05].forEach((w, i) => {
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 0.2), stone);
    block.position.set(0, baseY + 1.68 + i * 0.47, 0);
    group.add(block);
  });

  const openings = [
    [-0.74, baseY + 0.55, 0.25, 0.62], [-0.25, baseY + 0.55, 0.25, 0.62],
    [0.25, baseY + 0.55, 0.25, 0.62], [0.74, baseY + 0.55, 0.25, 0.62],
    [-0.48, baseY + 1.18, 0.22, 0.42], [0, baseY + 1.18, 0.25, 0.45], [0.48, baseY + 1.18, 0.22, 0.42]
  ];
  for (const [x, y, w, h] of openings) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), dark);
    pane.position.set(x, y, 0.125);
    group.add(pane);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(w * 0.5, 0.025, 8, 20, Math.PI), glow(0xd2b38b, 0.55));
    arch.position.set(x, y + h * 0.5, 0.14);
    group.add(arch);
  }
  return group;
}

function createCotaiCluster() {
  const group = new THREE.Group();
  group.name = "路氹酒店群";
  addPlatform(group, 4.6, 0x23192d);

  const gold = material(0x6f4a27, 0xffbd5a, 0.72, 0.48, 0.32);
  const rose = material(0x4b2a49, 0xff6bb0, 0.64, 0.42, 0.34);
  const blue = material(0x243c56, 0x66d8ff, 0.55, 0.5, 0.28);
  const cream = material(0x7f6f59, 0xffdb9c, 0.4, 0.22, 0.58);

  const towers = [
    [-2.6, 1.5, 1.0, 3.2, 1.1, gold], [-1.25, 1.75, 1.25, 3.7, 1.1, rose],
    [0.25, 1.35, 1.4, 2.9, 1.3, cream], [1.85, 1.7, 1.15, 3.6, 1.0, blue],
    [3.0, 1.25, 0.9, 2.7, 0.9, gold]
  ];
  for (const [x, y, w, h, d, mat] of towers) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    tower.position.set(x, y, 0);
    group.add(tower);
  }

  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.65, 24, 12), gold);
  dome.scale.y = 0.55;
  dome.position.set(0.25, 3.05, 0);
  group.add(dome);

  const eiffel = new THREE.Group();
  const legMat = glow(0xffc06a, 0.9);
  const legGeo = new THREE.CylinderGeometry(0.035, 0.08, 2.5, 6);
  [[-0.42, 0], [0.42, 0], [0, -0.34], [0, 0.34]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, 1.25, z);
    leg.rotation.z = -x * 0.22;
    leg.rotation.x = z * 0.24;
    eiffel.add(leg);
  });
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.8, 6), legMat);
  tip.position.y = 2.8;
  eiffel.add(tip);
  eiffel.position.set(-3.35, 0, 1.45);
  eiffel.scale.setScalar(0.82);
  group.add(eiffel);
  return group;
}

function createMorpheus() {
  const group = new THREE.Group();
  group.name = "摩珀斯";
  addPlatform(group, 1.7, 0x202a32);

  const glass = material(0x263848, 0x5e9dbd, 0.38, 0.7, 0.2);
  const frame = new THREE.LineBasicMaterial({ color: 0xe8f2ff, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending });

  const left = new THREE.Mesh(new THREE.BoxGeometry(0.95, 4.1, 1.35), glass);
  left.position.set(-0.72, 2.15, 0);
  const right = left.clone();
  right.position.x = 0.72;
  group.add(left, right);

  [0.65, 2.05, 3.45].forEach((y, index) => {
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(index === 1 ? 1.05 : 1.35, 0.45, 1.28), glass);
    bridge.position.set(0, y, 0);
    group.add(bridge);
  });

  const linePoints = [];
  const yLevels = [0.25, 0.9, 1.55, 2.2, 2.85, 3.5, 4.2];
  for (const z of [-0.71, 0.71]) {
    for (let i = 0; i < yLevels.length - 1; i++) {
      const y0 = yLevels[i];
      const y1 = yLevels[i + 1];
      const flip = i % 2 ? -1 : 1;
      linePoints.push(
        new THREE.Vector3(-1.2 * flip, y0, z), new THREE.Vector3(1.2 * flip, y1, z),
        new THREE.Vector3(1.2 * flip, y0, z), new THREE.Vector3(-1.2 * flip, y1, z)
      );
    }
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePoints), frame));
  return group;
}

function createAirport() {
  const group = new THREE.Group();
  group.name = "澳门国际机场";

  const runway = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.08, 61.1),
    material(0x1f2733, 0x0b0f16, 0.08, 0.18, 0.82)
  );
  runway.position.y = 0.08;
  group.add(runway);

  const edgePositions = [];
  const centerPositions = [];
  for (let i = -30; i <= 30; i += 1.15) edgePositions.push(-0.6, 0.18, i, 0.6, 0.18, i);
  for (let i = -29; i <= 29; i += 2.1) centerPositions.push(0, 0.17, i);

  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));
  group.add(new THREE.Points(edgeGeo, new THREE.PointsMaterial({ color: 0x73d8ff, size: 0.09, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9 })));

  const centerGeo = new THREE.BufferGeometry();
  centerGeo.setAttribute("position", new THREE.Float32BufferAttribute(centerPositions, 3));
  group.add(new THREE.Points(centerGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95 })));

  const terminal = new THREE.Mesh(
    new THREE.BoxGeometry(6.5, 0.75, 1.2),
    material(0x38495d, 0x75c8ff, 0.42, 0.45, 0.35)
  );
  terminal.position.set(-4.2, 0.45, -2.5);
  group.add(terminal);

  const towerShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.25, 2.6, 12),
    material(0xb6c4d3, 0x7ca8d8, 0.26, 0.38, 0.38)
  );
  towerShaft.position.set(-6.0, 1.35, -1.2);
  group.add(towerShaft);

  const cab = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.34, 0.42, 12),
    material(0x416b88, 0x7ee6ff, 0.75, 0.58, 0.22)
  );
  cab.position.set(-6.0, 2.75, -1.2);
  group.add(cab);
  group.rotation.y = THREE.MathUtils.degToRad(-19);
  return group;
}

const BUILDERS = {
  "macau-tower": createMacauTower,
  "grand-lisboa": createGrandLisboa,
  "st-pauls": createStPauls,
  cotai: createCotaiCluster,
  morpheus: createMorpheus,
  airport: createAirport
};

function addLandmarkAura(group, radius, color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.75, radius, 64),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  group.add(ring);
}

export function createHeroLandmarks(meta) {
  const root = new THREE.Group();
  root.name = "macau-hero-landmarks";
  const landmarks = [];

  LANDMARK_SPECS.forEach((spec, index) => {
    const group = BUILDERS[spec.id]();
    const local = localFromLatLon(spec.lat, spec.lon, meta);
    group.position.copy(local);
    group.rotation.y += [0.1, -0.32, 0.18, -0.08, 0.25, 0][index];
    addLandmarkAura(group, Math.min(spec.clearance, 2.8), [0x67d7ff, 0xffb45f, 0xe7c69a, 0xff78c5, 0xa9e8ff, 0x7ad8ff][index]);
    root.add(group);

    landmarks.push({
      id: spec.id,
      label: spec.label,
      position: local.clone(),
      cameraOffset: new THREE.Vector3(...spec.cameraOffset),
      lookHeight: spec.lookHeight,
      clearance: spec.clearance
    });
  });

  root.userData.landmarks = landmarks;
  return root;
}
