import { getImageDescriptionItems } from '../data/imageDescriptionCatalog';

describe('image description catalog', () => {
  it('has at least 20 curated images for every CEFR level', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const) {
      const items = getImageDescriptionItems(level);
      expect(items.length).toBeGreaterThanOrEqual(20);
      expect(items.every((item) => item.keywords.length >= 6)).toBe(true);
    }
  });
});
