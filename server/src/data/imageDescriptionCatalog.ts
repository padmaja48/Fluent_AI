export type ImageDescriptionLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type ImageDescriptionItem = {
  id: string;
  level: ImageDescriptionLevel;
  title: string;
  imageUrl: string;
  alt: string;
  credit: string;
  prompt: string;
  keywords: string[];
  suggestions: string[];
};

const LEVELS: ImageDescriptionLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const levelVocabulary: Record<ImageDescriptionLevel, string[]> = {
  A1: ['person', 'place', 'thing', 'color', 'near', 'happy'],
  A2: ['busy', 'outside', 'inside', 'behind', 'next to', 'because'],
  B1: ['activity', 'background', 'probably', 'environment', 'conversation', 'routine'],
  B2: ['contrast', 'interaction', 'atmosphere', 'evidence', 'purpose', 'situation'],
  C1: ['implication', 'perspective', 'composition', 'underlying', 'suggests', 'context'],
  C2: ['nuance', 'ambiguity', 'symbolic', 'juxtaposition', 'inference', 'interpretation'],
};

const promptByLevel: Record<ImageDescriptionLevel, string> = {
  A1: 'Look at the image and speak for 60 seconds. Say what you see, where things are, and what people are doing.',
  A2: 'Look at the image and speak for 60 seconds. Describe the people, place, objects, and what might happen next.',
  B1: 'Look at the image and speak for 60 seconds. Describe what you see, what is happening, and why it might be happening.',
  B2: 'Look at the image and speak for 60 seconds. Describe the situation, compare details, and explain what may happen next.',
  C1: 'Look at the image and speak for 60 seconds. Describe the scene, infer context, and explain possible causes or consequences.',
  C2: 'Look at the image and speak for 60 seconds. Describe explicit details, implicit meaning, and alternative interpretations.',
};

