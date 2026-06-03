import { env } from '../config/env';

export type VoiceStyle = 'default' | 'professional_female' | 'professional_male' | 'neutral';

/* ── Per-persona voice style mapping ───────────────── */
export const getPersonaVoiceStyle = (personaId: string): VoiceStyle => {
  const map: Record<string, VoiceStyle> = {
    'us-american': 'professional_male',
    'us-indian':   'professional_female',   // Priya Sharma → female voice
    'us-australian': 'neutral',
    'ru-russian':  'professional_male',
  };
  return map[personaId] ?? 'default';
};

/* ── Per-persona intro phrases for voice preview ───── */
export const getPersonaIntro = (personaId: string): string => {
  const intros: Record<string, string> = {
    'us-indian':    "Hi, I'm Priya Sharma. I'm looking forward to our technical discussion today.",
    'us-australian': "G'day! I'm James Callahan. Let's have a relaxed but focused conversation.",
    'ru-russian':   "Good day. I am Alexei Volkov. I expect precise and well-reasoned answers.",
  };
  return intros[personaId] ?? "Hello. I will be your interviewer today.";
};

/* ── Resolve ElevenLabs voice ID ────────────────────── */
const resolveVoiceId = (voiceStyle: VoiceStyle = 'default'): string => {
  // Use per-style voice ID if configured, fall back to default voice
  const voiceMap: Record<VoiceStyle, string | undefined> = {
    default:             env.ELEVENLABS_VOICE_ID,
    professional_female: env.ELEVENLABS_PROFESSIONAL_FEMALE_VOICE_ID || env.ELEVENLABS_VOICE_ID,
    professional_male:   env.ELEVENLABS_PROFESSIONAL_MALE_VOICE_ID   || env.ELEVENLABS_VOICE_ID,
    neutral:             env.ELEVENLABS_NEUTRAL_VOICE_ID              || env.ELEVENLABS_VOICE_ID,
  };
  return voiceMap[voiceStyle] ?? env.ELEVENLABS_VOICE_ID ?? '';
};

/* ── ElevenLabs synthesis ───────────────────────────── */
export const synthesizeSpeech = async (
  text: string,
  voiceStyle: VoiceStyle = 'default',
  personaId?: string,
) => {
  // Resolve style from personaId if provided
  const resolvedStyle = personaId ? getPersonaVoiceStyle(personaId) : voiceStyle;
  const voiceId = resolveVoiceId(resolvedStyle);

  if (!env.ELEVENLABS_API_KEY || !voiceId || voiceId.startsWith('your-')) {
    // No valid API key or placeholder — return null to trigger Web Speech fallback
    return { audioBase64: null, contentType: null };
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key':   env.ELEVENLABS_API_KEY,
      'content-type': 'application/json',
      accept:         'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability:        0.5,
        similarity_boost: 0.75,
        style:            0.35,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`ElevenLabs ${response.status}: ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    audioBase64:  Buffer.from(arrayBuffer).toString('base64'),
    contentType:  response.headers.get('content-type') ?? 'audio/mpeg',
  };
};
