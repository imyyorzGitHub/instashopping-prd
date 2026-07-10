import * as THREE from "three";

const stage = document.getElementById("stage");
const canvas = document.getElementById("scene");
const loading = document.getElementById("loading");
const loadingCopy = document.getElementById("loading-copy");
const enterButton = document.getElementById("enter-macau");
const replayButton = document.getElementById("replay");
const intro = document.getElementById("intro");
const arrival = document.getElementById("arrival");
const targetLock = document.getElementById("target-lock");
const phaseLabel = document.getElementById("phase-label");
const phaseValue = document.getElementById("phase-value");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010107);
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 0, 22);
scene.add(camera);

const overlayScene = new THREE.Scene();
const overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const clock = new THREE.Clock();
const state = { phase: "loading", phaseStartedAt: performance.now(), warpProgress: 0, ready: false };
window.__h1V3State = state;

const EARTH_RADIUS = 20;
const MACAU = { lat: 22.1987, lon: 113.5439 };
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function smoothstep(a, b, value) {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function latLonToVector3(lat, lon, radius = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function createStars() {
  const positions = [];
  const sizes = [];
  for (let i = 0; i < 1800; i++) {
    const radius = 120 + hash(i + 3) * 360;
    const theta = hash(i + 10) * Math.PI * 2;
    const phi = Math.acos(2 * hash(i + 20) - 1);
    positions.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
    sizes.push(0.5 + hash(i + 30) * 1.8);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `
      attribute float aSize;
      uniform float uPixelRatio;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (170.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float alpha = smoothstep(0.5, 0.0, length(p));
        gl_FragColor = vec4(vec3(1.0, 0.91, 0.78), alpha * 0.82);
      }
    `
  });
  return new THREE.Points(geometry, material);
}

const stars = createStars();
scene.add(stars);

const earthGroup = new THREE.Group();
earthGroup.position.set(18, -1, -34);
scene.add(earthGroup);
const macauLocalNormal = latLonToVector3(MACAU.lat, MACAU.lon).normalize();
const desiredMacauWorldNormal = new THREE.Vector3().subVectors(camera.position, earthGroup.position).normalize();
const earthBaseQuaternion = new THREE.Quaternion().setFromUnitVectors(macauLocalNormal, desiredMacauWorldNormal);
earthGroup.quaternion.copy(earthBaseQuaternion);

const earthUniforms = {
  dayTexture: { value: null },
  nightTexture: { value: null },
  sunDirection: { value: desiredMacauWorldNormal.clone().negate().add(new THREE.Vector3(-0.08, 0.16, -0.03)).normalize() },
  uOpacity: { value: 1 }
};
const earthMaterial = new THREE.ShaderMaterial({
  uniforms: earthUniforms,
  transparent: true,
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vViewNormal;
    varying vec3 vWorldNormal;
    void main() {
      vUv = uv;
      vViewNormal = normalize(normalMatrix * normal);
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform vec3 sunDirection;
    uniform float uOpacity;
    varying vec2 vUv;
    varying vec3 vViewNormal;
    varying vec3 vWorldNormal;
    void main() {
      vec3 day = texture2D(dayTexture, vUv).rgb;
      vec3 night = texture2D(nightTexture, vUv).rgb;
      night = pow(max(night, vec3(0.0)), vec3(0.78)) * 1.52;
      day = pow(max(day, vec3(0.0)), vec3(0.92)) * 0.72;
      float ndl = dot(normalize(vWorldNormal), normalize(sunDirection));
      float lightAmount = smoothstep(0.08, 0.48, ndl) * 0.72;
      float twilight = 1.0 - smoothstep(0.0, 0.22, abs(ndl));
      float rim = pow(1.0 - max(0.0, dot(normalize(vViewNormal), vec3(0.0, 0.0, 1.0))), 2.7);
      vec3 color = mix(night, day, lightAmount);
      color += vec3(0.08, 0.19, 0.38) * twilight * 0.22;
      color += vec3(0.05, 0.18, 0.42) * rim * 0.44;
      gl_FragColor = vec4(color, uOpacity);
    }
  `
});
const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 128, 64), earthMaterial);
earthGroup.add(earth);
const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_RADIUS * 1.045, 128, 64),
  new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 1 } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vNormal;
      void main() {
        float edge = pow(max(0.0, 0.76 - dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.3);
        vec3 color = mix(vec3(0.16, 0.52, 1.0), vec3(0.48, 0.16, 1.0), 0.22);
        gl_FragColor = vec4(color, edge * 0.9 * uOpacity);
      }
    `
  })
);
earthGroup.add(atmosphere);

const macauMarker = new THREE.Group();
const markerCore = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
const markerHalo = new THREE.Mesh(
  new THREE.RingGeometry(0.33, 0.45, 56),
  new THREE.MeshBasicMaterial({ color: 0xff735f, transparent: true, opacity: 0.92, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
);
markerHalo.position.z = 0.045;
macauMarker.add(markerCore, markerHalo);
macauMarker.position.copy(macauLocalNormal).multiplyScalar(EARTH_RADIUS * 1.013);
macauMarker.quaternion.setFromUnitVectors(Z_AXIS, macauLocalNormal);
earthGroup.add(macauMarker);

function updateTargetLock() {
  if (state.phase !== "orbit" || !state.ready) return;
  const worldPosition = macauMarker.getWorldPosition(tempVector);
  const projected = tempVector2.copy(worldPosition).project(camera);
  const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
  targetLock.style.left = `${x - 44}px`;
  targetLock.style.top = `${y - 39}px`;
  targetLock.style.right = "auto";
  targetLock.style.visibility = projected.z > -1 && projected.z < 1 ? "visible" : "hidden";
}

const arrivalGroup = new THREE.Group();
arrivalGroup.visible = false;
scene.add(arrivalGroup);
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(260, 180, 1, 1),
  new THREE.MeshPhysicalMaterial({ color: 0x020713, roughness: 0.26, metalness: 0.36, transparent: true, opacity: 0.92 })
);
water.rotation.x = -Math.PI / 2;
water.position.y = -7;
arrivalGroup.add(water);
const horizonGeometry = new THREE.BufferGeometry();
const horizonPoints = [];
for (let i = 0; i < 260; i++) {
  const x = -85 + i * 0.66;
  const z = -56 + Math.sin(i * 0.11) * 4.5 + Math.sin(i * 0.037) * 8;
  const y = -5.4 + hash(i + 800) * 1.4;
  horizonPoints.push(x, y, z);
}
horizonGeometry.setAttribute("position", new THREE.Float32BufferAttribute(horizonPoints, 3));
arrivalGroup.add(new THREE.Points(horizonGeometry, new THREE.PointsMaterial({ color: 0xffcf8a, size: 0.48, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending, depthWrite: false })));
const skylineMaterial = new THREE.LineBasicMaterial({ color: 0x7e76ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending });
for (let i = 0; i < 110; i++) {
  const x = -72 + i * 1.35;
  const z = -54 + Math.sin(i * 0.19) * 4.2;
  const h = 1.8 + hash(i + 1200) * 8.5;
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, -5.5, z), new THREE.Vector3(x, -5.5 + h, z)]);
  arrivalGroup.add(new THREE.Line(geometry, skylineMaterial));
}

const wormholeMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: THREE.NormalBlending,
  uniforms: { uTime: { value: 0 }, uProgress: { value: 0 }, uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) } },
  vertexShader: `void main(){ gl_Position = vec4(position, 1.0); }`,
  fragmentShader: `
    uniform float uTime;
    uniform float uProgress;
    uniform vec2 uResolution;
    float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p){
      vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);
    }
    float fbm(vec2 p){ float v=0.0,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=mat2(1.6,-1.2,1.2,1.6)*p+2.1; a*=.5; } return v; }
    void main(){
      vec2 p=(gl_FragCoord.xy*2.0-uResolution.xy)/min(uResolution.x,uResolution.y);
      float r=max(length(p),.003);
      float a=atan(p.y,p.x);
      float open=smoothstep(.01,.24,uProgress);
      float close=1.0-smoothstep(.83,1.0,uProgress);
      float envelope=open*close;
      float turbulence=fbm(vec2(a*1.8, 3.2/r-uTime*2.4));
      float warpedA=a + 1.25/r + turbulence*.95 - uTime*2.1;
      float radial=1.0/r + turbulence*.42;
      float rings=pow(max(0.0,sin(radial*31.0-uTime*19.0+sin(warpedA*7.0)*2.2)),10.0);
      float filaments=pow(max(0.0,cos(warpedA*18.0+radial*8.0)),22.0);
      float lens=exp(-pow((r-.31-turbulence*.035)*8.0,2.0));
      float core=smoothstep(.26,.02,r);
      vec3 violet=vec3(.20,.035,.92), cyan=vec3(.03,.72,1.0), amber=vec3(1.0,.34,.08);
      vec3 color=mix(violet,cyan,.5+.5*sin(warpedA*2.6+uTime));
      color=mix(color,amber,clamp(rings*.5+lens*.22,0.0,.72));
      color*=rings*1.1+filaments*1.45+lens*.9+turbulence*.08;
      color=mix(color,vec3(.005,.002,.02),core*.86);
      float flash=smoothstep(.67,.76,uProgress)*(1.0-smoothstep(.77,.89,uProgress));
      color+=vec3(1.0,.91,.83)*flash*smoothstep(1.2,0.0,r)*2.0;
      float alpha=envelope*smoothstep(1.7,.04,r)*clamp(rings+filaments+lens*.72+turbulence*.12+flash,0.0,.96);
      gl_FragColor=vec4(color,alpha);
    }
  `
});
overlayScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), wormholeMaterial));

