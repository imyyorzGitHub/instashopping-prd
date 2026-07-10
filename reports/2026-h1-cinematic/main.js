import * as THREE from "three";

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const canvas = $("scene");
const title = $("title");
const reportPanel = $("report-panel");
const panelKicker = $("panel-kicker");
const panelTitle = $("panel-title");
const panelBody = $("panel-body");
const panelMetrics = $("panel-metrics");
const progressValue = $("progress-value");
const progressBar = $("progress-bar");
const prevButton = $("chapter-prev");
const nextButton = $("chapter-next");
const chapterCount = $("chapter-count");
const skipButton = $("skip-flight");
const flightStatus = $("flight-status");
const speedLines = $("speed-lines");
const dawnGlow = $("dawn-glow");
const endTitle = $("end-title");
const meteorLayer = $("meteor-layer");

document.documentElement.dataset.h1Build = "street-flight-v2-clean";

const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const damp = (rate, dt) => 1 - Math.exp(-rate * Math.max(0.001, dt));
const vec = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const hash = (n) => {
  const x = Math.sin(n * 127.13 + 41.77) * 43758.5453;
  return x - Math.floor(x);
};

const reportPages = [
  null,
  {
    type: "performance",
    landmark: "tower",
    kicker: "业绩快照",
    title: "Q1 超挑战收官，Q2 信心起点",
    body: "大盘交易额 3,079 万、KA 交易额 1,544 万、拉回净增 4,480 均超挑战完成。毛利额 72 万未达标，暴露了转化与投放效率的瓶颈。",
    metrics: [
      ["3,079万", "大盘有效交易额", "目标 2,958 万 · 超挑战"],
      ["1,544万", "KA 有效交易额", "目标 1,361 万 · 超挑战"],
      ["4,480", "拉回净增用户", "目标 1,300 · 超挑战"],
      ["72万", "线上毛利额", "目标 91 万 · 瓶颈暴露"]
    ]
  },
  {
    type: "situation",
    landmark: "lisboa",
    kicker: "Situation · 瓶颈分析",
    title: "Q1 之后，真正要解决的是链路瓶颈",
    body: "交易增长证明方向有效，但用户搜到后买不到、频道内发现效率低、商家投放门槛高，开始成为下一阶段增长约束。",
    metrics: [
      ["搜索转化", "搜到，但不一定买到", "结果呈现与加购仍有空间"],
      ["发现效率", "入口仍然单一", "过度依赖首页曝光"],
      ["投放门槛", "商家难以自助调价", "毛利与曝光效率受限"]
    ]
  },
  {
    type: "mapping",
    landmark: "ruins",
    kicker: "Task · OKR 映射",
    title: "OKR 不是散点，而是一条链路同时拉动",
    body: "把搜索入口、输入、结果、调权和转化串起来，让交易额、用户渗透、中腰部增长、毛利和 NPS 一起被拉动。",
    rows: [
      ["交易额 3,300万", "入口、结果、转化共同提升搜索成交", "交易额"],
      ["渗透率 13.2%", "热搜、常买、品类推荐降低进入门槛", "渗透"],
      ["中腰部 225万", "搜索广告位与投放工具增加曝光", "商家"],
      ["毛利额 72万", "推广自动定价提升投放效率", "毛利"],
      ["NPS 5", "减少无效搜索与加购路径", "体验"]
    ]
  },
  {
    type: "action",
    landmark: "cotai",
    kicker: "Action · 全链路优化",
    title: "我做的不是项目清单，而是一条搜索与加购链路",
    body: "先铺入口、结果、调权、转化基础设施，再补齐关键词承接与自动定价，让搜索链路从能用走向可运营。",
    rows: [
      ["入口", "热搜 / 常买 / 品类推荐", "渗透率 ↑ · 交易额 ↑"],
      ["输入", "关键词输入页增加运营模块", "搜索门槛 ↓"],
      ["结果", "商品列表 + 综合搜索广告位", "曝光与转化 ↑"],
      ["调权", "搜索词加权与推广自动定价", "毛利效率 ↑"],
      ["转化", "推荐搭配覆盖点餐与搜索页", "加购转化 ↑"]
    ]
  },
  {
    type: "result",
    landmark: "morpheus",
    kicker: "Result · 数据回望",
    title: "数据回望：用结果证明链路有效",
    body: "以下仍是版式占位数据，正式述职前必须替换为确认真实值。",
    metrics: [
      ["3,380万", "大盘有效交易额", "目标 3,300万 · 待替换"],
      ["78万", "线上毛利额", "目标 72万 · 待替换"],
      ["290万", "中腰部增长额", "目标 225万 · 待替换"],
      ["13.5%", "用户渗透率", "目标 13.2% · 待替换"],
      ["NPS 8", "体验指标", "目标 5 · 待替换"]
    ]
  },
  {
    type: "roadmap",
    landmark: "airport",
    kicker: "Q3 展望",
    title: "搜索链路已通，下一步让每条链路更聪明",
    body: "从链路打通走向精细化运营，继续推进综合搜索、热门商品召回、场景推荐和点金推广综合分拆分。",
    rows: [
      ["8.7", "综合搜索 2 期：意图识别与结果承接", ""],
      ["召回", "热门商品召回：补齐搜索供给", ""],
      ["推荐", "场景驱动推荐：搜索与加购协同", ""],
      ["分拆", "点金推广综合分拆分落地", ""]
    ]
  }
];

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x160718, 0.0065);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const aircraftRoot = new THREE.Group();
const cameraLookRig = new THREE.Group();
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 1600);
aircraftRoot.add(cameraLookRig);
cameraLookRig.add(camera);
scene.add(aircraftRoot);

