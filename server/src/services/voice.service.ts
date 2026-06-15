import crypto from 'crypto';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export type VoiceStyle = 'default' | 'professional_female' | 'professional_male' | 'neutral';
export type SarvamSpeaker = 'meera' | 'arjun';
export type TtsContext = 'listening' | 'speaking' | 'interview' | 'preview';

type AudioCodec = 'mp3' | 'wav';

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

export const normalizeSarvamSpeaker = (speaker?: string): SarvamSpeaker =>
  speaker === 'arjun' ? 'arjun' : 'meera';

const speakerFromVoiceStyle = (voiceStyle: VoiceStyle = 'default'): SarvamSpeaker => {
  if (voiceStyle === 'professional_male') return 'arjun';
  return 'meera';
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

const cacheKeyFor = (
  text: string,
  speaker: SarvamSpeaker,
  options: Required<Pick<SynthesizeSpeechOptions, 'context' | 'sentenceGapMs'>> & { pace: number; codec: AudioCodec },
) =>
  crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        text,
        speaker,
        context: options.context,
        pace: options.pace,
        sentenceGapMs: options.sentenceGapMs,
        codec: options.codec,
        languageCode: env.SARVAM_TTS_LANGUAGE_CODE,
        model: env.SARVAM_TTS_MODEL,
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

const firstBase64Audio = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(firstBase64Audio).find(Boolean);
  if (typeof value !== 'object') return undefined;

  const record = value as Record<string, unknown>;
  return (
    firstBase64Audio(record.audios) ||
    firstBase64Audio(record.audio) ||
    firstBase64Audio(record.audio_base64) ||
    firstBase64Audio(record.audioBase64) ||
    firstBase64Audio(record.base64_audio) ||
    firstBase64Audio(record.data)
  );
};

const makeSarvamPayloads = (text: string, speaker: SarvamSpeaker, pace: number, codec: AudioCodec) => {
  const common = {
    speaker,
    model: env.SARVAM_TTS_MODEL,
    pace,
    output_audio_codec: codec,
  };

  return [
    {
      ...common,
      text,
      language_code: env.SARVAM_TTS_LANGUAGE_CODE,
    },
    {
      ...common,
      text,
      target_language_code: env.SARVAM_TTS_LANGUAGE_CODE,
    },
    {
      ...common,
      inputs: [text],
      target_language_code: env.SARVAM_TTS_LANGUAGE_CODE,
    },
  ];
};

const callSarvam = async (
  text: string,
  speaker: SarvamSpeaker,
  pace: number,
  codec: AudioCodec,
): Promise<Omit<CachedSpeech, 'cacheKey'>> => {
  if (!env.SARVAM_API_KEY) {
    throw new AppError('SARVAM_API_KEY is not configured.', 503, 'SARVAM_NOT_CONFIGURED');
  }

  let lastError = '';
  for (const payload of makeSarvamPayloads(text, speaker, pace, codec)) {
    const response = await fetch(env.SARVAM_TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-subscription-key': env.SARVAM_API_KEY,
        'content-type': 'application/json',
        accept: 'audio/mpeg,application/json',
      },
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get('content-type') ?? (codec === 'wav' ? 'audio/wav' : 'audio/mpeg');

    if (!response.ok) {
      lastError = await response.text().catch(() => '');
      continue;
    }

    if (contentType.includes('audio/')) {
      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        contentType,
      };
    }

    const json = await response.json().catch(() => null);
    const audioBase64 = firstBase64Audio(json);
    if (!audioBase64) {
      throw new Error('Sarvam TTS response did not include audio data.');
    }

    return {
      buffer: Buffer.from(audioBase64, 'base64'),
      contentType: codec === 'wav' ? 'audio/wav' : 'audio/mpeg',
    };
  }

  throw new Error(`Sarvam TTS failed: ${lastError || 'request rejected'}`);
};

type WavChunk = {
  fmt: Buffer;
  data: Buffer;
  audioFormat: number;
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
};

const findRiffChunk = (buffer: Buffer, chunkId: string) => {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (id === chunkId) return { start: dataStart, end: dataEnd, size };
    offset = dataEnd + (size % 2);
  }
  return null;
};

