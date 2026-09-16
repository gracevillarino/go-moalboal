export type DiveSite = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  depthMetres: string;
  level: 'Beginner' | 'All levels' | 'Advanced';
  summary: string;
  /** Half-width/height in degrees for the iNaturalist bounding-box search around this site. */
  radiusDegrees?: number;
};

// Coordinates are approximate site centres, useful for orientation and for building an
// iNaturalist bounding-box search — not GPS entry points for diving or boating.
export const diveSites: DiveSite[] = [
  {
    slug: 'panagsama-house-reef',
    name: 'Panagsama House Reef & Sardine Run',
    lat: 9.9492,
    lng: 123.3652,
    depthMetres: '3–20m',
    level: 'All levels',
    summary: 'Shore-entry reef right off Panagsama, home to Moalboal’s famous dense sardine school along with jacks, frogfish, moray eels and octopus.',
  },
  {
    slug: 'pescador-island',
    name: 'Pescador Island',
    lat: 9.9217,
    lng: 123.3436,
    depthMetres: '5–55m+',
    level: 'Advanced',
    summary: 'A boat trip from Panagsama to a small limestone island with a shallow reef, steep drop-offs and the Cathedral swim-through cave.',
  },
  {
    slug: 'airplane-wreck',
    name: 'Airplane Wreck',
    lat: 9.9505,
    lng: 123.3590,
    depthMetres: '~20m',
    level: 'Advanced',
    summary: 'A small two-seat aircraft sunk off Panagsama as an artificial reef, now grown over with coral and home to garden eels.',
  },
  {
    slug: 'sunken-island',
    name: 'Sunken Island',
    lat: 9.9280,
    lng: 123.3500,
    depthMetres: '25m+',
    level: 'Advanced',
    summary: 'An underwater pinnacle near Pescador for experienced divers, known for lionfish, frogfish and passing pelagics.',
  },
  {
    slug: 'tongo-point',
    name: 'Tongo Point Marine Sanctuary',
    lat: 9.9335,
    lng: 123.3745,
    depthMetres: '5–40m',
    level: 'Advanced',
    summary: 'A deep reef wall inside a marine sanctuary south of Panagsama, with caves, turtles, fusiliers and the occasional barracuda.',
  },
  {
    slug: 'tuble-marine-sanctuary',
    name: 'Tuble Marine Sanctuary',
    lat: 9.9650,
    lng: 123.3670,
    depthMetres: '5–30m',
    level: 'All levels',
    summary: 'A protected reef between Panagsama and White Beach, generally calmer and good for spotting reef fish and macro life.',
  },
  {
    slug: 'white-beach-reef',
    name: 'White Beach (Basdaku) Reef',
    lat: 9.9855,
    lng: 123.3670,
    depthMetres: '3–15m',
    level: 'Beginner',
    summary: 'A shallow, sandy-bottomed reef off Saavedra’s White Beach, well suited to beginners, snorkellers and easy check-out dives.',
  },
];

const defaultRadius = 0.012;

/** Bounding-box iNaturalist observations link, centred on the dive site. */
export const iNaturalistUrl = (site: DiveSite) => {
  const radius = site.radiusDegrees ?? defaultRadius;
  const params = new URLSearchParams({
    nelat: String(site.lat + radius),
    nelng: String(site.lng + radius),
    swlat: String(site.lat - radius),
    swlng: String(site.lng - radius),
    subview: 'map',
    view: 'species',
  });
  return `https://www.inaturalist.org/observations?${params.toString()}`;
};

export const moalboalINaturalistUrl = 'https://www.inaturalist.org/observations?place_id=26245&subview=map&view=species';