scene.add(new THREE.HemisphereLight(0xffe9de, 0x17001e, 1.05));
const keyLight = new THREE.DirectionalLight(0xff8cab, 2.1);
keyLight.position.set(-20, 60, 30);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffc27a, 1.25);
fillLight.position.set(50, 30, -60);
scene.add(fillLight);

function frameQuaternion(direction, upHint = new THREE.Vector3(0, 1, 0)) {
  const forward = direction.clone().normalize();
  let up = upHint.clone().sub(forward.clone().multiplyScalar(upHint.dot(forward)));
  if (up.lengthSq() < 0.0001) up.set(0, 0, 1);
  up.normalize();
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();
  up = new THREE.Vector3().crossVectors(right, forward).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(right, up, forward.clone().negate())
  );
}

const docks = [
  { id: "space", position: [0, 76, 72], look: [0, 0, 0], fov: 54 },
  { id: "tower", position: [-22.9, 4.3, 8.2], look: [-17.57, 8.8, 12.16], fov: 50, shift: [0.28, -0.22] },
  { id: "lisboa", position: [-17.3, 4.0, 15.4], look: [-12.31, 9.2, 19.61], fov: 49, shift: [0.28, -0.08] },
  { id: "ruins", position: [-17.2, 3.8, 21.0], look: [-13.8, 6.6, 24.0], fov: 48, shift: [0.30, -0.04] },
  { id: "cotai", position: [7.6, 3.8, -20.0], look: [2.8, 6.6, -15.0], fov: 49, shift: [0.30, -0.05] },
  { id: "morpheus", position: [8.8, 3.8, -16.2], look: [4.2, 7.0, -12.8], fov: 49, shift: [0.30, -0.08] },
  { id: "airport", position: [23.0, 3.9, -15.8], look: [18.0, 7.0, -11.4], fov: 50, shift: [0.28, -0.04] },
  { id: "solar", position: [52, 80, 78], look: [70, 86, 106], fov: 62 }
];

