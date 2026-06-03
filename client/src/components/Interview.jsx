import React, { useState, useEffect, useRef, useCallback } from 'react';
import { interviewAPI, resumeAPI } from '../services/api';
import { PERSONAS } from '../lib/personas';
import { AvatarPortrait } from './interview/AvatarPortrait';
import VoiceIndicator from './interview/VoiceIndicator';
import '../styles/Interview.css';

const STEPS = ['Resume', 'Persona', 'Config', 'System Check'];
const MAX_VIOLATIONS = 3;

/* ─────────────────────────────────────────────────────────────────
   Shared helpers
───────────────────────────────────────────────────────────────── */
function InterviewLoader({ title = 'Preparing interview', message = 'Please wait…' }) {
  return (
    <div className="iv-loading-card" role="status" aria-live="polite">
      <div className="iv-loader-orbit" aria-hidden="true"><span /><span /><span /></div>
      <div><h3>{title}</h3><p>{message}</p></div>
    </div>
  );
}

/* Play base64 audio blob */
function playAudioBlob(base64, contentType) {
  return new Promise((resolve) => {
    try {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: contentType || 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      const cleanup = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      audio.play().catch(cleanup);
    } catch { resolve(); }
  });
}

/* Web Speech fallback */
function speakWebSpeech(text, { wantMale = false, onEnd } = {}) {
  if (!window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'en-US';
  utt.rate = 0.92;
  const doSpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    const en = voices.filter(v => v.lang.startsWith('en'));
    if (wantMale) {
      utt.pitch = 0.85;
      utt.voice = en.find(v => /male/i.test(v.name)) ||
        en.find(v => /david|mark|daniel|james|ryan|george|thomas|fred/i.test(v.name)) ||
        en.find(v => v.lang === 'en-US') || en[0];
    } else {
      utt.pitch = 1.1;
      utt.voice = en.find(v => /female/i.test(v.name)) ||
        en.find(v => /samantha|karen|victoria|zira|susan|lisa|moira/i.test(v.name)) ||
        en.find(v => v.lang === 'en-US') || en[0];
    }
    utt.onend = () => onEnd?.();
    utt.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') onEnd?.(); };
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    window.speechSynthesis.speak(utt);
  };
  window.speechSynthesis.getVoices().length > 0
    ? doSpeak()
    : window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true });
}

