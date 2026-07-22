import fs from 'fs';
import path from 'path';

import type { CompanyQuestionEntry, ExperienceLevel } from './promptBuilder';

export type CompanyQuestionBankFile = {
  company: string;
  roles: Record<
    string,
    Partial<Record<ExperienceLevel, CompanyQuestionEntry[]>>
  >;
};

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const resolveDataDir = () => {
  const candidates = [
    path.join(__dirname, '../data/companyQuestions'),
    path.join(process.cwd(), 'src/data/companyQuestions'),
    path.join(process.cwd(), 'server/src/data/companyQuestions'),
  ];

  return candidates.find((dir) => fs.existsSync(dir)) ?? candidates[0];
};

const ROLE_ALIASES: Record<string, string[]> = {
  'Software Engineer': [
    'software engineer',
    'software development engineer',
    'sde',
    'swe',
    'developer',
    'software developer',
    'full stack',
    'full-stack',
  ],
  'Frontend Engineer': ['frontend', 'frontend developer', 'frontend engineer', 'ui developer'],
  'Backend Engineer': ['backend', 'backend developer', 'backend engineer', 'server engineer'],
  'Data Analyst': ['data analyst', 'business analyst', 'analytics'],
  'Data Scientist': ['data scientist', 'ml engineer', 'machine learning engineer', 'ai engineer'],
  'QA Engineer': ['qa', 'quality assurance', 'sdet', 'test engineer'],
  'Product Manager': ['product manager', 'pm', 'associate product manager'],
};

const normalizeRoleKey = (role: string) => role.trim();

const matchRoleKey = (requestedRole: string, availableRoles: string[]) => {
  const normalized = normalizeRoleKey(requestedRole).toLowerCase();

  const exact = availableRoles.find((key) => key.toLowerCase() === normalized);
  if (exact) return exact;

  for (const [canonical, aliases] of Object.entries(ROLE_ALIASES)) {
    if (availableRoles.includes(canonical) && aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))) {
      return canonical;
    }
  }

  const partial = availableRoles.find(
    (key) => normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized),
  );
  return partial;
};

const loadBankFile = (companySlug: string): CompanyQuestionBankFile | null => {
  const filePath = path.join(resolveDataDir(), `${companySlug}.json`);
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as CompanyQuestionBankFile;
  } catch (error) {
    console.warn(`Failed to load company question bank for ${companySlug}`, error);
    return null;
  }
};

const sampleEntries = (entries: CompanyQuestionEntry[], limit: number) => {
  if (entries.length <= limit) return entries;
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
};

export type CompanyQuestionBankResult = {
  questions: CompanyQuestionEntry[];
  mode: 'verified' | 'generic';
  companyLabel: string;
};

export function getCompanyQuestions(
  companyName?: string,
  role?: string,
  experienceLevel: ExperienceLevel = 'fresher',
  limit = 8,
): CompanyQuestionBankResult | null {
  if (!companyName?.trim()) return null;

  const slug = slugify(companyName.trim());
  const verified = loadBankFile(slug);

  if (verified && role) {
    const roleKey = matchRoleKey(role, Object.keys(verified.roles));
    const roleBank = roleKey ? verified.roles[roleKey] : undefined;
    const levelEntries = roleBank?.[experienceLevel] ?? roleBank?.experienced ?? roleBank?.fresher;

    if (levelEntries?.length) {
      return {
        questions: sampleEntries(levelEntries, limit),
        mode: 'verified',
        companyLabel: verified.company,
      };
    }
  }

  const generic = loadBankFile('_generic');
  if (!generic || !role) return null;

  const roleKey = matchRoleKey(role, Object.keys(generic.roles));
  const roleBank = roleKey ? generic.roles[roleKey] : generic.roles['Software Engineer'];
  const levelEntries = roleBank?.[experienceLevel] ?? roleBank?.experienced ?? roleBank?.fresher;

  if (!levelEntries?.length) return null;

  return {
    questions: sampleEntries(levelEntries, limit),
    mode: 'generic',
    companyLabel: companyName.trim(),
  };
}

export function listAvailableCompanyBanks() {
  const dir = resolveDataDir();
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json') && !file.startsWith('_'))
    .map((file) => file.replace(/\.json$/, ''));
}

export { slugify as slugifyCompanyName, resolveDataDir as getCompanyQuestionsDataDir };