const legData = [
  [[0,76,72],[4,62,58],[7,42,43],[-2,27,33],[-12,17,23],[-18,9,15],[-22,6,10],[-22.9,4.3,8.2]],
  [[-22.9,4.3,8.2],[-22.2,4.2,9.8],[-21,4,11.6],[-19.6,3.9,13.2],[-18.4,3.9,14.4],[-17.3,4,15.4]],
  [[-17.3,4,15.4],[-17.8,3.9,17],[-18,3.8,18.8],[-17.6,3.8,20],[-17.2,3.8,21]],
  [[-17.2,3.8,21],[-18.4,4,18.2],[-19.2,4.2,15],[-19,4,11],[-16.8,3.8,6],[-13,3.6,1],[-9,3.5,-3.5],[-5,3.4,-7.5],[-1,3.3,-10],[2,3.4,-13],[5,3.6,-17],[7.6,3.8,-20]],
  [[7.6,3.8,-20],[6,3.7,-21.2],[3.5,3.6,-21.6],[1,3.5,-20],[0.5,3.5,-17],[2.5,3.6,-14.7],[5.5,3.7,-14],[7.5,3.8,-15],[8.8,3.8,-16.2]],
  [[8.8,3.8,-16.2],[10.5,3.8,-15],[12.5,3.7,-13],[14.5,3.7,-10.5],[17,3.7,-8.5],[20,3.8,-10.5],[22,3.9,-13],[23,3.9,-15.8]],
  [[23,3.9,-15.8],[24,4.5,-13],[25,8,-8],[27,15,0],[32,30,18],[42,55,45],[52,80,78]]
];

const legs = legData.map((points, index) => {
  const curve = new THREE.CatmullRomCurve3(points.map(vec), false, "centripetal", 0.5);
  return { index, curve, length: curve.getLength(), street: index > 0 && index < 6 };
});

const world = new THREE.Group();
scene.add(world);

const water = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.MeshStandardMaterial({ color: 0x3c0a38, roughness: 0.72, metalness: 0.05, transparent: true, opacity: 0.72 })
);
water.rotation.x = -Math.PI / 2;
water.position.y = -0.35;
world.add(water);

const landMaterial = new THREE.MeshStandardMaterial({ color: 0x18091e, roughness: 0.85, metalness: 0.04 });
function addIsland(x, z, sx, sz, rotation = 0) {
  const island = new THREE.Mesh(new THREE.CircleGeometry(1, 96), landMaterial);
  island.rotation.x = -Math.PI / 2;
  island.rotation.z = rotation;
  island.scale.set(sx, sz, 1);
  island.position.set(x, -0.12, z);
  world.add(island);
}
addIsland(-12, 20, 15, 17, -0.18);
addIsland(2, -12, 18, 15, 0.12);
addIsland(17, -11, 10, 19, -0.2);

const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x130515, roughness: 0.58, metalness: 0.14, emissive: 0x3a0837, emissiveIntensity: 0.3 });
const laneMaterial = new THREE.MeshBasicMaterial({ color: 0xffd6a7, transparent: true, opacity: 0.58 });
legs.filter((leg) => leg.street).forEach((leg) => {
  const road = new THREE.Mesh(new THREE.TubeGeometry(leg.curve, 100, 0.48, 8, false), roadMaterial);
  const lane = new THREE.Mesh(new THREE.TubeGeometry(leg.curve, 100, 0.025, 5, false), laneMaterial);
  road.position.y = -0.05;
  lane.position.y = 0.03;
  world.add(road, lane);
});

function pointSegmentDistance2D(x, z, a, b) {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const lenSq = vx * vx + vz * vz || 1;
  const t = clamp(((x - a.x) * vx + (z - a.z) * vz) / lenSq);
  return Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t));
}
const streetSegments = [];
legs.filter((leg) => leg.street).forEach((leg) => {
  let previous = leg.curve.getPointAt(0);
  for (let i = 1; i <= 80; i++) {
    const next = leg.curve.getPointAt(i / 80);
    streetSegments.push([previous.clone(), next.clone()]);
    previous = next;
  }
});
const landmarkCenters = {
  tower: new THREE.Vector3(-17.57, 0, 12.16),
  lisboa: new THREE.Vector3(-12.31, 0, 19.61),
  ruins: new THREE.Vector3(-13.8, 0, 24),
  cotai: new THREE.Vector3(2.8, 0, -15),
  morpheus: new THREE.Vector3(4.2, 0, -12.8),
  airport: new THREE.Vector3(18, 0, -11.4)
};
function inLand(x, z) {
  const ellipse = (cx, cz, rx, rz) => ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 < 1;
  return ellipse(-12, 20, 15, 17) || ellipse(2, -12, 18, 15) || ellipse(17, -11, 10, 19);
}
function corridorDistance(x, z) {
  let min = Infinity;
  for (const [a, b] of streetSegments) min = Math.min(min, pointSegmentDistance2D(x, z, a, b));
  return min;
}
function landmarkDistance(x, z) {
  let min = Infinity;
  Object.values(landmarkCenters).forEach((p) => { min = Math.min(min, Math.hypot(x - p.x, z - p.z)); });
  return min;
}

