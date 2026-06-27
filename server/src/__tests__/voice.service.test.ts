import { env } from '../config/env';
import { getListeningPaceForLevel, splitTextIntoSentences, synthesizeSpeech } from '../services/voice.service';

const makeMp3 = () => Buffer.from([0xff, 0xfb, 0x90, 0x64]);

describe('ElevenLabs listening TTS pacing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prepares A1.0004-style listening clips sentence-by-sentence at the A1 pace', () => {
    const clipA10004 =
      'Anita: Hello Ravi. This is LC-A1-0004, a short food message at the service counter. I have the bus ticket and the important detail is the room number. Ravi: I understand. We need to call the front desk at minute 33.';

    expect(getListeningPaceForLevel('A1')).toBe(0.85);
    expect(splitTextIntoSentences(clipA10004)).toEqual([
      'Anita: Hello Ravi.',
      'This is LC-A1-0004, a short food message at the service counter.',
      'I have the bus ticket and the important detail is the room number.',
      'Ravi: I understand.',
      'We need to call the front desk at minute 33.',
    ]);
  });

  it('calls ElevenLabs with the A1 pace as voice speed', async () => {
    (env as typeof env & { ELEVENLABS_API_KEY: string }).ELEVENLABS_API_KEY = 'test-key';
    (env as typeof env & { ELEVENLABS_VOICE_ID: string }).ELEVENLABS_VOICE_ID = 'test-voice-id';
    (env as typeof env & { ELEVENLABS_PROFESSIONAL_FEMALE_VOICE_ID: string }).ELEVENLABS_PROFESSIONAL_FEMALE_VOICE_ID = 'test-voice-id';
    (env as typeof env & { ELEVENLABS_OUTPUT_FORMAT: string }).ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128';
    (env as typeof env & { ELEVENLABS_MODEL_ID: string }).ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(makeMp3(), {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      }),
    );
    const clipA10004 =
      'Anita: Hello Ravi. This is LC-A1-0004, a short food message at the service counter. I have the bus ticket and the important detail is the room number. Ravi: I understand. We need to call the front desk at minute 33.';

    const audio = await synthesizeSpeech(clipA10004, 'default', undefined, 'priya', {
      context: 'listening',
      level: 'A1',
      sentenceGapMs: 500,
    });
    const [url, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(init?.body));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(url)).toBe('https://api.elevenlabs.io/v1/text-to-speech/test-voice-id?output_format=mp3_44100_128');
    expect(init?.headers).toMatchObject({ 'xi-api-key': 'test-key' });
    expect(payload.text).toBe(clipA10004);
    expect(payload.model_id).toBe('eleven_multilingual_v2');
    expect(payload.voice_settings.speed).toBe(0.85);
    expect(audio.contentType).toBe('audio/mpeg');
    expect(audio.buffer).toEqual(makeMp3());
  });

  it('uses Sarvam Indian English speakers for interview personas', async () => {
    (env as typeof env & { SARVAM_API_KEY: string }).SARVAM_API_KEY = 'test-sarvam-key';
    (env as typeof env & { SARVAM_TTS_ENDPOINT: string }).SARVAM_TTS_ENDPOINT = 'https://api.sarvam.ai/text-to-speech';
    (env as typeof env & { SARVAM_TTS_MODEL: string }).SARVAM_TTS_MODEL = 'bulbul:v3';
    (env as typeof env & { SARVAM_TTS_LANGUAGE_CODE: string }).SARVAM_TTS_LANGUAGE_CODE = 'en-IN';
    const wav = Buffer.from('RIFF');
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ audios: [wav.toString('base64')] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const audio = await synthesizeSpeech('Welcome to the interview.', 'neutral', 'us-australian', undefined, {
      context: 'preview',
      pace: 0.95,
    });
    const [url, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(init?.body));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(url)).toBe('https://api.sarvam.ai/text-to-speech');
    expect(init?.headers).toMatchObject({ 'api-subscription-key': 'test-sarvam-key' });
    expect(payload).toMatchObject({
      text: 'Welcome to the interview.',
      target_language_code: 'en-IN',
      model: 'bulbul:v3',
      speaker: 'ishita',
      output_audio_codec: 'wav',
      speech_sample_rate: 24000,
      pace: 0.95,
    });
    expect(audio.contentType).toBe('audio/wav');
    expect(audio.buffer).toEqual(wav);
  });

  it('keeps higher levels closer to natural speed', () => {
    expect(getListeningPaceForLevel('A2')).toBe(0.85);
    expect(getListeningPaceForLevel('B1')).toBe(0.95);
    expect(getListeningPaceForLevel('B2')).toBe(0.95);
    expect(getListeningPaceForLevel('C1')).toBe(1.0);
    expect(getListeningPaceForLevel('C2')).toBe(1.0);
  });
});
