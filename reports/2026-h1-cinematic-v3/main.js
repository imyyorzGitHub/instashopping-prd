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
renderer.toneMappingExposure = 1.08;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010107);
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 0, 22);

const overlayScene = new THREE.Scene();
const overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const clock = new THREE.Clock();
const state = {
  phase: "loading",
  phaseStartedAt: performance.now(),
  warpProgress: 0,
  ready: false
};
window.__h1V3State = state;

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function smoothstep(a, b, value) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function createStars() {
  const positions = [];
  const sizes = [];
  for (let i = 0; i < 1800; i++) {
    const radius = 120 + hash(i + 3) * 360;
    const theta = hash(i + 10) * Math.PI * 2;
    const phi = Math.acos(2 * hash(i + 20) - 1);
    positions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
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
        float d = length(p);
        float alpha = smoothstep(0.5, 0.0, d);
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
earthGroup.rotation.set(0.08, -1.64, -0.08);
scene.add(earthGroup);

const earthUniforms = {
  dayTexture: { value: null },
  nightTexture: { value: null },
  sunDirection: { value: new THREE.Vector3(-0.45, 0.25, 0.86).normalize() },
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
      float lightAmount = smoothstep(-0.16, 0.18, dot(normalize(vWorldNormal), normalize(sunDirection)));
      float rim = pow(1.0 - max(0.0, dot(normalize(vViewNormal), vec3(0.0, 0.0, 1.0))), 2.5);
      vec3 color = mix(night * 1.32, day * 1.06, lightAmount);
      color += vec3(0.06, 0.16, 0.30) * rim * 0.42;
      gl_FragColor = vec4(color, uOpacity);
    }
  `
});

const earth = new THREE.Mesh(new THREE.SphereGeometry(20, 128, 64), earthMaterial);
earthGroup.add(earth);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(20.85, 128, 64),
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
        float edge = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.2);
        vec3 color = mix(vec3(0.20, 0.58, 1.0), vec3(1.0, 0.42, 0.30), 0.18);
        gl_FragColor = vec4(color, edge * 0.82 * uOpacity);
      }
    `
  })
);
earthGroup.add(atmosphere);

const macauMarker = new THREE.Group();
const markerCore = new THREE.Mesh(
  new THREE.SphereGeometry(0.18, 16, 10),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
);
const markerHalo = new THREE.Mesh(
  new THREE.RingGeometry(0.32, 0.42, 48),
  new THREE.MeshBasicMaterial({ color: 0xff8b67, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
);
markerHalo.position.z = 0.04;
macauMarker.add(markerCore, markerHalo);
macauMarker.position.set(9.2, 7.45, 16.2);
macauMarker.lookAt(macauMarker.position.clone().multiplyScalar(2));
earthGroup.add(macauMarker);

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
const horizon = new THREE.Points(
  horizonGeometry,
  new THREE.PointsMaterial({ color: 0xffcf8a, size: 0.48, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending, depthWrite: false })
);
arrivalGroup.add(horizon);

const skylineMaterial = new THREE.LineBasicMaterial({ color: 0x7e76ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending });
for (let i = 0; i < 110; i++) {
  const x = -72 + i * 1.35;
  const z = -54 + Math.sin(i * 0.19) * 4.2;
  const h = 1.8 + hash(i + 1200) * 8.5;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x, -5.5, z),
    new THREE.Vector3(x, -5.5 + h, z)
  ]);
  arrivalGroup.add(new THREE.Line(geometry, skylineMaterial));
}

const wormholeMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  },
  vertexShader: `
    void main() {
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uProgress;
    uniform vec2 uResolution;

    float hash(float n) { return fract(sin(n) * 43758.5453123); }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
      float r = max(length(p), 0.002);
      float a = atan(p.y, p.x);
      float open = smoothstep(0.02, 0.32, uProgress);
      float close = 1.0 - smoothstep(0.78, 1.0, uProgress);
      float envelope = open * close;

      float twist = sin(a * 9.0 + 18.0 / r - uTime * 10.0);
      float rings = pow(max(0.0, sin(25.0 / r - uTime * 17.0 + twist * 1.8)), 8.0);
      float sector = floor((a + 3.14159265) * 70.0);
      float raySeed = hash(sector);
      float rays = pow(max(0.0, 1.0 - abs(fract(12.0 / r - uTime * (6.0 + raySeed * 8.0)) - 0.5) * 2.0), 16.0);
      rays *= step(0.72, raySeed);

      float core = smoothstep(0.34, 0.0, r);
      float shell = smoothstep(1.5, 0.18, r) * (1.0 - core * 0.84);
      vec3 violet = vec3(0.30, 0.10, 1.0);
      vec3 cyan = vec3(0.06, 0.72, 1.0);
      vec3 amber = vec3(1.0, 0.43, 0.16);
      vec3 color = mix(violet, cyan, 0.5 + 0.5 * sin(a * 3.0 + uTime * 2.0));
      color = mix(color, amber, rings * 0.58);
      color *= (rings * 0.8 + rays * 1.65 + shell * 0.11);

      float flash = smoothstep(0.62, 0.76, uProgress) * (1.0 - smoothstep(0.76, 0.9, uProgress));
      color += vec3(1.0, 0.92, 0.82) * flash * smoothstep(1.2, 0.0, r) * 1.8;
      float alpha = envelope * smoothstep(1.7, 0.0, r) * clamp(rings + rays + shell * 0.24 + flash, 0.0, 1.0);
      gl_FragColor = vec4(color, alpha);
    }
  `
});
const wormholeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), wormholeMaterial);
overlayScene.add(wormholeQuad);

function setPhase(phase) {
  state.phase = phase;
  state.phaseStartedAt = performance.now();
  stage.dataset.phase = phase;
  if (phase === "orbit") {
    intro.setAttribute("aria-hidden", "false");
    arrival.setAttribute("aria-hidden", "true");
    targetLock.classList.add("is-visible");
    phaseLabel.textContent = "LOW EARTH ORBIT";
    phaseValue.textContent = "ALT 420 KM";
  } else if (phase === "warp") {
    targetLock.classList.remove("is-visible");
    phaseLabel.textContent = "SPATIAL FOLD";
    phaseValue.textContent = "VECTOR LOCKED";
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
  setPhase("warp");
}

function resetOpening() {
  state.warpProgress = 0;
  wormholeMaterial.uniforms.uProgress.value = 0;
  earthGroup.visible = true;
  earthGroup.scale.setScalar(1);
  earthUniforms.uOpacity.value = 1;
  atmosphere.material.uniforms.uOpacity.value = 1;
  arrivalGroup.visible = false;
  camera.position.set(0, 0, 22);
  camera.lookAt(0, 0, -20);
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
  phaseLabel.textContent = "LOW EARTH ORBIT";
  phaseValue.textContent = "ALT 420 KM";
  window.setTimeout(() => targetLock.classList.add("is-visible"), 500);
}).catch(error => {
  console.error(error);
  loadingCopy.textContent = "地球纹理装载失败，请检查网络后刷新";
});

function animate() {
  const elapsed = clock.getElapsedTime();
  const now = performance.now();
  stars.rotation.y = elapsed * 0.004;
  markerHalo.scale.setScalar(1 + Math.sin(elapsed * 3.2) * 0.18);
  markerHalo.material.opacity = 0.62 + Math.sin(elapsed * 3.2) * 0.24;

  if (state.phase === "orbit") {
    earthGroup.rotation.y += 0.00045;
    earthGroup.position.y = -1 + Math.sin(elapsed * 0.34) * 0.35;
    camera.position.x = Math.sin(elapsed * 0.18) * 0.34;
    camera.position.y = Math.cos(elapsed * 0.16) * 0.18;
    camera.lookAt(5.5, -0.5, -25);
  }

  if (state.phase === "warp") {
    const t = Math.min(1, (now - state.phaseStartedAt) / 3900);
    state.warpProgress = t;
    wormholeMaterial.uniforms.uProgress.value = t;
    const launch = smoothstep(0.0, 0.66, t);
    earthGroup.scale.setScalar(1 + launch * 1.8);
    earthGroup.position.z = -34 + launch * 24;
    earthUniforms.uOpacity.value = 1 - smoothstep(0.28, 0.68, t);
    atmosphere.material.uniforms.uOpacity.value = earthUniforms.uOpacity.value;
    camera.position.z = 22 - launch * 8;
    camera.position.x = Math.sin(t * 34) * 0.16 * launch;
    camera.position.y = Math.sin(t * 41) * 0.11 * launch;

    if (t > 0.68) {
      earthGroup.visible = false;
      arrivalGroup.visible = true;
      const reveal = smoothstep(0.7, 1.0, t);
      arrivalGroup.position.z = -80 + reveal * 20;
      camera.lookAt(0, -2, -55);
    }

    if (t >= 1) {
      wormholeMaterial.uniforms.uProgress.value = 0;
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
