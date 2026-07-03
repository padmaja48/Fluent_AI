import React, { useEffect, useState } from 'react';
import {
  DEFAULT_TTS_VOICE_SETTINGS,
  getStoredTtsSpeaker,
  getStoredTtsVoiceSettings,
  normalizeTtsSpeaker,
  playTtsAudio,
  storeTtsSpeaker,
  storeTtsVoiceSettings,
  TTS_SPEAKERS,
  TTS_VOICE_STYLES,
  voiceStyleToSpeaker,
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

export const useTtsVoiceSettings = () => {
  const [settings, setSettingsState] = useState(getStoredTtsVoiceSettings);

  const setSettings = (value) => {
    const next = typeof value === 'function' ? value(settings) : value;
    setSettingsState(next);
    storeTtsVoiceSettings(next);
  };

  useEffect(() => {
    storeTtsVoiceSettings(settings);
  }, [settings]);

  return [settings, setSettings];
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

export function TtsVoiceSettingsPanel({
  value,
  onChange,
  className = '',
  compact = false,
  onDiagnostics,
}) {
  const [testing, setTesting] = useState(false);
  const settings = { ...DEFAULT_TTS_VOICE_SETTINGS, ...(value || {}) };

  const update = (key, nextValue) => {
    const next = { ...settings, [key]: nextValue };
    onChange?.(next);
    storeTtsVoiceSettings(next);
  };

  const testVoice = async () => {
    if (testing) return;
    setTesting(true);
    try {
      await playTtsAudio({
        text: 'Hello! This is how your interviewer will sound during the interview.',
        speaker: voiceStyleToSpeaker(settings.voiceStyle),
        context: 'preview',
        settings,
        onDiagnostics,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={`tts-settings${compact ? ' tts-settings--compact' : ''} ${className}`.trim()}>
      <label className="tts-field">
        <span>Voice</span>
        <select value={settings.voiceStyle} onChange={(event) => update('voiceStyle', event.target.value)}>
          {TTS_VOICE_STYLES.map((style) => (
            <option key={style.id} value={style.id}>{style.label}</option>
          ))}
        </select>
      </label>

      <label className="tts-field">
        <span>Volume {Math.round(settings.volume * 100)}%</span>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={settings.volume}
          onChange={(event) => update('volume', Number(event.target.value))}
        />
      </label>

      <label className="tts-field">
        <span>Rate {settings.speechRate.toFixed(2)}x</span>
        <input
          type="range"
          min="0.75"
          max="1.35"
          step="0.05"
          value={settings.speechRate}
          onChange={(event) => update('speechRate', Number(event.target.value))}
        />
      </label>

      <label className="tts-field">
        <span>Pitch {settings.pitch > 0 ? `+${settings.pitch}` : settings.pitch}</span>
        <input
          type="range"
          min="-6"
          max="6"
          step="1"
          value={settings.pitch}
          onChange={(event) => update('pitch', Number(event.target.value))}
        />
      </label>

      <button type="button" className="iv-btn iv-btn--ghost tts-test-btn" onClick={testVoice} disabled={testing}>
        {testing ? 'Playing...' : 'Test Voice'}
      </button>
    </div>
  );
}
