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

const imageUrlFor = (query: string, level: ImageDescriptionLevel, index: number) =>
  `https://source.unsplash.com/900x600/?${encodeURIComponent(`${query},${level},english-learning,${index}`)}`;

export const imageDescriptionCatalog: ImageDescriptionItem[] = LEVELS.flatMap((level) =>
  scenarios.map((scenario, index) => ({
    id: `${level.toLowerCase()}-${scenario.slug}`,
    level,
    title: scenario.title,
    imageUrl: imageUrlFor(scenario.query, level, index + 1),
    alt: scenario.alt,
    credit: 'Unsplash',
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
