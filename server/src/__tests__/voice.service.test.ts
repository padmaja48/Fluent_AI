import { env } from '../config/env';
import { getListeningPaceForLevel, splitTextIntoSentences, synthesizeSpeech } from '../services/voice.service';

const makeWav = (sampleCount = 100) => {
  const sampleRate = 8000;
  const blockAlign = 2;
  const data = Buffer.alloc(sampleCount * blockAlign);
  const buffer = Buffer.alloc(44 + data.length);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + data.length, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(data.length, 40);
  data.copy(buffer, 44);
  return buffer;
};

describe('Sarvam listening TTS pacing', () => {
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

  it('calls Sarvam per A1.0004 sentence with A1 pace before returning stitched audio', async () => {
    (env as typeof env & { SARVAM_API_KEY: string }).SARVAM_API_KEY = 'test-key';
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(makeWav(), {
        status: 200,
        headers: { 'content-type': 'audio/wav' },
      }),
    );
    const clipA10004 =
      'Anita: Hello Ravi. This is LC-A1-0004, a short food message at the service counter. I have the bus ticket and the important detail is the room number. Ravi: I understand. We need to call the front desk at minute 33.';

    const audio = await synthesizeSpeech(clipA10004, 'default', undefined, 'priya', {
      context: 'listening',
      level: 'A1',
      sentenceGapMs: 500,
    });
    const payloads = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(payloads.every((payload) => payload.speaker === 'priya')).toBe(true);
    expect(payloads.every((payload) => payload.pace === 0.85)).toBe(true);
    expect(payloads.every((payload) => payload.output_audio_codec === 'wav')).toBe(true);
    expect(payloads.map((payload) => payload.text)).toEqual(splitTextIntoSentences(clipA10004));
    expect(audio.contentType).toBe('audio/wav');
    expect(audio.buffer.length).toBeGreaterThan(makeWav().length * 5);
  });

  it('keeps higher levels closer to natural speed', () => {
    expect(getListeningPaceForLevel('A2')).toBe(0.85);
    expect(getListeningPaceForLevel('B1')).toBe(0.95);
    expect(getListeningPaceForLevel('B2')).toBe(0.95);
    expect(getListeningPaceForLevel('C1')).toBe(1.0);
    expect(getListeningPaceForLevel('C2')).toBe(1.0);
  });
});