const WARP_PARTICLE_COUNT = 900;
const particlePositions = new Float32Array(WARP_PARTICLE_COUNT * 2 * 3);
const particleColors = new Float32Array(WARP_PARTICLE_COUNT * 2 * 3);
const particleData = [];
const particlePalette = [new THREE.Color(0x7a46ff), new THREE.Color(0x39c7ff), new THREE.Color(0xff7438), new THREE.Color(0xffffff)];
for (let i = 0; i < WARP_PARTICLE_COUNT; i++) {
  const color = particlePalette[Math.floor(hash(i + 91) * particlePalette.length) % particlePalette.length];
  particleData.push({ radius: 0.55 + Math.pow(hash(i + 7), 0.62) * 15, angle: hash(i + 17) * Math.PI * 2, z: -4 - hash(i + 27) * 118, speed: 0.55 + hash(i + 37) * 1.8, length: 0.5 + hash(i + 47) * 4.2, phase: hash(i + 57) * Math.PI * 2 });
  for (let endpoint = 0; endpoint < 2; endpoint++) {
    const offset = (i * 2 + endpoint) * 3;
    particleColors[offset] = color.r;
    particleColors[offset + 1] = color.g;
    particleColors[offset + 2] = color.b;
  }
}
const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
particleGeometry.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));
const particleMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
const warpParticles = new THREE.LineSegments(particleGeometry, particleMaterial);
warpParticles.frustumCulled = false;
warpParticles.visible = false;
camera.add(warpParticles);
const warpRings = new THREE.Group();
warpRings.visible = false;
camera.add(warpRings);
for (let i = 0; i < 14; i++) {
  const material = new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xff653b : i % 2 ? 0x42c8ff : 0x7546ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2 + hash(i + 300) * 3.6, 0.025 + hash(i + 330) * 0.045, 5, 72), material);
  ring.position.z = -8 - i * 8.2;
  ring.rotation.z = hash(i + 360) * Math.PI;
  ring.userData.speed = 0.7 + hash(i + 390) * 1.3;
  warpRings.add(ring);
}

