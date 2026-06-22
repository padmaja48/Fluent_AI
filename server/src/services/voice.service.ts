import crypto from 'crypto';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export type VoiceStyle = 'default' | 'professional_female' | 'professional_male' | 'neutral';
export type TtsSpeaker = 'priya' | 'rahul';
export type TtsSpeakerInput = TtsSpeaker | 'meera' | 'arjun';
export type TtsContext = 'listening' | 'speaking' | 'interview' | 'preview';

type SynthesizeSpeechOptions = {
  context?: TtsContext;
  level?: string;
  pace?: number;
  sentenceGapMs?: number;
};

type CachedSpeech = {
  buffer: Buffer;
  contentType: string;
  cacheKey: string;
};

const speechCache = new Map<string, CachedSpeech>();
const MAX_CACHE_ITEMS = 250;

/* ── Per-persona voice style mapping ───────────────── */
export const getPersonaVoiceStyle = (personaId: string): VoiceStyle => {
  const map: Record<string, VoiceStyle> = {
    'us-american': 'professional_male',
    'us-indian': 'professional_female',
    'us-australian': 'neutral',
    'ru-russian': 'professional_male',
  };
  return map[personaId] ?? 'default';
};

/* ── Per-persona intro phrases for voice preview ───── */
export const getPersonaIntro = (personaId: string): string => {
  const intros: Record<string, string> = {
    'us-indian': "Hi, I'm Priya Sharma. I'm looking forward to our technical discussion today.",
    'us-australian': "Hi, I'm Ananya Rao. Let's have a relaxed but focused conversation about your experience.",
    'ru-russian': 'Hello, I am Rahul Menon. I will focus on precise, well-reasoned technical answers.',
  };
  return intros[personaId] ?? 'Hello. I will be your interviewer today.';
};

export const normalizeTtsSpeaker = (speaker?: string): TtsSpeaker =>
  speaker === 'rahul' || speaker === 'arjun' ? 'rahul' : 'priya';

const speakerFromVoiceStyle = (voiceStyle: VoiceStyle = 'default'): TtsSpeaker => {
  if (voiceStyle === 'professional_male') return 'rahul';
  return 'priya';
};

export const getListeningPaceForLevel = (level?: string): number => {
  if (level === 'A1' || level === 'A2') return 0.85;
  if (level === 'B1' || level === 'B2') return 0.95;
  return 1.0;
};

export const splitTextIntoSentences = (text: string): string[] => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const matches = normalized.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g);
  return (matches ?? [normalized]).map((sentence) => sentence.trim()).filter(Boolean);
};

const resolvePace = (options: SynthesizeSpeechOptions) => {
  if (typeof options.pace === 'number') return options.pace;
  if (options.context === 'listening') return getListeningPaceForLevel(options.level);
  return 1.0;
};

const clampElevenLabsSpeed = (pace: number) => Math.max(0.7, Math.min(1.2, Number(pace.toFixed(2))));

const configuredValue = (value?: string) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase().startsWith('your-')) return undefined;
  return trimmed;
};

const resolveVoiceId = (speaker: TtsSpeaker, voiceStyle: VoiceStyle) => {
  const defaultVoiceId = configuredValue(env.ELEVENLABS_VOICE_ID);
  if (voiceStyle === 'neutral') {
    return configuredValue(env.ELEVENLABS_NEUTRAL_VOICE_ID) ?? defaultVoiceId;
  }

  if (speaker === 'rahul') {
    return configuredValue(env.ELEVENLABS_PROFESSIONAL_MALE_VOICE_ID) ?? defaultVoiceId;
  }

  return configuredValue(env.ELEVENLABS_PROFESSIONAL_FEMALE_VOICE_ID) ?? defaultVoiceId;
};

const contentTypeForOutputFormat = (outputFormat: string) => {
  if (outputFormat.startsWith('wav_')) return 'audio/wav';
  if (outputFormat.startsWith('pcm_')) return 'audio/L16';
  if (outputFormat.startsWith('ulaw_')) return 'audio/basic';
  return 'audio/mpeg';
};