const scenarios = [
  {
    slug: 'coffee-shop',
    title: 'People in a coffee shop',
    query: 'coffee-shop,people',
    alt: 'People sitting and talking in a coffee shop',
    keywords: ['coffee', 'table', 'people', 'talking', 'cup', 'cafe'],
    suggestions: ['counter', 'customer', 'conversation'],
  },
  {
    slug: 'city-market',
    title: 'A busy street market',
    query: 'street-market,vegetables',
    alt: 'Vendors and shoppers at a street market',
    keywords: ['market', 'shopper', 'vendor', 'fruit', 'vegetables', 'busy'],
    suggestions: ['stall', 'bargain', 'fresh produce'],
  },
  {
    slug: 'classroom',
    title: 'A classroom activity',
    query: 'classroom,students',
    alt: 'Students learning in a classroom',
    keywords: ['classroom', 'students', 'teacher', 'desk', 'lesson', 'board'],
    suggestions: ['assignment', 'discussion', 'attention'],
  },
  {
    slug: 'train-station',
    title: 'A train station platform',
    query: 'train-station,commuters',
    alt: 'People waiting at a train station platform',
    keywords: ['train', 'station', 'platform', 'waiting', 'travel', 'passenger'],
    suggestions: ['departure', 'schedule', 'commute'],
  },
  {
    slug: 'park-family',
    title: 'A family in a park',
    query: 'family,park,picnic',
    alt: 'A family spending time together in a park',
    keywords: ['family', 'park', 'grass', 'children', 'picnic', 'relaxing'],
    suggestions: ['weekend', 'blanket', 'playground'],
  },
  {
    slug: 'office-meeting',
    title: 'An office meeting',
    query: 'office-meeting,team',
    alt: 'A team discussing work in an office',
    keywords: ['office', 'meeting', 'team', 'laptop', 'presentation', 'discussion'],
    suggestions: ['agenda', 'decision', 'collaboration'],
  },
  {
    slug: 'doctor-visit',
    title: 'A visit to the doctor',
    query: 'doctor,patient,clinic',
    alt: 'A doctor speaking with a patient',
    keywords: ['doctor', 'patient', 'clinic', 'health', 'checkup', 'medicine'],
    suggestions: ['symptom', 'appointment', 'advice'],
  },
  {
    slug: 'kitchen-cooking',
    title: 'Cooking in a kitchen',
    query: 'kitchen,cooking,vegetables',
    alt: 'Someone preparing food in a kitchen',
    keywords: ['kitchen', 'cooking', 'food', 'vegetables', 'pan', 'meal'],
    suggestions: ['recipe', 'ingredients', 'prepare'],
  },
  {
    slug: 'rainy-street',
    title: 'A rainy street scene',
    query: 'rainy-street,umbrella',
    alt: 'People walking on a rainy street with umbrellas',
    keywords: ['rain', 'street', 'umbrella', 'walking', 'wet', 'weather'],
    suggestions: ['pavement', 'forecast', 'shelter'],
  },
  {
    slug: 'grocery-store',
    title: 'Shopping in a grocery store',
    query: 'grocery-store,shopping',
    alt: 'A person shopping in a grocery store',
    keywords: ['grocery', 'store', 'shopping', 'basket', 'shelf', 'food'],
    suggestions: ['aisle', 'checkout', 'list'],
  },
  {
    slug: 'airport-luggage',
    title: 'Travelers at an airport',
    query: 'airport,luggage,travelers',
    alt: 'Travelers standing with luggage at an airport',
    keywords: ['airport', 'luggage', 'flight', 'travel', 'waiting', 'passenger'],
    suggestions: ['boarding', 'terminal', 'delay'],
  },
  {
    slug: 'graph-presentation',
    title: 'A graph presentation',
    query: 'business-graph,presentation',
    alt: 'A person presenting a graph in a business setting',
    keywords: ['graph', 'chart', 'presentation', 'data', 'increase', 'business'],
    suggestions: ['trend', 'figures', 'analysis'],
  },
  {
    slug: 'library-study',
    title: 'Studying in a library',
    query: 'library,studying,books',
    alt: 'A person studying with books in a library',
    keywords: ['library', 'books', 'study', 'reading', 'quiet', 'table'],
    suggestions: ['research', 'notes', 'concentrate'],
  },
  {
    slug: 'sports-practice',
    title: 'People practicing sport',
    query: 'sports-practice,football',
    alt: 'People practicing a sport outdoors',
    keywords: ['sport', 'practice', 'team', 'field', 'ball', 'exercise'],
    suggestions: ['coach', 'training', 'competition'],
  },
  {
    slug: 'bus-stop',
    title: 'Waiting at a bus stop',
    query: 'bus-stop,people',
    alt: 'People waiting at a bus stop',
    keywords: ['bus', 'stop', 'waiting', 'road', 'people', 'transport'],
    suggestions: ['route', 'ticket', 'arrival'],
  },
  {
    slug: 'phone-repair',
    title: 'A phone repair desk',
    query: 'smartphone,repair,desk',
    alt: 'A smartphone being repaired on a desk',
    keywords: ['phone', 'repair', 'screen', 'desk', 'tool', 'technology'],
    suggestions: ['device', 'broken', 'technician'],
  },
  {
    slug: 'restaurant-table',
    title: 'A meal at a restaurant',
    query: 'restaurant,meal,table',
    alt: 'People eating a meal at a restaurant table',
    keywords: ['restaurant', 'meal', 'table', 'plate', 'server', 'menu'],
    suggestions: ['order', 'bill', 'reservation'],
  },
  {
    slug: 'construction-site',
    title: 'A construction site',
    query: 'construction-site,workers',
    alt: 'Workers at a construction site',
    keywords: ['construction', 'worker', 'helmet', 'building', 'machine', 'site'],
    suggestions: ['safety', 'equipment', 'progress'],
  },
  {
    slug: 'beach-cleanup',
    title: 'Cleaning a beach',
    query: 'beach-cleanup,volunteers',
    alt: 'Volunteers collecting litter on a beach',
    keywords: ['beach', 'clean', 'volunteer', 'plastic', 'water', 'environment'],
    suggestions: ['community', 'pollution', 'responsibility'],
  },
  {
    slug: 'home-office',
    title: 'Working from home',
    query: 'home-office,laptop',
    alt: 'A person working at a laptop from home',
    keywords: ['home', 'office', 'laptop', 'work', 'desk', 'online'],
    suggestions: ['remote', 'meeting', 'focus'],
  },
  {
    slug: 'traffic-crossing',
    title: 'A busy road crossing',
    query: 'pedestrian-crossing,traffic',
    alt: 'People crossing a busy road',
    keywords: ['traffic', 'road', 'crossing', 'cars', 'people', 'city'],
    suggestions: ['signal', 'rush hour', 'pedestrian'],
  },
  {
    slug: 'art-museum',
    title: 'Visitors in a museum',
    query: 'museum,art,visitors',
    alt: 'People looking at artwork in a museum',
    keywords: ['museum', 'art', 'painting', 'visitor', 'gallery', 'looking'],
    suggestions: ['exhibition', 'display', 'interpretation'],
  },
  {
    slug: 'garden-plants',
    title: 'Gardening with plants',
    query: 'gardening,plants',
    alt: 'A person caring for plants in a garden',
    keywords: ['garden', 'plants', 'water', 'soil', 'flowers', 'grow'],
    suggestions: ['seedling', 'harvest', 'care'],
  },
  {
    slug: 'small-business',
    title: 'A small business counter',
    query: 'small-business,counter,customer',
    alt: 'A customer at a small business counter',
    keywords: ['business', 'customer', 'counter', 'payment', 'service', 'shop'],
    suggestions: ['receipt', 'owner', 'transaction'],
  },
];