function updateWarpParticles(delta, elapsed, progress) {
  const active = state.phase === "warp";
  warpParticles.visible = active;
  warpRings.visible = active;
  if (!active) return;
  const envelope = smoothstep(0.02, 0.2, progress) * (1 - smoothstep(0.88, 1, progress));
  const positions = particleGeometry.attributes.position.array;
  for (let i = 0; i < WARP_PARTICLE_COUNT; i++) {
    const particle = particleData[i];
    particle.z += delta * (18 + progress * 92) * particle.speed;
    if (particle.z > -0.45) particle.z = -112 - hash(i + Math.floor(elapsed * 11)) * 18;
    const depth = clamp01((-particle.z) / 125);
    const twist = particle.angle + (1 - depth) * (7.5 + progress * 12) + elapsed * (0.35 + particle.speed * 0.18);
    const radius = particle.radius * (0.22 + depth * 0.92) * (1 + Math.sin(elapsed * 1.8 + particle.phase) * 0.08);
    const trailZ = particle.z - particle.length * (1.1 + progress * 5.6);
    const trailDepth = clamp01((-trailZ) / 125);
    const trailTwist = particle.angle + (1 - trailDepth) * (7.5 + progress * 12) + elapsed * (0.35 + particle.speed * 0.18);
    const trailRadius = particle.radius * (0.22 + trailDepth * 0.92);
    const offset = i * 6;
    positions[offset] = Math.cos(twist) * radius;
    positions[offset + 1] = Math.sin(twist) * radius;
    positions[offset + 2] = particle.z;
    positions[offset + 3] = Math.cos(trailTwist) * trailRadius;
    positions[offset + 4] = Math.sin(trailTwist) * trailRadius;
    positions[offset + 5] = trailZ;
  }
  particleGeometry.attributes.position.needsUpdate = true;
  particleMaterial.opacity = envelope * (0.42 + progress * 0.5);
  warpRings.children.forEach((ring, index) => {
    ring.position.z += delta * (22 + progress * 76) * ring.userData.speed;
    if (ring.position.z > -0.7) ring.position.z = -105 - index * 4.5;
    const near = clamp01(1 - (-ring.position.z) / 110);
    ring.scale.setScalar(0.55 + near * 2.3);
    ring.rotation.z += delta * (0.65 + index * 0.04) * (index % 2 ? 1 : -1);
    ring.material.opacity = envelope * (0.05 + near * 0.28);
  });
}

function setPhase(phase) {
  state.phase = phase;
  state.phaseStartedAt = performance.now();
  stage.dataset.phase = phase;
  if (phase === "orbit") {
    intro.setAttribute("aria-hidden", "false");
    arrival.setAttribute("aria-hidden", "true");
    targetLock.classList.add("is-visible");
    phaseLabel.textContent = "MACAU NIGHT ORBIT";
    phaseValue.textContent = "22.1987° N · 113.5439° E";
  } else if (phase === "warp") {
    targetLock.classList.remove("is-visible");
    phaseLabel.textContent = "SPATIAL FOLD";
    phaseValue.textContent = "PARTICLE VECTOR LOCKED";
  } else if (phase === "arrival") {
    intro.setAttribute("aria-hidden", "true");
    arrival.setAttribute("aria-hidden", "false");
    phaseLabel.textContent = "MACAU NIGHT APPROACH";
    phaseValue.textContent = "ALT 1.8 KM";
  }
}
function startWarp() {
  if (!state.ready || state.phase !== "orbit") return;
  state.warpProgress = 0;
  particleData.forEach((particle, i) => { particle.z = -4 - hash(i + performance.now() * 0.001) * 118; });
  warpRings.children.forEach((ring, i) => { ring.position.z = -8 - i * 8.2; });
  setPhase("warp");
}
function resetOpening() {
  state.warpProgress = 0;
  wormholeMaterial.uniforms.uProgress.value = 0;
  earthGroup.visible = true;
  earthGroup.scale.setScalar(1);
  earthGroup.position.set(18, -1, -34);
  earthUniforms.uOpacity.value = 1;
  atmosphere.material.uniforms.uOpacity.value = 1;
  arrivalGroup.visible = false;
  warpParticles.visible = false;
  warpRings.visible = false;
  camera.position.set(0, 0, 22);
  camera.lookAt(5.5, -0.5, -25);
  setPhase("orbit");
}
enterButton.addEventListener("click", startWarp);
replayButton.addEventListener("click", resetOpening);
window.addEventListener("keydown", event => {
  if ((event.code === "Space" || event.code === "Enter") && state.phase === "orbit") {
    event.preventDefault();
    startWarp();
  }
});

