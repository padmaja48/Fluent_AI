import { ttsAPI } from '../services/api';

export const TTS_SPEAKERS = [
  { id: 'priya', label: 'Priya', description: 'Female' },
  { id: 'rahul', label: 'Rahul', description: 'Male' },
];

export const TTS_SPEAKER_STORAGE_KEY = 'lsrw_tts_speaker';

const audioBlobCache = new Map();

export const normalizeTtsSpeaker = (speaker) => {
  if (speaker === 'rahul' || speaker === 'arjun') return 'rahul';
  return 'priya';
};

export const getStoredTtsSpeaker = () => {
  if (typeof window === 'undefined') return 'priya';
  return normalizeTtsSpeaker(window.localStorage.getItem(TTS_SPEAKER_STORAGE_KEY));
};

export const storeTtsSpeaker = (speaker) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TTS_SPEAKER_STORAGE_KEY, normalizeTtsSpeaker(speaker));
};

export const getApiErrorMessage = async (error, fallback = 'Unable to generate audio.') => {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    const text = await data.text().catch(() => '');
    if (!text) return fallback;
    try {
      const parsed = JSON.parse(text);
      return parsed.error || parsed.message || fallback;
    } catch {
      return text;
    }
  }

  return data?.error || data?.message || error?.message || fallback;
};

const hashInput = async (text, speaker, options = {}) => {
  const input = JSON.stringify({
    text,
    speaker,
    context: options.context || 'listening',
    level: options.level || '',
  });
  if (window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(i) || 0;
  }
  return String(hash);
};

export const getTtsAudioBlob = async (text, speaker = 'priya', options = {}) => {
  const cleanText = String(text || '').trim();
  const selectedSpeaker = normalizeTtsSpeaker(speaker);
  const cacheKey = await hashInput(cleanText, selectedSpeaker, options);
  const cached = audioBlobCache.get(cacheKey);
  if (cached) return cached;

  const response = await ttsAPI.synthesize(cleanText, selectedSpeaker, options);
  const blob = response.data;
  audioBlobCache.set(cacheKey, blob);
  return blob;
};

export const stopTtsAudio = (audio) => {
  if (!audio) return;
  try {
    audio.pause();
  } catch {
    // The element may already be detached.
  }
  if (audio._ttsCleanup) audio._ttsCleanup();
};

export const playTtsAudio = async ({
  text,
  speaker = 'priya',
  level,
  context = 'listening',
  onPlay,
  onEnded,
  onError,
}) => {
  const blob = await getTtsAudioBlob(text, speaker, { level, context });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  let cleaned = false;

  audio._ttsCleanup = () => {
    if (cleaned) return;
    cleaned = true;
    URL.revokeObjectURL(url);
  };

  audio.onplay = () => onPlay?.(audio);
  audio.onended = () => {
    audio._ttsCleanup();
    onEnded?.();
  };
  audio.onerror = () => {
    audio._ttsCleanup();
    onError?.();
  };

  try {
    await audio.play();
    return audio;
  } catch (error) {
    audio._ttsCleanup();
    throw error;
  }
};
