export const barangayFacts: Record<string, { population: number; highlight: string; localities?: string[] }> = {
  Agbalanga: { population: 1120, highlight: 'A quiet upland barangay shaped by farms, forest edges and rural Cebuano life.' },
  Bala: { population: 893, highlight: 'An inland farming community with open country and a slower pace away from the visitor coast.' },
  Balabagon: { population: 2208, highlight: 'Moalboal’s southern coastal gateway, with local neighbourhoods and access toward the quieter south shore.' },
  Basdiot: { population: 6620, highlight: 'Home to Panagsama, the sardine run, Tongo, dive centres, cafés and Moalboal’s liveliest visitor district.', localities: ['Panagsama', 'Tongo', 'Bantayan', 'Cogon'] },
  Batadbatad: { population: 1508, highlight: 'A broad inland barangay of farms and foothills on the municipality’s eastern side.' },
  Bugho: { population: 2241, highlight: 'A central inland community linking the poblacion with Moalboal’s agricultural interior.' },
  Buguil: { population: 735, highlight: 'Moalboal’s smallest barangay by population, set among the quieter eastern uplands.' },
  Busay: { population: 1628, highlight: 'A rural southern upland barangay known more for countryside and agriculture than tourism.' },
  Lanao: { population: 2071, highlight: 'A north-eastern residential and farming area, removed from the main beach strips.' },
  'Poblacion East': { population: 3182, highlight: 'The practical town hub for the public market, supermarkets, transport, pharmacies and everyday errands.', localities: ['Town centre', 'Public market area'] },
  'Poblacion West': { population: 2998, highlight: 'The compact civic and historic side of central Moalboal, close to the municipal core and coast road.', localities: ['Civic centre'] },
  Saavedra: { population: 3760, highlight: 'Home to White Beach, also called Basdaku, with sand, swimming, sunsets and a quieter resort scene.', localities: ['White Beach / Basdaku', 'Bangag'] },
  Tomonoy: { population: 3188, highlight: 'A southern barangay mixing coastal plain, local neighbourhoods and countryside beyond the tourist centre.' },
  Tuble: { population: 3078, highlight: 'A coastal connector between Panagsama and Saavedra, with scattered stays, dive access and quieter roads.' },
  Tunga: { population: 2763, highlight: 'A central residential barangay linking the poblacion, Tuble and the northern coastal areas.' },
};

export const mapPlaces = {
  town: { name: 'Town centre', lat: 9.9375174, lng: 123.3934231 },
  white: { name: 'White Beach', lat: 9.9855, lng: 123.3687 },
  panagsama: { name: 'Panagsama Beach', lat: 9.9492, lng: 123.3659 },
  tongo: { name: 'Tongo Beach', lat: 9.9346, lng: 123.3765 },
} as const;

export const mapSources = [
  {
    label: 'PSA Philippine Standard Geographic Code — 2024 POPCEN',
    url: 'https://psa.gov.ph/classification/psgc/barangays/0702233000',
  },
  {
    label: 'PSGC / NAMRIA barangay boundaries (2023)',
    url: 'https://github.com/bendlikeabamboo/barangay-boundaries-repository',
  },
];