const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x2b0a35, roughness: 0.5, metalness: 0.22, emissive: 0x24002d, emissiveIntensity: 0.52 });
const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
const buildingData = [];
for (let x = -27; x <= 28; x += 1.65) {
  for (let z = -31; z <= 37; z += 1.65) {
    if (!inLand(x, z) || corridorDistance(x, z) < 3.1 || landmarkDistance(x, z) < 3.4) continue;
    const r = hash(x * 17.3 + z * 41.9);
    const density = z > 5 ? 0.55 : z < -5 ? 0.48 : 0.28;
    if (r > density) continue;
    const h = 2.2 + hash(x * 3.1 + z * 8.7) * (z > 5 ? 11 : 8);
    buildingData.push({ x, z, h, w: 0.7 + hash(x + z) * 0.8, d: 0.7 + hash(x * 7 - z) * 0.8 });
  }
}
const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, buildingData.length);
const dummy = new THREE.Object3D();
buildingData.forEach((b, i) => {
  dummy.position.set(b.x, b.h / 2, b.z);
  dummy.rotation.y = (hash(i + 700) - 0.5) * 0.18;
  dummy.scale.set(b.w, b.h, b.d);
  dummy.updateMatrix();
  buildings.setMatrixAt(i, dummy.matrix);
});
buildings.instanceMatrix.needsUpdate = true;
world.add(buildings);

const lampGeometry = new THREE.SphereGeometry(0.055, 6, 6);
const lampMaterial = new THREE.MeshBasicMaterial({ color: 0xffd49b });
legs.filter((leg) => leg.street).forEach((leg) => {
  const count = Math.max(8, Math.floor(leg.length / 2.8));
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const p = leg.curve.getPointAt(t);
    const tangent = leg.curve.getTangentAt(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
    [-1, 1].forEach((sign) => {
      const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
      lamp.position.copy(p).addScaledVector(side, sign * 1.05);
      lamp.position.y = 1.15;
      world.add(lamp);
    });
  }
});

function material(color, emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.3, emissive, emissiveIntensity: 0.42 });
}
function createTower() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 9, 8), material(0xead9d4));
  stem.position.y = 4.5;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.72, 0.75, 16), material(0xffb06c, 0x4f1024));
  deck.position.y = 7.2;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 4.5, 6), material(0xffd7bd));
  mast.position.y = 10.0;
  g.add(stem, deck, mast);
  return g;
}
function createLisboa() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.6, 2.0, 10), material(0x5d164f, 0x5a083f));
  base.position.y = 1;
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.45, 12, 10), material(0xe2a15e, 0x5b2412));
  body.scale.set(0.9, 2.2, 0.75);
  body.position.y = 3.7;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.0, 10), material(0xffd18b, 0x5c2410));
  crown.position.y = 7.0;
  g.add(base, body, crown);
  return g;
}
function createRuins() {
  const g = new THREE.Group();
  const facade = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.6, 0.55), material(0xd6a570, 0x4a2314));
  facade.position.y = 2.3;
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.5, 0.5), material(0xe6bd83, 0x4a2314));
  top.position.y = 5.25;
  g.add(facade, top);
  return g;
}
function createCotai() {
  const g = new THREE.Group();
  [-1.35, 1.35].forEach((x) => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.5, 7.8, 1.7), material(0x9c2852, 0x4f102f));
    tower.position.set(x, 3.9, 0);
    g.add(tower);
  });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 1.5), material(0xffb66d, 0x5c2410));
  bridge.position.y = 5.3;
  g.add(bridge);
  return g;
}
function createMorpheus() {
  const g = new THREE.Group();
  const mat = material(0xd7b2e8, 0x3a174a);
  [[-1.3,0],[1.3,0],[0,1]].forEach(([x, mode]) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.65, 7.5, 0.75), mat);
    beam.position.set(x, 3.75, 0);
    if (mode) beam.rotation.z = 0.28;
    g.add(beam);
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.75, 0.8), mat);
  top.position.y = 7.1;
  g.add(top);
  return g;
}
function createAirport() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.55, 5.8, 8), material(0xe4d5c5));
  stem.position.y = 2.9;
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.75, 1.1, 8), material(0xffc878, 0x5c2410));
  cab.position.y = 6.0;
  g.add(stem, cab);
  return g;
}
const landmarkFactories = { tower: createTower, lisboa: createLisboa, ruins: createRuins, cotai: createCotai, morpheus: createMorpheus, airport: createAirport };
const landmarkGroups = {};
Object.entries(landmarkCenters).forEach(([id, position]) => {
  const g = landmarkFactories[id]();
  g.position.copy(position);
  g.userData.baseScale = 1;
  world.add(g);
  landmarkGroups[id] = g;
});