const palette = [
  ['#e0f2fe', '#0f766e', '#f59e0b', '#1e293b'],
  ['#fef3c7', '#7c2d12', '#2563eb', '#334155'],
  ['#dcfce7', '#166534', '#ea580c', '#0f172a'],
  ['#ede9fe', '#6d28d9', '#0891b2', '#111827'],
  ['#fee2e2', '#be123c', '#0284c7', '#1f2937'],
  ['#f1f5f9', '#475569', '#16a34a', '#0f172a'],
];

const svgText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sceneElementsFor = (slug: string, colors: string[]) => {
  const [, primary, secondary, ink] = colors;
  const person = (x: number, y: number, shirt = primary) => `
    <circle cx="${x}" cy="${y}" r="20" fill="#f8cfae"/>
    <rect x="${x - 18}" y="${y + 22}" width="36" height="58" rx="16" fill="${shirt}"/>
    <rect x="${x - 32}" y="${y + 42}" width="64" height="12" rx="6" fill="${shirt}" opacity=".72"/>
  `;

  const table = (x: number, y: number, w = 190) => `
    <rect x="${x}" y="${y}" width="${w}" height="24" rx="10" fill="${ink}" opacity=".82"/>
    <rect x="${x + 24}" y="${y + 20}" width="18" height="92" rx="8" fill="${ink}" opacity=".5"/>
    <rect x="${x + w - 42}" y="${y + 20}" width="18" height="92" rx="8" fill="${ink}" opacity=".5"/>
  `;

  const laptop = (x: number, y: number) => `
    <rect x="${x}" y="${y}" width="94" height="58" rx="6" fill="#dbeafe" stroke="${ink}" stroke-width="5"/>
    <rect x="${x - 16}" y="${y + 62}" width="126" height="12" rx="6" fill="${ink}" opacity=".75"/>
  `;

  const scenes: Record<string, string> = {
    'coffee-shop': `${person(235, 215, primary)}${person(455, 220, secondary)}${table(245, 320, 300)}<circle cx="345" cy="305" r="17" fill="#fff7ed"/><circle cx="412" cy="305" r="17" fill="#fff7ed"/><rect x="70" y="82" width="760" height="70" rx="22" fill="${primary}" opacity=".2"/>`,
    'city-market': `<rect x="80" y="180" width="260" height="190" rx="18" fill="${primary}" opacity=".24"/><rect x="430" y="160" width="300" height="210" rx="18" fill="${secondary}" opacity=".18"/>${person(250, 235, primary)}${person(560, 230, secondary)}<circle cx="150" cy="350" r="26" fill="#ef4444"/><circle cx="195" cy="350" r="26" fill="#22c55e"/><circle cx="240" cy="350" r="26" fill="#facc15"/>`,
    classroom: `<rect x="95" y="95" width="710" height="150" rx="18" fill="#14532d"/><line x1="135" y1="145" x2="360" y2="145" stroke="#dcfce7" stroke-width="10"/><line x1="135" y1="185" x2="500" y2="185" stroke="#dcfce7" stroke-width="10"/>${person(190, 330, primary)}${person(355, 335, secondary)}${person(520, 330, primary)}${table(130, 405, 560)}`,
    'train-station': `<rect x="80" y="320" width="740" height="34" fill="${ink}" opacity=".5"/><rect x="120" y="210" width="560" height="92" rx="22" fill="${primary}" opacity=".75"/><circle cx="220" cy="302" r="34" fill="${ink}"/><circle cx="570" cy="302" r="34" fill="${ink}"/>${person(730, 215, secondary)}<rect x="708" y="305" width="48" height="70" rx="8" fill="${secondary}"/>`,
    'park-family': `<circle cx="160" cy="125" r="62" fill="#86efac"/><circle cx="750" cy="125" r="58" fill="#bbf7d0"/><path d="M40 420 Q250 340 450 405 T860 390 V600 H40 Z" fill="#22c55e" opacity=".24"/>${person(260, 260, primary)}${person(410, 250, secondary)}${person(560, 285, primary)}<rect x="300" y="405" width="250" height="48" rx="18" fill="#f97316" opacity=".72"/>`,
    'office-meeting': `${table(220, 340, 470)}${person(230, 210, primary)}${person(420, 190, secondary)}${person(610, 215, primary)}${laptop(380, 270)}<rect x="650" y="110" width="155" height="110" rx="14" fill="#dbeafe" stroke="${secondary}" stroke-width="5"/><polyline points="675,185 705,160 735,174 780,132" fill="none" stroke="${primary}" stroke-width="8"/>`,
    'doctor-visit': `<rect x="105" y="125" width="690" height="330" rx="28" fill="#f8fafc" stroke="${primary}" stroke-width="8"/>${person(285, 225, primary)}${person(585, 240, secondary)}<rect x="230" y="330" width="440" height="62" rx="20" fill="#e2e8f0"/><path d="M450 150 v80 M410 190 h80" stroke="#ef4444" stroke-width="18" stroke-linecap="round"/>`,
    'kitchen-cooking': `<rect x="90" y="145" width="720" height="290" rx="24" fill="#f8fafc"/><rect x="130" y="340" width="640" height="95" fill="${ink}" opacity=".16"/>${person(360, 210, primary)}<rect x="455" y="290" width="170" height="52" rx="20" fill="${secondary}"/><circle cx="495" cy="275" r="20" fill="#22c55e"/><circle cx="545" cy="275" r="20" fill="#ef4444"/><circle cx="595" cy="275" r="20" fill="#facc15"/>`,
    'rainy-street': `<rect x="0" y="0" width="900" height="600" fill="#dbeafe"/><path d="M0 420 H900 V600 H0 Z" fill="#64748b"/><path d="M175 210 Q250 125 325 210 Z" fill="${primary}"/><path d="M520 220 Q600 130 680 220 Z" fill="${secondary}"/>${person(250, 230, primary)}${person(600, 245, secondary)}<g stroke="#1d4ed8" stroke-width="5" opacity=".45"><line x1="90" y1="70" x2="60" y2="125"/><line x1="230" y1="55" x2="200" y2="112"/><line x1="420" y1="80" x2="390" y2="140"/><line x1="700" y1="60" x2="670" y2="118"/></g>`,
    'grocery-store': `<rect x="95" y="105" width="250" height="330" rx="18" fill="${primary}" opacity=".18"/><rect x="410" y="105" width="250" height="330" rx="18" fill="${secondary}" opacity=".16"/><g fill="#f97316"><circle cx="155" cy="180" r="18"/><circle cx="215" cy="180" r="18"/><circle cx="275" cy="180" r="18"/></g><g fill="#22c55e"><circle cx="470" cy="255" r="18"/><circle cx="530" cy="255" r="18"/><circle cx="590" cy="255" r="18"/></g>${person(735, 245, primary)}<rect x="680" y="350" width="110" height="70" rx="14" fill="${ink}" opacity=".45"/>`,
    'airport-luggage': `<rect x="90" y="115" width="720" height="120" rx="24" fill="#e0f2fe"/><path d="M150 175 H745" stroke="${primary}" stroke-width="14"/><path d="M0 420 H900 V600 H0 Z" fill="#e2e8f0"/>${person(275, 250, primary)}${person(520, 250, secondary)}<rect x="210" y="360" width="60" height="88" rx="10" fill="${secondary}"/><rect x="575" y="360" width="64" height="88" rx="10" fill="${primary}"/>`,
    'graph-presentation': `<rect x="110" y="95" width="520" height="315" rx="20" fill="#f8fafc" stroke="${ink}" stroke-width="6"/><polyline points="165,335 260,290 350,305 450,220 570,165" fill="none" stroke="${primary}" stroke-width="14" stroke-linecap="round"/><rect x="170" y="250" width="45" height="85" fill="${secondary}"/><rect x="260" y="210" width="45" height="125" fill="${secondary}" opacity=".75"/><rect x="350" y="175" width="45" height="160" fill="${secondary}" opacity=".55"/>${person(745, 255, primary)}`,
    'library-study': `<rect x="80" y="95" width="740" height="120" rx="18" fill="${ink}" opacity=".12"/><g fill="${primary}"><rect x="130" y="120" width="32" height="80"/><rect x="175" y="120" width="32" height="80"/><rect x="220" y="120" width="32" height="80"/><rect x="265" y="120" width="32" height="80"/></g>${table(250, 365, 410)}${person(455, 225, secondary)}${laptop(402, 295)}`,
    'sports-practice': `<path d="M0 400 Q220 330 455 390 T900 370 V600 H0 Z" fill="#22c55e" opacity=".34"/><rect x="110" y="120" width="680" height="320" rx="28" fill="none" stroke="#16a34a" stroke-width="10" opacity=".6"/>${person(270, 250, primary)}${person(590, 240, secondary)}<circle cx="455" cy="410" r="34" fill="#fff" stroke="${ink}" stroke-width="7"/>`,
    'bus-stop': `<rect x="130" y="130" width="420" height="260" rx="22" fill="#e0f2fe" stroke="${primary}" stroke-width="8"/><rect x="580" y="210" width="190" height="115" rx="28" fill="${secondary}" opacity=".75"/><circle cx="620" cy="330" r="24" fill="${ink}"/><circle cx="720" cy="330" r="24" fill="${ink}"/>${person(245, 245, primary)}${person(405, 250, secondary)}`,
    'phone-repair': `${table(190, 385, 520)}<rect x="355" y="225" width="160" height="105" rx="18" fill="#111827"/><rect x="375" y="245" width="120" height="65" rx="10" fill="#dbeafe"/><line x1="560" y1="245" x2="640" y2="185" stroke="${secondary}" stroke-width="12" stroke-linecap="round"/>${person(245, 225, primary)}`,
    'restaurant-table': `${table(230, 350, 440)}${person(245, 220, primary)}${person(610, 220, secondary)}<circle cx="385" cy="322" r="34" fill="#fff7ed" stroke="${ink}" stroke-width="4"/><circle cx="475" cy="322" r="34" fill="#fff7ed" stroke="${ink}" stroke-width="4"/><rect x="395" y="120" width="110" height="65" rx="14" fill="${primary}" opacity=".18"/>`,
    'construction-site': `<rect x="95" y="330" width="710" height="88" rx="14" fill="${ink}" opacity=".18"/><path d="M125 325 L300 145 L475 325 Z" fill="${secondary}" opacity=".4"/><rect x="520" y="150" width="70" height="250" fill="${primary}" opacity=".55"/>${person(275, 235, secondary)}${person(625, 235, primary)}<rect x="255" y="210" width="40" height="16" rx="8" fill="#facc15"/><rect x="605" y="210" width="40" height="16" rx="8" fill="#facc15"/>`,
    'beach-cleanup': `<rect x="0" y="0" width="900" height="315" fill="#bae6fd"/><path d="M0 300 Q230 250 450 300 T900 285 V600 H0 Z" fill="#fde68a"/><path d="M0 390 Q260 335 520 390 T900 370 V600 H0 Z" fill="#38bdf8" opacity=".5"/>${person(280, 260, primary)}${person(555, 270, secondary)}<rect x="350" y="385" width="60" height="40" rx="10" fill="#ef4444"/><rect x="635" y="385" width="52" height="38" rx="10" fill="#22c55e"/>`,
    'home-office': `${table(245, 355, 410)}${person(450, 205, primary)}${laptop(402, 282)}<rect x="105" y="115" width="160" height="180" rx="18" fill="${secondary}" opacity=".16"/><rect x="635" y="105" width="150" height="120" rx="18" fill="${primary}" opacity=".16"/>`,
    'traffic-crossing': `<rect x="0" y="305" width="900" height="295" fill="#475569"/><g fill="#f8fafc"><rect x="85" y="365" width="120" height="22"/><rect x="260" y="365" width="120" height="22"/><rect x="435" y="365" width="120" height="22"/><rect x="610" y="365" width="120" height="22"/></g><rect x="130" y="205" width="180" height="80" rx="24" fill="${primary}"/><rect x="560" y="215" width="190" height="80" rx="24" fill="${secondary}"/>${person(420, 220, primary)}`,
    'art-museum': `<rect x="120" y="110" width="220" height="160" rx="12" fill="#f8fafc" stroke="${primary}" stroke-width="10"/><rect x="500" y="100" width="240" height="175" rx="12" fill="#f8fafc" stroke="${secondary}" stroke-width="10"/><circle cx="230" cy="190" r="42" fill="${secondary}" opacity=".55"/><path d="M545 230 L620 150 L700 230 Z" fill="${primary}" opacity=".55"/>${person(330, 315, primary)}${person(570, 330, secondary)}`,
    'garden-plants': `<path d="M0 410 Q225 340 460 400 T900 380 V600 H0 Z" fill="#22c55e" opacity=".28"/>${person(430, 220, primary)}<g stroke="#166534" stroke-width="10" stroke-linecap="round"><line x1="180" y1="400" x2="180" y2="300"/><line x1="270" y1="410" x2="270" y2="285"/><line x1="650" y1="400" x2="650" y2="290"/></g><g fill="#86efac"><circle cx="150" cy="300" r="34"/><circle cx="210" cy="300" r="34"/><circle cx="240" cy="285" r="34"/><circle cx="620" cy="290" r="36"/><circle cx="685" cy="295" r="36"/></g>`,
    'small-business': `<rect x="120" y="150" width="660" height="255" rx="24" fill="#f8fafc" stroke="${primary}" stroke-width="8"/><rect x="160" y="330" width="580" height="88" rx="18" fill="${ink}" opacity=".16"/>${person(295, 235, primary)}${person(590, 235, secondary)}<rect x="415" y="270" width="95" height="58" rx="12" fill="${secondary}" opacity=".72"/><circle cx="490" cy="300" r="12" fill="#f8fafc"/>`,
  };

  return scenes[slug] ?? `${person(300, 230, primary)}${person(565, 235, secondary)}${table(240, 350, 420)}`;
};

