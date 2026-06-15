import React, { useEffect, useState } from 'react';
import {
  getStoredTtsSpeaker,
  normalizeTtsSpeaker,
  storeTtsSpeaker,
  TTS_SPEAKERS,
} from '../lib/ttsAudio';

export const useTtsSpeaker = () => {
  const [speaker, setSpeakerState] = useState(getStoredTtsSpeaker);

  const setSpeaker = (value) => {
    const normalized = normalizeTtsSpeaker(value);
    setSpeakerState(normalized);
    storeTtsSpeaker(normalized);
  };

  useEffect(() => {
    storeTtsSpeaker(speaker);
  }, [speaker]);

  return [speaker, setSpeaker];
};

export default function TtsVoiceSelector({ value, onChange, className = '' }) {
  return (
    <label className={`tts-voice-select ${className}`.trim()}>
      <span>Voice</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {TTS_SPEAKERS.map((speaker) => (
          <option key={speaker.id} value={speaker.id}>
            {speaker.label} ({speaker.description})
          </option>
        ))}
      </select>
    </label>
  );
}