const starsGeometry = new THREE.BufferGeometry();
const starPositions = [];
for (let i = 0; i < 1400; i++) starPositions.push((hash(i) - 0.5) * 360, (hash(i + 2000) - 0.2) * 240, (hash(i + 4000) - 0.5) * 360);
starsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: 0xfff1df, size: 0.22, transparent: true, opacity: 0.78, depthWrite: false }));
scene.add(stars);

const earthGroup = new THREE.Group();
const earth = new THREE.Mesh(new THREE.SphereGeometry(25, 64, 32), new THREE.MeshStandardMaterial({ color: 0x152c55, roughness: 0.72, metalness: 0.05, emissive: 0x071123, emissiveIntensity: 0.35, transparent: true }));
const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(26.2, 64, 32), new THREE.MeshBasicMaterial({ color: 0x6eb9ff, transparent: true, opacity: 0.12, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
earthGroup.add(earth, atmosphere);
scene.add(earthGroup);

const cloudGroup = new THREE.Group();
const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffe1d0, transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending });
for (let i = 0; i < 85; i++) {
  const cloud = new THREE.Mesh(new THREE.SphereGeometry(1.4 + hash(i) * 2.5, 8, 6), cloudMaterial);
  cloud.scale.set(2.8 + hash(i + 10) * 2.2, 0.35 + hash(i + 20) * 0.35, 1.5 + hash(i + 30) * 1.8);
  cloud.position.set((hash(i + 40) - 0.5) * 75, 14 + hash(i + 50) * 11, (hash(i + 60) - 0.5) * 75);
  cloudGroup.add(cloud);
}
scene.add(cloudGroup);

const solarGroup = new THREE.Group();
solarGroup.position.set(70, 86, 106);
const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 20), new THREE.MeshBasicMaterial({ color: 0xffb43f }));
solarGroup.add(sunMesh);
const solarMaterials = [sunMesh.material];
for (let i = 0; i < 7; i++) {
  const radius = 10 + i * 4.3;
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.025, 5, 96), new THREE.MeshBasicMaterial({ color: 0xffd6b5, transparent: true, opacity: 0.22 }));
  orbit.rotation.x = Math.PI / 2;
  world.add(orbit);
  solarMaterials.push(orbit.material);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(0.55 + i * 0.1, 14, 10), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(i / 8, 0.55, 0.58), transparent: true }));
  planet.position.x = radius;
  const pivot = new THREE.Group();
  pivot.rotation.y = i * 0.8;
  pivot.add(planet);
  solarGroup.add(pivot);
  pivot.userData.speed = 0.04 + i * 0.012;
  solarMaterials.push(planet.material);
}
solarGroup.visible = false;
scene.add(solarGroup);

function dockLookQuaternion(index) {
  const dock = docks[index];
  const position = vec(dock.position);
  const target = vec(dock.look);
  if (dock.shift) {
    const forward = target.clone().sub(position).normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const distance = position.distanceTo(target);
    target.addScaledVector(right, -dock.shift[0] * distance * 0.48);
    target.y += Math.max(0, -dock.shift[1]) * distance * 0.34;
  }
  return frameQuaternion(target.sub(position));
}