const parseWav = (buffer: Buffer): WavChunk => {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Expected WAV audio for sentence stitching.');
  }

  const fmtChunk = findRiffChunk(buffer, 'fmt ');
  const dataChunk = findRiffChunk(buffer, 'data');
  if (!fmtChunk || !dataChunk) {
    throw new Error('WAV audio is missing fmt or data chunk.');
  }

  const fmt = buffer.subarray(fmtChunk.start, fmtChunk.end);
  return {
    fmt,
    data: buffer.subarray(dataChunk.start, dataChunk.end),
    audioFormat: fmt.readUInt16LE(0),
    numChannels: fmt.readUInt16LE(2),
    sampleRate: fmt.readUInt32LE(4),
    byteRate: fmt.readUInt32LE(8),
    blockAlign: fmt.readUInt16LE(12),
    bitsPerSample: fmt.readUInt16LE(14),
  };
};

const sameWavFormat = (left: WavChunk, right: WavChunk) =>
  left.audioFormat === right.audioFormat &&
  left.numChannels === right.numChannels &&
  left.sampleRate === right.sampleRate &&
  left.byteRate === right.byteRate &&
  left.blockAlign === right.blockAlign &&
  left.bitsPerSample === right.bitsPerSample;

const createWavBuffer = (template: WavChunk, data: Buffer) => {
  const totalSize = 4 + (8 + template.fmt.length) + (8 + data.length);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(totalSize, 4);
  header.write('WAVE', 8, 'ascii');

  const fmtHeader = Buffer.alloc(8);
  fmtHeader.write('fmt ', 0, 'ascii');
  fmtHeader.writeUInt32LE(template.fmt.length, 4);

  const dataHeader = Buffer.alloc(8);
  dataHeader.write('data', 0, 'ascii');
  dataHeader.writeUInt32LE(data.length, 4);

  return Buffer.concat([header, fmtHeader, template.fmt, dataHeader, data]);
};

const stitchWavChunks = (buffers: Buffer[], gapMs: number): Buffer => {
  if (buffers.length === 0) throw new Error('No audio chunks to stitch.');
  const chunks = buffers.map(parseWav);
  const template = chunks[0];
  if (!chunks.every((chunk) => sameWavFormat(template, chunk))) {
    throw new Error('Cannot stitch WAV chunks with different audio formats.');
  }

  const silenceSamples = Math.round((template.sampleRate * gapMs) / 1000);
  const silence = Buffer.alloc(silenceSamples * template.blockAlign);
  const dataParts = chunks.flatMap((chunk, index) =>
    index === chunks.length - 1 ? [chunk.data] : [chunk.data, silence],
  );

  return createWavBuffer(template, Buffer.concat(dataParts));
};

const synthesizeListeningSpeech = async (
  text: string,
  speaker: SarvamSpeaker,
  pace: number,
  sentenceGapMs: number,
) => {
  const sentences = splitTextIntoSentences(text);
  if (sentences.length <= 1) {
    return callSarvam(sentences[0] ?? text, speaker, pace, 'wav');
  }

  const chunks = await Promise.all(
    sentences.map((sentence) => callSarvam(sentence, speaker, pace, 'wav')),
  );

  return {
    buffer: stitchWavChunks(chunks.map((chunk) => chunk.buffer), sentenceGapMs),
    contentType: 'audio/wav',
  };
};

export const synthesizeSpeech = async (
  text: string,
  voiceStyle: VoiceStyle = 'default',
  personaId?: string,
  speaker?: SarvamSpeaker | string,
  options: SynthesizeSpeechOptions = {},
): Promise<CachedSpeech> => {
  const selectedSpeaker = speaker
    ? normalizeSarvamSpeaker(speaker)
    : speakerFromVoiceStyle(personaId ? getPersonaVoiceStyle(personaId) : voiceStyle);
  const normalizedText = text.trim();
  const context = options.context ?? 'interview';
  const pace = resolvePace({ ...options, context });
  const sentenceGapMs = options.sentenceGapMs ?? 500;
  const codec = context === 'listening' ? 'wav' : 'mp3';
  const cacheKey = cacheKeyFor(normalizedText, selectedSpeaker, {
    context,
    pace,
    sentenceGapMs,
    codec,
  });
  const cached = speechCache.get(cacheKey);
  if (cached) return cached;

  const audio =
    context === 'listening'
      ? await synthesizeListeningSpeech(normalizedText, selectedSpeaker, pace, sentenceGapMs)
      : await callSarvam(normalizedText, selectedSpeaker, pace, codec);
  const item = {
    ...audio,
    cacheKey,
  };
  remember(item);
  return item;
};
