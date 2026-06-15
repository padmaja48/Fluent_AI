const DICEBEAR_BASE = 'https://api.dicebear.com/7.x/personas/svg';

const avatarUrl = (seed, options = '') =>
  `${DICEBEAR_BASE}?seed=${seed}&size=400&${options}`;

export const PERSONAS = [
  {
    id: 'us-indian',
    name: 'Priya Sharma',
    title: 'Engineering Manager',
    company: 'Technical Depth',
    focus: 'Technical depth',
    voiceStyleLabel: 'Works with Priya or Rahul voice',
    voiceStyle: 'professional_male',
    personality:
      'Analytical and thorough. Probes technical depth. Asks detailed follow-up questions. Rewards structured thinking.',
    avatarUrl: avatarUrl(
      'PriyaSharma2024',
      'backgroundColor=ffd5dc,ffdfbf&hair=longHair&skinColor=brown',
    ),
    avatarFallbackInitial: 'PS',
    avatarBg: '#ffd5dc',
  },
  {
    id: 'us-australian',
    name: 'Ananya Rao',
    title: 'Product Director',
    company: 'Communication Clarity',
    focus: 'Communication clarity',
    voiceStyleLabel: 'Works with Priya or Rahul voice',
    voiceStyle: 'neutral',
    personality:
      'Relaxed but sharp. Tests cultural fit and communication clarity. Conversational style but digs into motivations.',
    avatarUrl: avatarUrl(
      'AnanyaRao2024',
      'backgroundColor=d1f4e0,c0aede&hair=longHair&skinColor=brown',
    ),
    avatarFallbackInitial: 'AR',
    avatarBg: '#d1f4e0',
  },
  {
    id: 'ru-russian',
    name: 'Rahul Menon',
    title: 'Principal Engineer',
    company: 'System Design',
    focus: 'System design',
    voiceStyleLabel: 'Works with Priya or Rahul voice',
    voiceStyle: 'professional_male',
    personality:
      'Precise and methodical. Focuses on algorithmic thinking, system design, and problem-solving depth. Expects rigorous, well-reasoned answers with clear logical structure.',
    avatarUrl: avatarUrl(
      'RahulMenon2024',
      'backgroundColor=c0d8f4,dce8f8&hair=shortHair&skinColor=brown',
    ),
    avatarFallbackInitial: 'RM',
    avatarBg: '#c0d8f4',
  },
];