const state = {
  chapter: 0,
  target: 0,
  mode: "docked",
  direction: 0,
  legIndex: 0,
  distance: 0,
  speed: 0,
  departureMs: 0,
  settleMs: 0,
  settleDuration: 220,
  lastTime: performance.now()
};
window.__h1CinematicState = state;

function renderPage(index) {
  const page = reportPages[index];
  if (!page) return;
  reportPanel.dataset.panelType = page.type;
  panelKicker.textContent = page.kicker;
  panelTitle.textContent = page.title;
  panelBody.textContent = page.body;
  if (page.metrics) {
    panelMetrics.innerHTML = page.metrics.map(([value, label, detail]) => `<div class="metric-card"><span class="metric-value">${value}</span><span class="metric-label">${label}</span><span class="metric-detail">${detail}</span></div>`).join("");
  } else {
    const cls = page.type === "action" ? "chain-node" : page.type === "roadmap" ? "roadmap-node" : "okr-row";
    panelMetrics.innerHTML = `<div class="${page.type === "action" ? "chain-flow" : page.type === "roadmap" ? "roadmap-flow" : "link-map"}">${page.rows.map(([a,b,c]) => `<div class="${cls}"><span class="${page.type === "action" ? "chain-step" : page.type === "roadmap" ? "roadmap-date" : "okr-target"}">${a}</span><span class="${page.type === "action" ? "chain-action" : page.type === "roadmap" ? "roadmap-action" : "okr-link"}">${b}</span>${c ? `<span class="${page.type === "action" ? "chain-okr" : "okr-result"}">${c}</span>` : ""}</div>`).join("")}</div>`;
  }
}

function updateControls() {
  const moving = state.mode !== "docked";
  prevButton.disabled = moving || state.chapter <= 0;
  nextButton.disabled = moving || state.chapter >= docks.length - 1;
  chapterCount.textContent = `${String(state.chapter + 1).padStart(2, "0")} / ${String(docks.length).padStart(2, "0")}`;
  flightStatus.textContent = state.mode === "docked" ? (state.chapter === 7 ? "已完成" : "停留中") : state.mode === "settling" ? "稳定停靠" : "沿街飞行";
  document.getElementById("chapter-nav").dataset.mode = state.mode;
}

function setDock(index) {
  state.chapter = index;
  state.target = index;
  state.mode = "docked";
  state.speed = 0;
  state.direction = 0;
  state.settleMs = state.settleDuration;
  aircraftRoot.position.copy(vec(docks[index].position));
  const bodyDirection = index === 0 ? legs[0].curve.getTangentAt(0) : index === 7 ? legs[6].curve.getTangentAt(1) : legs[Math.min(index, 6)].curve.getTangentAt(0);
  aircraftRoot.quaternion.copy(frameQuaternion(bodyDirection));
  cameraLookRig.quaternion.copy(aircraftRoot.quaternion.clone().invert().multiply(dockLookQuaternion(index)));
  camera.fov = docks[index].fov;
  camera.updateProjectionMatrix();
  if (index > 0 && index < 7) renderPage(index);
  updateControls();
}

function startTransition(target) {
  if (state.mode !== "docked" || target < 0 || target >= docks.length || target === state.chapter) return;
  state.target = target;
  state.direction = target > state.chapter ? 1 : -1;
  state.legIndex = state.direction > 0 ? state.chapter : state.chapter - 1;
  const leg = legs[state.legIndex];
  state.distance = state.direction > 0 ? 0 : leg.length;
  state.speed = 0;
  state.departureMs = 0;
  state.settleMs = 0;
  state.mode = "departing";
  updateControls();
}

prevButton.addEventListener("click", () => startTransition(state.chapter - 1));
nextButton.addEventListener("click", () => startTransition(state.chapter + 1));
skipButton.addEventListener("click", () => {
  if (state.mode === "docked") return;
  const leg = legs[state.legIndex];
  state.distance = state.direction > 0 ? leg.length : 0;
  state.speed = 0;
  state.mode = "settling";
  state.settleMs = 0;
});
window.addEventListener("keydown", (event) => {
  if (["ArrowRight", "PageDown", " "].includes(event.key)) { event.preventDefault(); startTransition(state.chapter + 1); }
  if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); startTransition(state.chapter - 1); }
});