/* ─────────────────────────────────────────────────────────────────
   Step 1: Resume Upload
───────────────────────────────────────────────────────────────── */
function ResumeStep({ onNext }) {
  const [uploading, setUploading] = useState(false);
  const [resume, setResume] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    resumeAPI.getHistory().then(r => setHistory(r.data?.slice(0, 3) ?? [])).catch(() => {});
  }, []);

  const upload = async (file) => {
    if (!file) return;
    try {
      setUploading(true); setError('');
      const fd = new FormData();
      fd.append('resume', file);
      const res = await resumeAPI.upload(fd);
      setResume(res.data);
      if (res.data?._duplicate) {
        setError(''); // clear any error — duplicate is fine, just reuse
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Upload failed. Please try again.';
      setError(msg);
    }
    finally { setUploading(false); }
  };

  return (
    <div className="iv-step">
      <h2 className="iv-step-title">Upload Your Resume</h2>
      <p className="iv-step-desc">We tailor questions specifically to your experience.</p>
      <div
        className={`iv-drop-zone${uploading ? ' iv-drop-zone--loading' : ''}`}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}
        onClick={() => document.getElementById('resume-file-input').click()}
      >
        {uploading ? <span>Uploading…</span>
          : resume ? <span className="iv-drop-success">✓ {resume.fileName || resume.originalName || 'Resume uploaded'}</span>
          : <><span className="iv-drop-icon">📄</span><span>Drag & drop PDF here, or click to browse</span></>}
        <input id="resume-file-input" type="file" accept=".pdf,.doc,.docx"
          style={{ display: 'none' }} onChange={e => upload(e.target.files[0])} />
      </div>
      {error && <p className="iv-error">{error}</p>}
      {resume?._duplicate && (
        <p className="iv-info-note">✓ Same resume detected — reusing your existing analysis.</p>
      )}
      {(resume?.analysis || resume?.parsedData) && (() => {
        const skills = resume.analysis?.skills || resume.parsedData?.skills || [];
        const level  = resume.analysis?.experienceLevel || resume.parsedData?.experienceLevel || 'N/A';
        const yoe    = resume.analysis?.yearsOfExperience;
        const summary = resume.analysis?.summary;
        return (
          <div className="iv-resume-preview">
            {summary && <p className="iv-resume-summary">{summary}</p>}
            <div className="iv-resume-meta">
              <span><strong>Level:</strong> {level}</span>
              {yoe != null && <span><strong>Experience:</strong> {yoe} yr{yoe !== 1 ? 's' : ''}</span>}
              <span><strong>Skills found:</strong> {skills.length}</span>
            </div>
            {skills.length > 0 && (
              <div className="iv-skill-tags">
                {skills.map(s => <span key={s} className="iv-skill-tag">{s}</span>)}
              </div>
            )}
          </div>
        );
      })()}
      {history.length > 0 && !resume && (
        <div className="iv-resume-history">
          <p className="iv-resume-history-label">Or use a previous resume:</p>
          {history.map(r => (
            <button key={r._id} className="iv-btn iv-btn--ghost" onClick={() => setResume(r)}>
              {r.fileName || r.originalName || 'Previous resume'}
            </button>
          ))}
        </div>
      )}
      <div className="iv-step-actions">
        <button className="iv-btn iv-btn--primary" disabled={!resume} onClick={() => onNext({ resume })}>
          Continue →
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Step 2: Persona Selection — with voice preview
───────────────────────────────────────────────────────────────── */
function PersonaStep({ onNext, onBack }) {
  const [selected, setSelected] = useState(null);
  const [previewing, setPreviewing] = useState(null); // persona id currently previewing
  const [previewError, setPreviewError] = useState('');
  const previewAudioRef = useRef(null);

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setPreviewing(null);
  };

  const handlePreview = async (persona, e) => {
    e.stopPropagation(); // don't select the card
    if (previewing === persona.id) { stopPreview(); return; }
    stopPreview();
    setPreviewError('');
    setPreviewing(persona.id);
    try {
      const res = await interviewAPI.personaPreview(persona.id);
      const { audioBase64, contentType, text } = res.data;
      if (audioBase64 && contentType?.includes('audio')) {
        const bytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: contentType });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        previewAudioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); setPreviewing(null); };
        audio.onerror = () => { URL.revokeObjectURL(url); setPreviewing(null); };
        await audio.play();
      } else {
        // Web Speech fallback
        const wantMale = persona.id !== 'us-indian';
        speakWebSpeech(text || `Hi, I'm ${persona.name}.`, {
          wantMale,
          onEnd: () => setPreviewing(null),
        });
      }
    } catch {
      // Silently fall back to Web Speech
      const wantMale = persona.id !== 'us-indian';
      speakWebSpeech(`Hi, I'm ${persona.name}. I'll be your interviewer today.`, {
        wantMale,
        onEnd: () => setPreviewing(null),
      });
    }
  };

  // Cleanup on unmount
  useEffect(() => () => stopPreview(), []);

  return (
    <div className="iv-step">
      <h2 className="iv-step-title">Choose Your Interviewer</h2>
      <p className="iv-step-desc">
        Click a card to select. Press <strong>▶ Preview voice</strong> to hear how they sound before deciding.
      </p>
      {previewError && <p className="iv-error">{previewError}</p>}

      <div className="iv-persona-grid">
        {PERSONAS.map(p => (
          <div
            key={p.id}
            className={`iv-persona-card${selected?.id === p.id ? ' iv-persona-card--selected' : ''}`}
            onClick={() => setSelected(p)}
          >
            <div className="iv-persona-avatar">
              <AvatarPortrait persona={p} isSpeaking={previewing === p.id} audioLevel={previewing === p.id ? 0.6 : 0} />
            </div>
            <div className="iv-persona-info">
              <span className="iv-persona-flag">{p.flag}</span>
              <h3 className="iv-persona-name">{p.name}</h3>
              <p className="iv-persona-title">{p.title} · {p.company}</p>
              <p className="iv-persona-accent">{p.accent}</p>
              <p className="iv-persona-personality">{p.personality}</p>
            </div>

            {/* Voice preview button */}
            <button
              className={`iv-preview-btn${previewing === p.id ? ' iv-preview-btn--active' : ''}`}
              onClick={e => handlePreview(p, e)}
              title={previewing === p.id ? 'Stop preview' : 'Preview voice'}
            >
              {previewing === p.id ? (
                <><span className="iv-preview-icon">⏹</span> Stop</>
              ) : (
                <><span className="iv-preview-icon">▶</span> Preview voice</>
              )}
            </button>

            {selected?.id === p.id && <span className="iv-persona-check">✓</span>}
          </div>
        ))}
      </div>

      <div className="iv-step-actions">
        <button className="iv-btn iv-btn--ghost" onClick={() => { stopPreview(); onBack(); }}>← Back</button>
        <button className="iv-btn iv-btn--primary" disabled={!selected}
          onClick={() => { stopPreview(); onNext({ persona: selected }); }}>
          Continue →
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Step 3: Interview Configuration
───────────────────────────────────────────────────────────────── */
function ConfigStep({ persona, onNext, onBack }) {
  const [config, setConfig] = useState({
    roleLevel: 'Mid',
    roleDomain: 'Software Engineering',
    interviewType: 'Mixed',
    complexity: 'Intermediate',
    duration: 30,
  });
  const toggle = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));
  const opts = (key, items) => (
    <div className="iv-toggle-group">
      {items.map(item => (
        <button key={item}
          className={`iv-toggle-btn${config[key] === item ? ' iv-toggle-btn--active' : ''}`}
          onClick={() => toggle(key, item)}>
          {item}
        </button>
      ))}
    </div>
  );
  return (
    <div className="iv-step">
      <h2 className="iv-step-title">Interview Configuration</h2>
      <p className="iv-step-desc">Interviewing with <strong>{persona?.name}</strong> — {persona?.title}</p>
      <div className="iv-config-form">
        <label className="iv-label">Role Domain</label>
        <input className="iv-input" value={config.roleDomain}
          onChange={e => toggle('roleDomain', e.target.value)}
          placeholder="e.g. Backend Engineering, Product Management" />
        <label className="iv-label">Experience Level</label>
        {opts('roleLevel', ['Fresher', 'Mid', 'Senior', 'Lead'])}
        <label className="iv-label">Interview Type</label>
        {opts('interviewType', ['Behavioural', 'Technical', 'Mixed'])}
        <label className="iv-label">Complexity</label>
        {opts('complexity', ['Beginner', 'Intermediate', 'Advanced'])}
        <label className="iv-label">Duration</label>
        {opts('duration', [15, 30, 45])}
      </div>
      <div className="iv-step-actions">
        <button className="iv-btn iv-btn--ghost" onClick={onBack}>← Back</button>
        <button className="iv-btn iv-btn--primary" onClick={() => onNext({ config })}>Continue →</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Step 4: System Check
───────────────────────────────────────────────────────────────── */
function SystemCheckStep({ onStart, onBack, loading }) {
  const videoRef = useRef(null);
  const analyserRef = useRef(null);
  const animRef = useRef(null);
  const [camOk, setCamOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
        setCamOk(true); setMicOk(true);
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
        src.connect(analyser); analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          setMicLevel(data.reduce((a, b) => a + b, 0) / data.length / 128);
          animRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch { setError('Could not access camera/microphone. Please grant permissions.'); }
    })();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div className="iv-step">
      <h2 className="iv-step-title">System Check</h2>
      <p className="iv-step-desc">Verify camera and microphone before starting.</p>
      {error && <p className="iv-error">{error}</p>}
      <div className="iv-sys-check">
        <div className="iv-cam-preview">
          <video ref={videoRef} muted playsInline className="iv-cam-video" />
        </div>
        <div className="iv-check-list">
          <div className={`iv-check-item${camOk ? ' iv-check-item--ok' : ''}`}>
            <span className="iv-check-icon">{camOk ? '✓' : '○'}</span> Camera
          </div>
          <div className={`iv-check-item${micOk ? ' iv-check-item--ok' : ''}`}>
            <span className="iv-check-icon">{micOk ? '✓' : '○'}</span> Microphone
          </div>
          <VoiceIndicator audioLevel={micLevel} isActive={micOk} label="Mic level" />
        </div>
      </div>

      <div className="iv-rules-box">
        <h4>📋 Interview Rules</h4>
        <ul>
          <li>🖥️ You must remain in <strong>fullscreen</strong> at all times</li>
          <li>🚫 <strong>Tab switching</strong> or leaving the window is not allowed</li>
          <li>📋 <strong>Copy/paste</strong> is disabled during the interview</li>
          <li>🖱️ <strong>Right-clicking</strong> is disabled</li>
          <li>📵 Keep your <strong>face visible</strong> in the camera at all times</li>
          <li>⚠️ <strong>{MAX_VIOLATIONS} violations</strong> will terminate the interview automatically</li>
        </ul>
      </div>

      <label className="iv-agree-label">
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
        {' '}I understand and agree to all interview rules and fullscreen monitoring
      </label>

      <div className="iv-step-actions">
        <button className="iv-btn iv-btn--ghost" onClick={onBack}>← Back</button>
        <button className="iv-btn iv-btn--primary" disabled={!camOk || !agreed || loading} onClick={onStart}>
          {loading
            ? <span className="iv-btn-loading"><span className="iv-btn-spinner" />Creating interview</span>
            : 'Start Interview'}
        </button>
      </div>
      {loading && <InterviewLoader title="Creating your interview" message="Generating tailored questions and preparing the interviewer." />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Live Session — strict proctoring + audio
───────────────────────────────────────────────────────────────── */
function LiveSession({ interview, persona, onComplete }) {
  const [questions]      = useState(interview.questions || []);
  const [currentIdx, setCurrentIdx] = useState(interview.currentQuestionIndex || 0);
  const [transcript, setTranscript] = useState([]);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel]   = useState(0);
  const [violations, setViolations]   = useState(0);
  const [violationMsg, setViolationMsg] = useState('');
  const [violationFlash, setViolationFlash] = useState(false);
  const [terminated, setTerminated]   = useState(false);
  const [timer, setTimer]             = useState(interview.duration * 60 || 1800);
  const [interimText, setInterimText] = useState('');
  const [ending, setEnding]           = useState(false);

  const videoRef        = useRef(null);
  const recognitionRef  = useRef(null);
  const animRef         = useRef(null);
  const animFrameRef    = useRef(null);
  const timerRef        = useRef(null);
  const ttsSourceRef    = useRef(null);
  const violationCountRef   = useRef(0);
  const autoSubmittedRef    = useRef(false);
  const finishingRef        = useRef(false);
  const sessionClosedRef    = useRef(false);
  const transcriptRef       = useRef([]);

  // Keep transcriptRef in sync
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  /* ── Stop listening ─────────────────────────────── */
  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) { try { rec.onend = null; rec.stop(); } catch {} }
    setIsListening(false);
    setInterimText('');
  }, []);

  /* ── Stop TTS ───────────────────────────────────── */
  const stopSpeech = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    window.speechSynthesis?.cancel();
    if (ttsSourceRef.current) {
      try { ttsSourceRef.current.pause(); } catch {}
      if (ttsSourceRef.current._blobUrl) URL.revokeObjectURL(ttsSourceRef.current._blobUrl);
      ttsSourceRef.current = null;
    }
    setIsSpeaking(false);
    setAudioLevel(0);
  }, []);

  /* ── Finish session ─────────────────────────────── */
  const finishSession = useCallback(async ({ terminatedBySystem = false } = {}) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    sessionClosedRef.current = true;
    autoSubmittedRef.current = true;
    setEnding(!terminatedBySystem);
    clearInterval(timerRef.current);
    stopListening();
    stopSpeech();
    try { await interviewAPI.completeInterview(interview._id); } catch {}
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch {} }
    if (terminatedBySystem) { setTerminated(true); setEnding(false); return; }
    onComplete(interview._id);
  }, [interview._id, onComplete, stopListening, stopSpeech]);

  /* ── Log violation ──────────────────────────────── */
  const logViolation = useCallback(async (type, description) => {
    if (sessionClosedRef.current || autoSubmittedRef.current) return;
    violationCountRef.current += 1;
    const count = violationCountRef.current;
    setViolations(count);
    setViolationMsg(`⚠️ Warning (${count}/${MAX_VIOLATIONS}): ${description}`);
    setViolationFlash(true);
    setTimeout(() => setViolationFlash(false), 800);
    try { await interviewAPI.logViolation(interview._id, type, description); } catch {}
    if (count >= MAX_VIOLATIONS && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      finishSession({ terminatedBySystem: true });
    }
    setTimeout(() => setViolationMsg(''), 5000);
  }, [finishSession, interview._id]);

  /* ── STRICT PROCTORING ──────────────────────────── */
  useEffect(() => {
    // 1. Enter fullscreen immediately
    document.documentElement.requestFullscreen().catch(() => {});

    // 2. Fullscreen exit
    const onFSChange = () => {
      if (!document.fullscreenElement && !autoSubmittedRef.current) {
        logViolation('fullscreen_exit', 'Exited fullscreen mode');
        // Re-enter fullscreen
        setTimeout(() => {
          if (!sessionClosedRef.current)
            document.documentElement.requestFullscreen().catch(() => {});
        }, 500);
      }
    };

    // 3. Tab switch / visibility change
    const onVisibility = () => {
      if (document.hidden && !autoSubmittedRef.current)
        logViolation('tab_switch', 'Switched to another tab or minimized window');
    };

    // 4. Window blur (alt+tab, click outside)
    const onBlur = () => {
      if (!autoSubmittedRef.current)
        logViolation('window_blur', 'Window lost focus');
    };

    // 5. Copy / Cut / Paste
    const onCopy  = e => { e.preventDefault(); logViolation('copy_attempt', 'Attempted to copy content'); };
    const onCut   = e => { e.preventDefault(); logViolation('cut_attempt', 'Attempted to cut content'); };
    const onPaste = e => { e.preventDefault(); logViolation('paste_attempt', 'Attempted to paste content'); };

    // 6. Right-click
    const onContextMenu = e => {
      e.preventDefault();
      logViolation('right_click', 'Right-click menu attempted');
    };

    // 7. Keyboard shortcuts (F12, Ctrl+Shift+I/J/C/U, Ctrl+U, Alt+Tab)
    const onKeyDown = e => {
      if (autoSubmittedRef.current) return;
      const blocked =
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I','J','C','U'].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && e.key.toUpperCase() === 'U') ||
        (e.ctrlKey && e.key.toUpperCase() === 'S') ||
        (e.altKey && e.key === 'Tab');
      if (blocked) {
        e.preventDefault();
        logViolation('devtools_shortcut', `Blocked keyboard shortcut: ${e.key}`);
      }
    };

    // 8. Periodic devtools size detection (heuristic)
    const devToolsCheck = setInterval(() => {
      if (autoSubmittedRef.current) return;
      const threshold = 160;
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        logViolation('devtools_open', 'Developer tools appear to be open');
      }
    }, 8000);

    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onKeyDown);
      clearInterval(devToolsCheck);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [logViolation]);

  /* ── Camera PiP + mic analyser ──────────────────── */
  useEffect(() => {
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser(); analyser.fftSize = 128;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          setAudioLevel(data.reduce((a, b) => a + b, 0) / data.length / 128);
          animRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {}
    })();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  /* ── Timer ──────────────────────────────────────── */
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!autoSubmittedRef.current) { autoSubmittedRef.current = true; finishSession(); }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [finishSession]);

  /* ── Unlock audio autoplay on mount ─────────────── */
  useEffect(() => {
    try {
      const a = new Audio();
      a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      a.volume = 0;
      a.play().catch(() => {});
    } catch {}
  }, []);

  useEffect(() => () => { sessionClosedRef.current = true; stopListening(); stopSpeech(); }, [stopListening, stopSpeech]);

  /* ── TTS: play audio base64 ─────────────────────── */
  const playAudioBase64 = useCallback((base64, contentType, onEnd) => {
    return new Promise(resolve => {
      try {
        if (sessionClosedRef.current) { resolve(); return; }
        if (ttsSourceRef.current) {
          ttsSourceRef.current.pause();
          if (ttsSourceRef.current._blobUrl) URL.revokeObjectURL(ttsSourceRef.current._blobUrl);
          ttsSourceRef.current = null;
        }
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: contentType || 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio._blobUrl = url;
        ttsSourceRef.current = audio;

        audio.onplay = () => {
          setIsSpeaking(true);
          const tick = () => {
            if (!ttsSourceRef.current || ttsSourceRef.current.paused) return;
            setAudioLevel(0.2 + Math.random() * 0.6);
            animFrameRef.current = requestAnimationFrame(tick);
          };
          tick();
        };
        audio.onended = () => {
          cancelAnimationFrame(animFrameRef.current);
          setAudioLevel(0); setIsSpeaking(false);
          URL.revokeObjectURL(url); ttsSourceRef.current = null;
          if (!sessionClosedRef.current) onEnd?.();
          resolve();
        };
        audio.onerror = () => {
          cancelAnimationFrame(animFrameRef.current);
          setIsSpeaking(false); URL.revokeObjectURL(url); ttsSourceRef.current = null;
          if (!sessionClosedRef.current) onEnd?.();
          resolve();
        };
        audio.play().catch(err => {
          console.warn('TTS play blocked, using Web Speech:', err);
          URL.revokeObjectURL(url); ttsSourceRef.current = null;
          if (!sessionClosedRef.current) onEnd?.();
          resolve();
        });
      } catch { setIsSpeaking(false); onEnd?.(); resolve(); }
    });
  }, []);

  /* ── Speak question ─────────────────────────────── */
  const speakQuestion = useCallback(async (questionText, addToTranscript = true) => {
    if (sessionClosedRef.current) return;
    if (addToTranscript) {
      setTranscript(prev => {
        const last = [...prev].reverse().find(m => m.role === 'interviewer');
        if (last?.text === questionText) return prev;
        return [...prev, { role: 'interviewer', text: questionText }];
      });
    }
    try {
      const voiceStyle = persona?.voiceStyle || 'default';
      const res = await interviewAPI.speak(interview._id, questionText, voiceStyle);
      const { audioBase64, contentType } = res.data;
      if (sessionClosedRef.current) return;
      if (audioBase64 && contentType?.includes('audio')) {
        await playAudioBase64(audioBase64, contentType, () => startListening());
      } else {
        const wantMale = persona?.id !== 'us-indian';
        speakWebSpeech(questionText, { wantMale, onEnd: () => startListening() });
        setIsSpeaking(true);
      }
    } catch {
      if (!sessionClosedRef.current) {
        const wantMale = persona?.id !== 'us-indian';
        speakWebSpeech(questionText, { wantMale, onEnd: () => startListening() });
        setIsSpeaking(true);
      }
    }
  }, [interview._id, persona, playAudioBase64]);

  /* ── Speak first question on mount ─────────────── */
  useEffect(() => {
    if (questions.length > 0 && questions[0]?.question) speakQuestion(questions[0].question);
  }, []); // eslint-disable-line

  /* ── Speech recognition ─────────────────────────── */
  const startListening = () => {
    if (sessionClosedRef.current || ending) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setTranscript(prev => [...prev, { role: 'system', text: 'Speech recognition not supported.' }]);
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setInterimText(interim);
      if (final) { setInterimText(''); setTranscript(prev => [...prev, { role: 'candidate', text: final }]); }
    };
    rec.onend = () => { if (!sessionClosedRef.current) setIsListening(false); };
    try { rec.start(); } catch { setIsListening(false); return; }
    recognitionRef.current = rec;
    setIsListening(true);
  };

  const submitAnswer = async (answerText, skipped = false) => {
    if (sessionClosedRef.current || ending) return;
    if (!answerText && !skipped) return;
    try {
      const q = questions[currentIdx]?.question || '';
      await interviewAPI.submitAnswer(interview._id, q, answerText || '(skipped)');
    } catch {}
    const next = currentIdx + 1;
    if (next < questions.length) {
      setCurrentIdx(next);
      speakQuestion(questions[next].question);
    } else {
      finishSession();
    }
  };

  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const currentQ = questions[currentIdx];

  /* Violation color: green → yellow → orange → red */
  const violationColor = ['#10b981', '#f59e0b', '#f97316', '#ef4444'][Math.min(violations, 3)];

  if (terminated) {
    return (
      <div className="iv-terminated">
        <div className="iv-terminated-icon">🚫</div>
        <h2>Interview Terminated</h2>
        <p>You exceeded <strong>{MAX_VIOLATIONS} integrity violations</strong>.</p>
        <p>Your session has been auto-submitted and flagged for review.</p>
        <button className="iv-btn iv-btn--primary" onClick={() => onComplete(interview._id)}>
          View Results
        </button>
      </div>
    );
  }

  return (
    <div className={`iv-live${ending ? ' iv-live--ending' : ''}${violationFlash ? ' iv-live--flash' : ''}`}>
      {ending && (
        <div className="iv-ending-overlay">
          <InterviewLoader title="Ending interview" message="Saving your responses and preparing your results." />
        </div>
      )}

      {/* Proctor bar */}
      <div className="iv-proctor-bar">
        <video ref={videoRef} muted playsInline className="iv-pip" />
        <span className="iv-timer" data-warn={timer < 300}>{fmtTime(timer)}</span>
        <span className="iv-q-counter">Q {currentIdx + 1} / {questions.length}</span>
        <span className="iv-rec-dot">● REC</span>
        {violations > 0 && (
          <span className="iv-violation-count" style={{ color: violationColor }}>
            ⚠ {violations}/{MAX_VIOLATIONS} violations
          </span>
        )}
        <span className="iv-proctor-status">{isSpeaking ? '🔊 Interviewer speaking' : isListening ? '🎙 Listening…' : '⏳ Ready'}</span>
      </div>

      {violationMsg && (
        <div className="iv-violation-banner" style={{ borderLeftColor: violationColor }}>
          {violationMsg}
        </div>
      )}

      <div className="iv-session-body">
        {/* Left: Avatar */}
        <div className="iv-avatar-panel">
          <div className="iv-avatar-wrap">
            <AvatarPortrait persona={persona} isSpeaking={isSpeaking} audioLevel={audioLevel} isListening={isListening} />
          </div>
          <VoiceIndicator audioLevel={audioLevel} isActive={isSpeaking} label={isSpeaking ? persona?.name : ''} />
          <p className="iv-persona-tag">{persona?.flag} {persona?.name}</p>
        </div>

        {/* Right: Transcript */}
        <div className="iv-transcript-panel">
          <div className="iv-transcript-scroll">
            {transcript.map((msg, i) => (
              <div key={i} className={`iv-msg iv-msg--${msg.role}`}>
                <span className="iv-msg-role">
                  {msg.role === 'interviewer' ? persona?.name : msg.role === 'candidate' ? 'You' : 'System'}
                </span>
                <span className="iv-msg-text">{msg.text}</span>
              </div>
            ))}
            {interimText && (
              <div className="iv-msg iv-msg--interim">
                <span className="iv-msg-role">You (speaking…)</span>
                <span className="iv-msg-text">{interimText}</span>
              </div>
            )}
          </div>

          {currentQ && (
            <div className="iv-current-q">
              <span className="iv-current-q-label">Current question:</span>
              <span className="iv-current-q-text">{currentQ.question}</span>
            </div>
          )}

          <div className="iv-controls">
            <VoiceIndicator audioLevel={isListening ? audioLevel : 0} isActive={isListening} label="" color="blue" />
            <button
              className={`iv-btn${isListening ? ' iv-btn--danger' : ' iv-btn--primary'}`}
              disabled={ending}
              onMouseDown={startListening}
              onTouchStart={startListening}
              onMouseUp={async () => {
                if (ending) return;
                await stopListening();
                const curr = transcriptRef.current;
                const lastInterviewerIdx = [...curr].map((m, i) => m.role === 'interviewer' ? i : -1).filter(i => i >= 0).pop() ?? -1;
                const ans = curr
                  .slice(lastInterviewerIdx + 1)
                  .filter(m => m.role === 'candidate')
                  .map(m => m.text).join(' ').trim();
                if (ans) submitAnswer(ans);
              }}
              onTouchEnd={async () => {
                if (ending) return;
                await stopListening();
                const curr = transcriptRef.current;
                const lastInterviewerIdx = [...curr].map((m, i) => m.role === 'interviewer' ? i : -1).filter(i => i >= 0).pop() ?? -1;
                const ans = curr.slice(lastInterviewerIdx + 1).filter(m => m.role === 'candidate').map(m => m.text).join(' ').trim();
                if (ans) submitAnswer(ans);
              }}
            >
              {isListening ? '🎙 Release to submit' : '🎙 Hold to speak'}
            </button>
            <button className="iv-btn iv-btn--ghost" disabled={ending}
              onClick={() => { stopListening(); submitAnswer('', true); }}>
              Skip
            </button>
            <button className="iv-btn iv-btn--ghost iv-btn--finish" disabled={ending}
              onClick={() => finishSession()}>
              {ending
                ? <span className="iv-btn-loading"><span className="iv-btn-spinner" />Ending</span>
                : 'End Interview'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Main Interview Component
───────────────────────────────────────────────────────────────── */
export const Interview = ({ setCurrentView }) => {
  const [step, setStep]         = useState(0);
  const [data, setData]         = useState({});
  const [interview, setInterview] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const persona = data.persona;

  const next = partial => { setData(prev => ({ ...prev, ...partial })); setStep(s => s + 1); };
  const back = () => setStep(s => s - 1);

  const handleStart = async () => {
    try {
      setLoading(true); setError('');
      const payload = {
        roleLevel:       data.config?.roleLevel || 'Mid',
        roleDomain:      data.config?.roleDomain || 'Software Engineering',
        interviewStyle:  data.config?.interviewType || 'Mixed',
        duration:        data.config?.duration || 30,
        resumeId:        data.resume?._id,
        resumeText:      data.resume?.rawText || data.resume?.extractedText,
        personaId:       data.persona?.id,
        interviewType:   data.config?.interviewType,
        complexity:      data.config?.complexity,
      };
      const res = await interviewAPI.createInterview(payload);
      const startRes = await interviewAPI.startInterview(res.data._id);
      setInterview(startRes.data?.interview ?? res.data);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start interview.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 4 && interview) {
    return <LiveSession interview={interview} persona={persona} onComplete={() => setCurrentView?.('results')} />;
  }

  return (
    <div className="iv-container">
      <div className="iv-stepper">
        {STEPS.map((label, i) => (
          <div key={label}
            className={`iv-step-dot${i < step ? ' iv-step-dot--done' : i === step ? ' iv-step-dot--active' : ''}`}>
            <span className="iv-step-num">{i < step ? '✓' : i + 1}</span>
            <span className="iv-step-label">{label}</span>
          </div>
        ))}
      </div>
      {error && <p className="iv-error iv-error--center">{error}</p>}
      {step === 0 && <ResumeStep onNext={next} />}
      {step === 1 && <PersonaStep onNext={next} onBack={back} />}
      {step === 2 && <ConfigStep persona={persona} onNext={next} onBack={back} />}
      {step === 3 && <SystemCheckStep onStart={handleStart} onBack={back} loading={loading} />}
    </div>
  );
};

export default Interview;
