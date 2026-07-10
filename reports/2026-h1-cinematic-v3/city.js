import * as THREE from "three";

const PALETTES = {
  residential: { wall: 0x111827, roof: 0x252d40, window: 0xffd39a, emissive: 0.42 },
  commercial:  { wall: 0x101a2d, roof: 0x263b62, window: 0x78d8ff, emissive: 0.64 },
  hotel:       { wall: 0x21142d, roof: 0x56265f, window: 0xff96db, emissive: 0.88 },
  public:      { wall: 0x122321, roof: 0x245046, window: 0x8dffd1, emissive: 0.54 },
  industrial:  { wall: 0x20242c, roof: 0x383d49, window: 0xffbd68, emissive: 0.32 }
};

function shapeFrom(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => index ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  return shape;
}

function lineGeometry(points, height = 0.05) {
  return new THREE.BufferGeometry().setFromPoints(points.map(([x, z]) => new THREE.Vector3(x, height, z)));
}

function seeded(index) {
  const x = Math.sin(index * 91.73 + 17.31) * 43758.5453;
  return x - Math.floor(x);
}

function createWindowTexture(hex, seedOffset) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#05070d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const c = new THREE.Color(hex);
  for (let y = 5; y < 252; y += 10) {
    for (let x = 5; x < 124; x += 10) {
      const noise = seeded(x * 19 + y * 29 + seedOffset * 71);
      ctx.fillStyle = noise > 0.44
        ? `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${0.34 + noise * 0.58})`
        : "rgba(4,6,12,.93)";
      ctx.fillRect(x, y, 4, 6);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 9);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

export async function createMacauCity() {
  const response = await fetch("./city-data.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`city-data.json ${response.status}`);
  const data = await response.json();

  const root = new THREE.Group();
  root.name = "macau-osm-city";

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(430, 370),
    new THREE.MeshPhysicalMaterial({
      color: 0x010713,
      roughness: 0.18,
      metalness: 0.72,
      transparent: true,
      opacity: 0.99,
      clearcoat: 0.25
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.22;
  root.add(water);

  const roadGroup = new THREE.Group();
  const roadMaterials = {
    motorway: new THREE.LineBasicMaterial({ color: 0xffa85c, transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending }),
    trunk: new THREE.LineBasicMaterial({ color: 0xffb977, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }),
    primary: new THREE.LineBasicMaterial({ color: 0xffd09a, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending }),
    secondary: new THREE.LineBasicMaterial({ color: 0x8bd6ff, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending }),
    tertiary: new THREE.LineBasicMaterial({ color: 0x719fcf, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending }),
    default: new THREE.LineBasicMaterial({ color: 0x3f5b82, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending })
  };
  for (const road of data.roads) {
    const material = roadMaterials[road.k] || roadMaterials.default;
    roadGroup.add(new THREE.Line(lineGeometry(road.p, road.b ? 0.32 : 0.035), material));
  }
  root.add(roadGroup);

  const coastMaterial = new THREE.LineBasicMaterial({ color: 0x5fe4ff, transparent: true, opacity: 0.43, blending: THREE.AdditiveBlending });
  for (const coast of data.coasts) root.add(new THREE.Line(lineGeometry(coast, 0.025), coastMaterial));

  const inlandWaterMaterial = new THREE.MeshBasicMaterial({ color: 0x061631, transparent: true, opacity: 0.76, side: THREE.DoubleSide });
  for (const polygon of data.waters) {
    if (polygon.length < 3) continue;
    const geometry = new THREE.ShapeGeometry(shapeFrom(polygon));
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, inlandWaterMaterial);
    mesh.position.y = -0.12;
    root.add(mesh);
  }

  const facadeMaterials = {};
  const roofMaterials = {};
  Object.entries(PALETTES).forEach(([kind, palette], index) => {
    const texture = createWindowTexture(palette.window, index + 1);
    facadeMaterials[kind] = new THREE.MeshStandardMaterial({
      color: palette.wall,
      map: texture,
      emissiveMap: texture,
      emissive: new THREE.Color(palette.window),
      emissiveIntensity: palette.emissive,
      roughness: 0.63,
      metalness: kind === "hotel" || kind === "commercial" ? 0.34 : 0.13
    });
    roofMaterials[kind] = new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.74, metalness: 0.2 });
  });

  const buildingGroup = new THREE.Group();
  data.buildings.forEach((building, index) => {
    const kind = PALETTES[building.k] ? building.k : "residential";
    const height = Math.max(0.55, building.h);
    const geometry = new THREE.ExtrudeGeometry(shapeFrom(building.p), {
      depth: height,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1
    });
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, [roofMaterials[kind], facadeMaterials[kind]]);
    mesh.position.y = 0.015;
    mesh.userData = { kind, height, area: building.a };
    buildingGroup.add(mesh);

    if (height > 8 && seeded(index) > 0.8) {
      const centroid = building.p.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]).map(value => value / building.p.length);
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 7, 5),
        new THREE.MeshBasicMaterial({ color: 0xff4657 })
      );
      beacon.position.set(centroid[0], height + 0.12, centroid[1]);
      root.add(beacon);
    }
  });
  root.add(buildingGroup);

  const hemisphere = new THREE.HemisphereLight(0x6f92cf, 0x02040a, 0.78);
  const moon = new THREE.DirectionalLight(0xa4c1ff, 1.12);
  moon.position.set(-55, 95, 40);
  const warmFill = new THREE.DirectionalLight(0xff9470, 0.24);
  warmFill.position.set(70, 28, -45);
  root.add(hemisphere, moon, warmFill);

  root.userData.meta = data.meta;
  root.userData.buildings = buildingGroup;
  root.userData.roads = roadGroup;
  return root;
}