function updateFlight(dt) {
  if (state.mode === "docked") return;
  const leg = legs[state.legIndex];
  if (state.mode === "departing") {
    state.departureMs += dt * 1000;
    if (state.departureMs >= 180) state.mode = "flying";
  }
  if (["departing", "flying", "arriving"].includes(state.mode)) {
    const remaining = state.direction > 0 ? leg.length - state.distance : state.distance;
    const cruise = clamp(leg.length / (state.legIndex === 0 ? 10.5 : state.legIndex === 6 ? 7 : 5.6), 4.2, 13);
    const brake = 7.5;
    const stopping = state.speed * state.speed / (2 * brake);
    const braking = remaining < stopping + cruise * 0.28;
    const desired = braking ? Math.min(cruise, Math.sqrt(Math.max(0, 2 * brake * remaining))) : cruise;
    state.speed += clamp(desired - state.speed, -brake * dt, 5.8 * dt);
    state.distance += state.direction * Math.min(remaining, state.speed * dt);
    if (remaining < 0.04 || (braking && state.speed < 0.08)) {
      state.distance = state.direction > 0 ? leg.length : 0;
      state.speed = 0;
      state.mode = "settling";
      state.settleMs = 0;
    } else if (braking) state.mode = "arriving";
  }
  if (state.mode === "settling") {
    state.settleMs += dt * 1000;
    if (state.settleMs >= state.settleDuration) setDock(state.target);
  }
}

function updatePose(dt, elapsed) {
  if (state.mode === "docked") {
    const hover = state.chapter > 0 && state.chapter < 7 ? 1 : 0;
    camera.position.set(Math.sin(elapsed * 0.7) * 0.018 * hover, Math.sin(elapsed * 0.93) * 0.012 * hover, Math.cos(elapsed * 0.61) * 0.014 * hover);
    return;
  }
  const leg = legs[state.legIndex];
  const u = clamp(state.distance / leg.length);
  const position = leg.curve.getPointAt(u);
  const tangent = leg.curve.getTangentAt(clamp(u, 0.001, 0.999)).multiplyScalar(state.direction).normalize();
  aircraftRoot.position.copy(position);
  const desiredBody = frameQuaternion(tangent);
  const bodyAngle = aircraftRoot.quaternion.angleTo(desiredBody);
  const bodyAlpha = Math.min(damp(9, dt), THREE.MathUtils.degToRad(1.25) / Math.max(bodyAngle, 0.0001));
  aircraftRoot.quaternion.slerp(desiredBody, bodyAlpha);

  const aheadDistance = clamp(state.distance + state.direction * clamp(4 + state.speed * 0.65, 4.5, 10), 0, leg.length);
  const ahead = leg.curve.getPointAt(aheadDistance / leg.length);
  let desiredCamera = frameQuaternion(ahead.sub(position));
  const remaining = state.direction > 0 ? leg.length - state.distance : state.distance;
  const arrivalBlend = state.mode === "settling" ? smoothstep(0, state.settleDuration, state.settleMs) : smoothstep(8.5, 0.7, remaining);
  desiredCamera.slerp(dockLookQuaternion(state.target), arrivalBlend);
  const localLook = aircraftRoot.quaternion.clone().invert().multiply(desiredCamera);
  cameraLookRig.quaternion.slerp(localLook, damp(7.2, dt));
  camera.position.set(0, 0, 0);
  camera.fov += (lerp(docks[state.chapter].fov, docks[state.target].fov, state.direction > 0 ? u : 1 - u) - camera.fov) * damp(5, dt);
  camera.updateProjectionMatrix();
}

