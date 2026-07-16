import boundaryData from './moalboal-boundaries.json';

type Point = [number, number];
type Geometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: Point[][] | Point[][][] };
type Feature = { properties: { name: string }; geometry: Geometry };

const features = boundaryData.features as unknown as Feature[];
export const officialBarangays = features.map(({ properties }) => properties.name).sort((a, b) => a.localeCompare(b));

const polygons = (geometry: Geometry): Point[][][] =>
  geometry.type === 'Polygon' ? [geometry.coordinates as Point[][]] : geometry.coordinates as Point[][][];

const inRing = ([x, y]: Point, ring: Point[]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const inGeometry = (point: Point, geometry: Geometry) =>
  polygons(geometry).some((polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole)));

const segmentDistanceSquared = (point: Point, a: Point, b: Point) => {
  let [x, y] = a;
  const dx = b[0] - x;
  const dy = b[1] - y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point[0] - x) * dx + (point[1] - y) * dy) / length)) : 0;
  x += t * dx;
  y += t * dy;
  return (point[0] - x) ** 2 + (point[1] - y) ** 2;
};

const distanceToGeometry = (point: Point, geometry: Geometry) => {
  if (inGeometry(point, geometry)) return 0;
  let closest = Number.POSITIVE_INFINITY;
  for (const polygon of polygons(geometry)) {
    for (const ring of polygon) {
      for (let i = 1; i < ring.length; i++) closest = Math.min(closest, segmentDistanceSquared(point, ring[i - 1], ring[i]));
    }
  }
  return closest;
};

const localityPatterns: Array<[string, RegExp]> = [
  ['White Beach / Basdaku', /white beach|basdaku|basdako/i],
  ['Panagsama', /panagsama/i],
  ['Tongo', /\btongo\b/i],
  ['Bantayan', /\bbantayan\b/i],
  ['Bangag', /\bbangag\b/i],
  ['Cogon', /\bcogon\b/i],
];

export interface PlaceGeography {
  barangay: string;
  locality: string;
  hierarchy: string[];
}

export function getPlaceGeography(data: { barangay: string; address: string; coordinates: { lat: number; lng: number } | null; name: string }): PlaceGeography {
  const searchable = `${data.barangay} ${data.address}`;
  let locality = localityPatterns.find(([, pattern]) => pattern.test(searchable))?.[0] ?? '';
  if (!locality && data.barangay !== 'Moalboal' && !officialBarangays.includes(data.barangay)) locality = data.barangay;

  let barangay = officialBarangays.includes(data.barangay) ? data.barangay : '';
  if (data.coordinates) {
    const point: Point = [data.coordinates.lng, data.coordinates.lat];
    const feature = features.find(({ geometry }) => inGeometry(point, geometry))
      ?? features.reduce((closest, candidate) =>
        distanceToGeometry(point, candidate.geometry) < distanceToGeometry(point, closest.geometry) ? candidate : closest
      );
    barangay = feature.properties.name;
  }

  if (!barangay && ['Panagsama', 'Tongo', 'Bantayan', 'Cogon'].includes(locality)) barangay = 'Basdiot';
  if (!barangay && ['White Beach / Basdaku', 'Bangag'].includes(locality)) barangay = 'Saavedra';

  return {
    barangay: barangay || 'Barangay to verify',
    locality,
    hierarchy: ['Moalboal', `Barangay ${barangay || 'to verify'}`, ...(locality ? [locality] : []), data.name],
  };
}
