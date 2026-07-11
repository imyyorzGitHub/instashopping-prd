const MAX_ATTEMPTS = 180;
const RETRY_MS = 80;

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function disposeMesh(mesh) {
  mesh.geometry?.dispose?.();
  materialList(mesh.material).forEach(material => material?.dispose?.());
}

function findMacauScene() {
  const rig = window.__h1V3LightingRig;
  return rig?.ambient?.parent || rig?.sky?.parent || null;
}

function removeRectangularBase() {
  const scene = findMacauScene();
  const city = scene?.getObjectByName?.("macau-osm-city");
  if (!city) return false;

  const candidates = city.children.filter(object => {
    if (!object?.isMesh || object.geometry?.type !== "PlaneGeometry") return false;
    const { width = 0, height = 0 } = object.geometry.parameters || {};
    return width >= 300 && height >= 300;
  });

  candidates.forEach(mesh => {
    city.remove(mesh);
    disposeMesh(mesh);
  });

  window.__h1V3MacauOutlineAudit = {
    applied: true,
    removedRectangularBases: candidates.length,
    preservedUrbanLand: Boolean(city.children.find(object => object.geometry?.type === "BufferGeometry")),
    preservedCoastline: city.children.some(object => object.isLineSegments),
    outerCanvasTransparent: true
  };

  return true;
}

let attempts = 0;
function waitForCity() {
  attempts += 1;
  if (removeRectangularBase()) return;

  if (attempts >= MAX_ATTEMPTS) {
    window.__h1V3MacauOutlineAudit = {
      applied: false,
      reason: "city-scene-not-ready",
      attempts
    };
    return;
  }

  window.setTimeout(waitForCity, RETRY_MS);
}

waitForCity();