function updatePresentation(elapsed) {
  const moving = state.mode !== "docked";
  const pageVisible = state.mode === "docked" && state.chapter > 0 && state.chapter < 7;
  title.style.opacity = state.mode === "docked" && state.chapter === 0 ? "1" : "0";
  reportPanel.style.opacity = pageVisible ? "1" : "0";
  reportPanel.style.transform = `translate(-50%, calc(-50% + ${pageVisible ? 0 : 28}px)) scale(${pageVisible ? 1 : 0.98})`;
  endTitle.style.opacity = state.mode === "docked" && state.chapter === 7 ? "1" : "0";

  const leg = moving ? legs[state.legIndex] : null;
  const legU = leg ? clamp(state.distance / leg.length) : 0;
  const globalProgress = moving ? (state.legIndex + (state.direction > 0 ? legU : 1 - legU)) / 7 : state.chapter / 7;
  progressValue.textContent = `${Math.round(globalProgress * 100)}%`;
  progressBar.style.width = `${globalProgress * 100}%`;
  speedLines.style.opacity = `${clamp(state.speed / 15) * 0.5}`;

  const opening = moving && state.legIndex === 0 ? legU : state.chapter === 0 ? 0 : 1;
  earthGroup.visible = opening < 0.86;
  earth.material.opacity = clamp(1 - smoothstep(0.48, 0.82, opening));
  atmosphere.material.opacity = earth.material.opacity * 0.13;
  earth.rotation.y += 0.0012;
  cloudGroup.visible = opening > 0.25 && opening < 0.88;
  cloudMaterial.opacity = smoothstep(0.28, 0.48, opening) * (1 - smoothstep(0.72, 0.9, opening)) * 0.19;
  world.visible = opening > 0.48 || state.chapter > 0;
  const cityReveal = state.chapter > 0 ? 1 : smoothstep(0.5, 0.82, opening);
  buildingMaterial.opacity = cityReveal;
  buildingMaterial.transparent = cityReveal < 0.99;
  roadMaterial.opacity = cityReveal;
  roadMaterial.transparent = cityReveal < 0.99;
  dawnGlow.style.opacity = `${smoothstep(0.48, 0.78, opening) * 0.62}`;

  const finalProgress = moving && state.legIndex === 6 ? legU : state.chapter === 7 ? 1 : 0;
  solarGroup.visible = finalProgress > 0.28;
  const solarOpacity = smoothstep(0.3, 0.78, finalProgress);
  solarMaterials.forEach((mat) => { mat.transparent = true; mat.opacity = solarOpacity * (mat.userData.baseOpacity ?? 1); });
  solarGroup.children.forEach((child) => { if (child.userData.speed) child.rotation.y += child.userData.speed * 0.01; });
  solarGroup.rotation.y = Math.sin(elapsed * 0.08) * 0.04;

  stage.style.setProperty("--space-opacity", `${clamp(1 - cityReveal * 0.9 + finalProgress * 0.9)}`);
  stage.style.setProperty("--warm-opacity", `${clamp(cityReveal * (1 - finalProgress))}`);
  meteorLayer.style.opacity = `${clamp(0.52 * (1 - cityReveal) + finalProgress * 0.4)}`;

  Object.entries(landmarkGroups).forEach(([id, group]) => {
    const active = pageVisible && reportPages[state.chapter]?.landmark === id ? 1 : 0;
    const scale = 1 + active * 0.05 + Math.sin(elapsed * 1.3) * 0.004 * active;
    group.scale.setScalar(scale);
  });
}

window.__h1FlightQA = () => ({ ...state, position: aircraftRoot.position.toArray(), bodyQuaternion: aircraftRoot.quaternion.toArray() });
window.__h1AuditRoute = () => {
  const collisions = [];
  legs.filter((leg) => leg.street).forEach((leg) => {
    for (let i = 0; i <= 160; i++) {
      const p = leg.curve.getPointAt(i / 160);
      buildingData.forEach((b, index) => {
        if (p.y > b.h + 1.2) return;
        const dx = Math.max(Math.abs(p.x - b.x) - b.w / 2, 0);
        const dz = Math.max(Math.abs(p.z - b.z) - b.d / 2, 0);
        if (Math.hypot(dx, dz) < 1.2) collisions.push({ leg: leg.index, sample: i, building: index });
      });
    }
  });
  return { collisionCount: collisions.length, collisions: collisions.slice(0, 30), buildingCount: buildingData.length };
};

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
});

setDock(0);
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  updateFlight(dt);
  updatePose(dt, elapsed);
  updatePresentation(elapsed);
  updateControls();
  renderer.render(scene, camera);
});