const textureLoader = new THREE.TextureLoader();
Promise.all([
  textureLoader.loadAsync("https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg"),
  textureLoader.loadAsync("https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg")
]).then(([dayTexture, nightTexture]) => {
  for (const texture of [dayTexture, nightTexture]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  earthUniforms.dayTexture.value = dayTexture;
  earthUniforms.nightTexture.value = nightTexture;
  state.ready = true;
  state.phase = "orbit";
  loading.classList.add("is-hidden");
  enterButton.disabled = false;
  phaseLabel.textContent = "MACAU NIGHT ORBIT";
  phaseValue.textContent = "22.1987° N · 113.5439° E";
  window.setTimeout(() => targetLock.classList.add("is-visible"), 420);
}).catch(error => {
  console.error(error);
  loadingCopy.textContent = "地球纹理装载失败，请检查网络后刷新";
});

let lastElapsed = 0;
function animate() {
  const elapsed = clock.getElapsedTime();
  const delta = Math.min(0.05, elapsed - lastElapsed || 0.016);
  lastElapsed = elapsed;
  const now = performance.now();
  stars.rotation.y = elapsed * 0.004;
  markerHalo.scale.setScalar(1 + Math.sin(elapsed * 3.2) * 0.18);
  markerHalo.material.opacity = 0.62 + Math.sin(elapsed * 3.2) * 0.24;
  if (state.phase === "orbit") {
    tempQuaternion.setFromAxisAngle(macauLocalNormal, Math.sin(elapsed * 0.12) * 0.025);
    earthGroup.quaternion.copy(earthBaseQuaternion).multiply(tempQuaternion);
    earthGroup.position.y = -1 + Math.sin(elapsed * 0.34) * 0.28;
    camera.position.x = Math.sin(elapsed * 0.18) * 0.28;
    camera.position.y = Math.cos(elapsed * 0.16) * 0.14;
    camera.lookAt(5.5, -0.5, -25);
    updateTargetLock();
  }
  if (state.phase === "warp") {
    const t = Math.min(1, (now - state.phaseStartedAt) / 4600);
    state.warpProgress = t;
    wormholeMaterial.uniforms.uProgress.value = t;
    updateWarpParticles(delta, elapsed, t);
    const launch = smoothstep(0.0, 0.68, t);
    earthGroup.scale.setScalar(1 + launch * 1.95);
    earthGroup.position.z = -34 + launch * 25;
    earthUniforms.uOpacity.value = 1 - smoothstep(0.22, 0.62, t);
    atmosphere.material.uniforms.uOpacity.value = earthUniforms.uOpacity.value;
    camera.position.z = 22 - launch * 8;
    camera.position.x = Math.sin(t * 42) * 0.2 * launch;
    camera.position.y = Math.sin(t * 53) * 0.14 * launch;
    if (t > 0.72) {
      earthGroup.visible = false;
      arrivalGroup.visible = true;
      const reveal = smoothstep(0.73, 1.0, t);
      arrivalGroup.position.z = -80 + reveal * 20;
      camera.lookAt(0, -2, -55);
    }
    if (t >= 1) {
      wormholeMaterial.uniforms.uProgress.value = 0;
      warpParticles.visible = false;
      warpRings.visible = false;
      camera.position.set(0, 7, 28);
      camera.lookAt(0, -2, -55);
      setPhase("arrival");
    }
  }
  if (state.phase === "arrival") {
    arrivalGroup.position.y = Math.sin(elapsed * 0.42) * 0.22;
    camera.position.x = Math.sin(elapsed * 0.13) * 1.1;
    camera.position.y = 7 + Math.cos(elapsed * 0.17) * 0.3;
    camera.lookAt(0, -2, -55);
  }
  wormholeMaterial.uniforms.uTime.value = elapsed;
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(overlayScene, overlayCamera);
  requestAnimationFrame(animate);
}
animate();

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  wormholeMaterial.uniforms.uResolution.value.set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
}
window.addEventListener("resize", resize);
resize();