const cacheKeyFor = (
  text: string,
  speaker: TtsSpeaker,
  voiceId: string,
  options: Required<Pick<SynthesizeSpeechOptions, 'context'>> & { pace: number; outputFormat: string },
) =>
  crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        text,
        speaker,
        voiceId,
        context: options.context,
        pace: options.pace,
        outputFormat: options.outputFormat,
        languageCode: env.ELEVENLABS_LANGUAGE_CODE,
        model: env.ELEVENLABS_MODEL_ID,
        provider: 'elevenlabs',
      }),
    )
    .digest('hex');

const remember = (item: CachedSpeech) => {
  if (speechCache.size >= MAX_CACHE_ITEMS) {
    const oldestKey = speechCache.keys().next().value;
    if (oldestKey) speechCache.delete(oldestKey);
  }
  speechCache.set(item.cacheKey, item);
};

const callElevenLabs = async (
  text: string,
  voiceId: string,
  pace: number,
): Promise<Omit<CachedSpeech, 'cacheKey'>> => {
  if (!env.ELEVENLABS_API_KEY) {
    throw new AppError('ELEVENLABS_API_KEY is not configured.', 503, 'ELEVENLABS_NOT_CONFIGURED');
  }

  const outputFormat = env.ELEVENLABS_OUTPUT_FORMAT;
  const endpoint = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`);
  endpoint.searchParams.set('output_format', outputFormat);

  const body: Record<string, unknown> = {
    text,
    model_id: env.ELEVENLABS_MODEL_ID,
    voice_settings: {
      stability: 0.55,
      similarity_boost: 0.8,
      style: 0,
      use_speaker_boost: true,
      speed: clampElevenLabsSpeed(pace),
    },
  };
  if (env.ELEVENLABS_LANGUAGE_CODE) body.language_code = env.ELEVENLABS_LANGUAGE_CODE;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'content-type': 'application/json',
      accept: 'audio/mpeg,audio/wav,audio/*,application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new AppError(
      `ElevenLabs TTS ${response.status}: ${errorText || response.statusText}`,
      502,
      'ELEVENLABS_TTS_FAILED',
    );
  }

  const contentType = response.headers.get('content-type') ?? contentTypeForOutputFormat(outputFormat);
  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: contentType.includes('audio/') ? contentType : contentTypeForOutputFormat(outputFormat),
  };
};

export const synthesizeSpeech = async (
  text: string,
  voiceStyle: VoiceStyle = 'default',
  personaId?: string,
  speaker?: TtsSpeakerInput | string,
  options: SynthesizeSpeechOptions = {},
): Promise<CachedSpeech> => {
  const resolvedVoiceStyle = personaId ? getPersonaVoiceStyle(personaId) : voiceStyle;
  const selectedSpeaker = speaker
    ? normalizeTtsSpeaker(speaker)
    : speakerFromVoiceStyle(resolvedVoiceStyle);
  const voiceId = resolveVoiceId(selectedSpeaker, resolvedVoiceStyle);
  if (!voiceId) {
    throw new AppError('ELEVENLABS_VOICE_ID is not configured.', 503, 'ELEVENLABS_VOICE_NOT_CONFIGURED');
  }

  const normalizedText = text.trim();
  const context = options.context ?? 'interview';
  const pace = resolvePace({ ...options, context });
  const outputFormat = env.ELEVENLABS_OUTPUT_FORMAT;
  const cacheKey = cacheKeyFor(normalizedText, selectedSpeaker, voiceId, {
    context,
    pace,
    outputFormat,
  });
  const cached = speechCache.get(cacheKey);
  if (cached) return cached;

  const audio = await callElevenLabs(normalizedText, voiceId, pace);
  const item = {
    ...audio,
    cacheKey,
  };
  remember(item);
  return item;
};
