#!/usr/bin/env python3
import json, math, re, time, urllib.parse, urllib.request
from pathlib import Path

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
]
CENTER_LAT = 22.1717
CENTER_LON = 113.5527
OUT = Path("reports/2026-h1-cinematic-v3/city-data.json")

QUERY = r'''[out:json][timeout:240];
rel["ISO3166-1"="MO"]["boundary"="administrative"];
map_to_area->.mo;
(
  way["building"](area.mo);
  way["highway"](area.mo);
  way["bridge"](area.mo);
  way["natural"="coastline"](area.mo);
  way["natural"="water"](area.mo);
  way["water"](area.mo);
  way["waterway"="riverbank"](area.mo);
  relation["natural"="water"](area.mo);
  relation["water"](area.mo);
);
out tags geom;
'''

def fetch_overpass(query):
    data = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for endpoint in ENDPOINTS:
        for attempt in range(3):
            try:
                req = urllib.request.Request(endpoint, data=data, headers={"User-Agent": "instashopping-prd-cinematic/1.0"})
                with urllib.request.urlopen(req, timeout=300) as response:
                    return json.load(response)
            except Exception as exc:
                last = exc
                time.sleep(4 * (attempt + 1))
    raise RuntimeError(f"Overpass failed: {last}")

def local_xy(lat, lon):
    x = (lon - CENTER_LON) * 111320.0 * math.cos(math.radians(CENTER_LAT))
    z = -(lat - CENTER_LAT) * 110540.0
    return [round(x / 55.0, 3), round(z / 55.0, 3)]

def ring_area(points):
    area = 0.0
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        area += x1 * y2 - x2 * y1
    return abs(area) * 0.5 * (55.0 ** 2)

def simplify(points, epsilon=0.08):
    if len(points) < 3:
        return points
    def distance(point, start, end):
        dx, dy = end[0] - start[0], end[1] - start[1]
        if dx == 0 and dy == 0:
            return math.hypot(point[0] - start[0], point[1] - start[1])
        t = max(0, min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)))
        qx, qy = start[0] + t * dx, start[1] + t * dy
        return math.hypot(point[0] - qx, point[1] - qy)
    def douglas_peucker(sequence):
        if len(sequence) <= 2:
            return sequence
        start, end = sequence[0], sequence[-1]
        index, max_distance = -1, 0
        for i, point in enumerate(sequence[1:-1], 1):
            current = distance(point, start, end)
            if current > max_distance:
                index, max_distance = i, current
        if max_distance > epsilon:
            left = douglas_peucker(sequence[:index + 1])
            right = douglas_peucker(sequence[index:])
            return left[:-1] + right
        return [start, end]
    return douglas_peucker(points)

def parse_height(tags, area, osm_id):
    raw = tags.get("height", "")
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)", raw)
    if match:
        height = float(match.group(1))
        if "ft" in raw:
            height *= 0.3048
        return max(3, min(260, height))
    levels = tags.get("building:levels")
    if levels:
        try:
            return max(3, min(220, float(levels) * 3.15 + 1.5))
        except ValueError:
            pass
    kind = (tags.get("building") or "").lower()
    seed = (osm_id * 2654435761) % 997 / 997
    if kind in {"hotel", "commercial", "office", "retail"}:
        base = 28 + seed * 45
    elif kind in {"apartments", "residential"}:
        base = 18 + seed * 38
    elif area > 1800:
        base = 24 + seed * 50
    elif area > 700:
        base = 12 + seed * 26
    else:
        base = 6 + seed * 14
    return round(base, 1)

def classify(tags):
    source = " ".join(str(tags.get(key, "")) for key in ("building", "amenity", "tourism", "landuse", "name")).lower()
    if any(token in source for token in ("hotel", "casino", "resort")):
        return "hotel"
    if any(token in source for token in ("commercial", "office", "retail", "mall")):
        return "commercial"
    if any(token in source for token in ("school", "hospital", "university", "civic", "public", "government")):
        return "public"
    if any(token in source for token in ("industrial", "warehouse", "hangar")):
        return "industrial"
    return "residential"

def geometry_points(element):
    geometry = element.get("geometry") or []
    points = [local_xy(point["lat"], point["lon"]) for point in geometry if "lat" in point and "lon" in point]
    unique = []
    for point in points:
        if not unique or point != unique[-1]:
            unique.append(point)
    return unique

raw = fetch_overpass(QUERY)
buildings, roads, coasts, waters = [], [], [], []
road_allow = {"motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "service", "pedestrian", "living_street"}
for element in raw.get("elements", []):
    tags = element.get("tags") or {}
    points = geometry_points(element)
    if len(points) < 2:
        continue
    if "building" in tags and len(points) >= 4:
        if points[0] == points[-1]:
            points = points[:-1]
        points = simplify(points, 0.035)
        if len(points) < 3:
            continue
        area = ring_area(points)
        if area < 55:
            continue
        buildings.append({"p": points, "h": round(parse_height(tags, area, element["id"]) / 7.0, 2), "k": classify(tags), "a": round(area)})
    elif tags.get("highway") in road_allow:
        roads.append({"p": simplify(points, 0.06), "k": tags.get("highway"), "b": bool(tags.get("bridge") == "yes" or "bridge" in tags)})
    elif tags.get("natural") == "coastline":
        coasts.append(simplify(points, 0.05))
    elif tags.get("natural") == "water" or tags.get("water") or tags.get("waterway") == "riverbank":
        if points[0] == points[-1]:
            points = points[:-1]
        if len(points) >= 3:
            waters.append(simplify(points, 0.06))

buildings.sort(key=lambda building: building["a"], reverse=True)
large = buildings[:1800]
small = [building for building in buildings[1800:] if ((int(building["a"]) * 31 + len(building["p"]) * 17) % 5) == 0][:1400]
buildings = large + small
priority = {"motorway": 0, "trunk": 1, "primary": 2, "secondary": 3, "tertiary": 4, "unclassified": 5, "residential": 6, "living_street": 7, "pedestrian": 8, "service": 9}
roads.sort(key=lambda road: priority.get(road["k"], 10))
roads = roads[:2400]

payload = {
    "meta": {
        "source": "OpenStreetMap / Overpass",
        "license": "ODbL",
        "center": [CENTER_LAT, CENTER_LON],
        "scaleMetersPerUnit": 55,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "counts": {"buildings": len(buildings), "roads": len(roads), "coasts": len(coasts), "waters": len(waters)},
    },
    "buildings": buildings,
    "roads": roads,
    "coasts": coasts,
    "waters": waters,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
print(OUT, OUT.stat().st_size, payload["meta"])