const imageUrlFor = (scenario: (typeof scenarios)[number], level: ImageDescriptionLevel, index: number) => {
  const lock = 1000 + LEVELS.indexOf(level) * scenarios.length + index;
  return `https://loremflickr.com/900/600/${encodeURIComponent(scenario.query)}?lock=${lock}`;
};

export const imageDescriptionCatalog: ImageDescriptionItem[] = LEVELS.flatMap((level) =>
  scenarios.map((scenario, index) => ({
    id: `${level.toLowerCase()}-${scenario.slug}`,
    level,
    title: scenario.title,
    imageUrl: imageUrlFor(scenario, level, index + 1),
    alt: scenario.alt,
    credit: 'Real photo',
    prompt: promptByLevel[level],
    keywords: Array.from(new Set([...scenario.keywords, ...levelVocabulary[level]])),
    suggestions: scenario.suggestions,
  })),
);

export const getImageDescriptionItems = (level: ImageDescriptionLevel) =>
  imageDescriptionCatalog.filter((item) => item.level === level);

export const getImageDescriptionItem = (id: string, level: ImageDescriptionLevel) =>
  imageDescriptionCatalog.find((item) => item.id === id && item.level === level);

export const publicImageDescriptionItem = (item: ImageDescriptionItem) => ({
  id: item.id,
  level: item.level,
  title: item.title,
  imageUrl: item.imageUrl,
  alt: item.alt,
  credit: item.credit,
  prompt: item.prompt,
});
