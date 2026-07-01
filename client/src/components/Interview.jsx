import React, { useState, useEffect, useRef, useCallback } from 'react';
import { interviewAPI, resumeAPI } from '../services/api';
import { PERSONAS } from '../lib/personas';
import { COMPANY_OPTIONS } from '../lib/companyOptions';
import { createAudioRecorder, getRecordedAudioFileName } from '../lib/audioRecording';
import { stopTtsAudio } from '../lib/ttsAudio';
import { AvatarPortrait } from './interview/AvatarPortrait';
import VoiceIndicator from './interview/VoiceIndicator';
import '../styles/Interview.css';

const STEPS = ['Resume', 'Persona', 'Config', 'System Check'];
const MAX_VIOLATIONS = 3;
const PERSON_CHECK_INTERVAL_MS = 1500;
const PERSON_MISSING_GRACE_MS = 5000;

const isLikelyMobileDevice = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent));

const supportsFullscreen = () =>
  typeof document !== 'undefined' &&
  Boolean(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);

const requestAppFullscreen = () => {
  const el = document.documentElement;
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  return Promise.resolve(false);
};

const exitAppFullscreen = () => {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  return Promise.resolve(false);
};

const isClipboardShortcut = (event) => {
  const key = event.key.toUpperCase();
  return (
    ((event.ctrlKey || event.metaKey) && ['C', 'X', 'V'].includes(key)) ||
    (event.shiftKey && event.key === 'Insert')
  );
};

const isBlockedInterviewShortcut = (event) => {
  const key = event.key.toUpperCase();
  return (
    isClipboardShortcut(event) ||
    event.key === 'F12' ||
    ((event.ctrlKey || event.metaKey) && event.shiftKey && ['I', 'J', 'C', 'U'].includes(key)) ||
    ((event.ctrlKey || event.metaKey) && ['A', 'P', 'S', 'U'].includes(key)) ||
    (event.altKey && event.key === 'Tab')
  );
};

const getVideoFrameStats = (video, canvas) => {
  if (!video || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return { visible: false, variance: 0 };
  }

  const width = 96;
  const height = Math.max(54, Math.round((video.videoHeight / video.videoWidth) * width));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { visible: false, variance: 0 };

  ctx.drawImage(video, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  let total = 0;
  let totalSquared = 0;
  for (let i = 0; i < data.length; i += 16) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    total += luminance;
    totalSquared += luminance * luminance;
  }

  const samples = data.length / 16;
  const mean = total / samples;
  const variance = totalSquared / samples - mean * mean;
  return {
    visible: mean > 18 && mean < 242 && variance > 12,
    variance,
  };
};

const detectPersonPresence = async (video, canvas) => {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return { detected: false, method: 'camera', reason: 'Camera feed is not ready.' };
  }

  if ('FaceDetector' in window) {
    try {
      const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await detector.detect(video);
      if (faces.length > 0) return { detected: true, method: 'face' };
      return { detected: false, method: 'face', reason: 'No face detected in camera view.' };
    } catch {
      // Fall through to frame analysis when native detection is unavailable at runtime.
    }
  }

  const frame = getVideoFrameStats(video, canvas);
  return frame.visible
    ? { detected: true, method: 'camera' }
    : { detected: false, method: 'camera', reason: 'Camera view is blocked or too dark.' };
};

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

function MobileBlockedInterview({ onBack }) {
  useEffect(() => {
    window.alert('AI interviews require a laptop or desktop. Please continue on a larger device with a camera and microphone.');
  }, []);

  return (
    <div className="iv-container">
      <div className="iv-mobile-block">
        <span className="iv-mobile-block-icon">!</span>
        <h2>Use a Laptop or Desktop</h2>
        <p>
          AI mock interviews need desktop-style camera, microphone, fullscreen, and proctoring support.
          Please continue from a laptop or desktop browser.
        </p>
        <button type="button" className="iv-btn iv-btn--primary" onClick={() => onBack?.('dashboard')}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

function playAudioBlob(blob, { onPlay, onEnded, onError } = {}) {
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
  return audio.play().then(() => audio);
}

const ttsErrorMessage = async (_error, fallback) => fallback;

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
          : <><span className="iv-drop-icon">PDF</span><span>Drag and drop PDF here, or click to browse</span></>}
        <input id="resume-file-input" type="file" accept=".pdf,.doc,.docx"
          style={{ display: 'none' }} onChange={e => upload(e.target.files[0])} />
      </div>
      {error && <p className="iv-error">{error}</p>}
      {resume?._duplicate && (
        <p className="iv-info-note">✓ Same resume detected — reusing your existing analysis.</p>
      )}
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
    stopTtsAudio(previewAudioRef.current);
    previewAudioRef.current = null;
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
      const audio = await playAudioBlob(res.data, {
        onPlay: (audioElement) => {
          previewAudioRef.current = audioElement;
        },
        onEnded: () => {
          previewAudioRef.current = null;
          setPreviewing(null);
        },
        onError: () => {
          previewAudioRef.current = null;
          setPreviewing(null);
          setPreviewError('Voice preview unavailable, please try again later.');
        },
      });
      previewAudioRef.current = audio;
    } catch (error) {
      previewAudioRef.current = null;
      setPreviewing(null);
      setPreviewError(await ttsErrorMessage(error, 'Voice preview unavailable, please try again later.'));
    }
  };

  // Cleanup on unmount
  useEffect(() => () => stopPreview(), []);

  return (
    <div className="iv-step">
      <h2 className="iv-step-title">Choose Your Interviewer</h2>
      <p className="iv-step-desc">
        Click a card to select. Press <strong>Preview voice</strong> to hear how they sound before deciding.
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
              <h3 className="iv-persona-name">{p.name}</h3>
              <p className="iv-persona-title">{p.title} · {p.company}</p>
              <p className="iv-persona-personality">{p.personality}</p>
            </div>

            {/* Voice preview button */}
            <button
              className={`iv-preview-btn${previewing === p.id ? ' iv-preview-btn--active' : ''}`}
              onClick={e => handlePreview(p, e)}
              title={previewing === p.id ? 'Stop preview' : 'Preview voice'}
            >
              {previewing === p.id ? (
                <>Stop</>
              ) : (
                <>Preview voice</>
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
    jobDescription: '',
    interviewType: 'Mixed',
    complexity: 'Intermediate',
    duration: 30,
    targetCompany: '',
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
        <label className="iv-label">Job Description</label>
        <textarea
          className="iv-input iv-textarea"
          value={config.jobDescription}
          onChange={e => toggle('jobDescription', e.target.value)}
          placeholder="Paste the job description here so questions can match the role requirements"
          rows={7}
        />
        <label className="iv-label">Target Company</label>
        <select
          className="iv-input"
          value={config.targetCompany}
          onChange={e => toggle('targetCompany', e.target.value)}
        >
          {COMPANY_OPTIONS.map(company => (
            <option key={company.value || 'none'} value={company.value}>
              {company.label}
            </option>
          ))}
        </select>
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
  const personCanvasRef = useRef(null);
  const analyserRef = useRef(null);
  const animRef = useRef(null);
  const [camOk, setCamOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [personOk, setPersonOk] = useState(false);
  const [personMessage, setPersonMessage] = useState('Checking camera view...');
  const [micLevel, setMicLevel] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const mobileCheck = isLikelyMobileDevice();

  useEffect(() => {
    let stream;
    let personCheck;
    let audioContext;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Media devices are not supported.');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            setCamOk(false);
            setPersonOk(false);
            setPersonMessage('Camera was turned off.');
          };
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCamOk(true); setMicOk(true);
        const checkPerson = async () => {
          const result = await detectPersonPresence(videoRef.current, personCanvasRef.current);
          setPersonOk(result.detected);
          setPersonMessage(result.detected ? 'Person detected' : result.reason || 'No person detected');
        };
        personCheck = setInterval(checkPerson, PERSON_CHECK_INTERVAL_MS);
        await checkPerson();
        try {
          const AudioCtor = window.AudioContext || window.webkitAudioContext;
          if (AudioCtor) {
            audioContext = new AudioCtor();
            const src = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser(); analyser.fftSize = 256;
            src.connect(analyser); analyserRef.current = analyser;
            const data = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
              analyser.getByteFrequencyData(data);
              setMicLevel(data.reduce((a, b) => a + b, 0) / data.length / 128);
              animRef.current = requestAnimationFrame(tick);
            };
            tick();
          }
        } catch {
          setMicLevel(0.4);
        }
      } catch {
        setCamOk(false);
        setPersonOk(false);
        setError('Could not access camera/microphone. Please grant permissions.');
      }
    })();
    return () => {
      clearInterval(personCheck);
      if (stream) stream.getTracks().forEach(t => t.stop());
      audioContext?.close?.().catch?.(() => {});
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
          <canvas ref={personCanvasRef} className="iv-hidden-canvas" aria-hidden="true" />
        </div>
        <div className="iv-check-list">
          <div className={`iv-check-item${camOk ? ' iv-check-item--ok' : ''}`}>
            <span className="iv-check-icon">{camOk ? '✓' : '○'}</span> Camera
          </div>
          <div className={`iv-check-item${personOk ? ' iv-check-item--ok' : ''}`}>
            <span className="iv-check-icon">{personOk ? '✓' : '○'}</span> Person detected
          </div>
          {!personOk && camOk && mobileCheck && <p className="iv-check-note">Camera is available. You can continue on mobile if your face is visible.</p>}
          {!personOk && camOk && !mobileCheck && <p className="iv-check-note">{personMessage}</p>}
          <div className={`iv-check-item${micOk ? ' iv-check-item--ok' : ''}`}>
            <span className="iv-check-icon">{micOk ? '✓' : '○'}</span> Microphone
          </div>
          <VoiceIndicator audioLevel={micLevel} isActive={micOk} label="Mic level" />
        </div>
      </div>

      <div className="iv-rules-box">
        <h4>Interview Rules</h4>
        <ul>
          <li><strong>Fullscreen:</strong> Stay in fullscreen at all times.</li>
          <li><strong>Tab switching:</strong> Do not leave this window during the interview.</li>
          <li><strong>Copy/paste:</strong> Clipboard actions are disabled.</li>
          <li><strong>Right-click:</strong> Context menus are disabled.</li>
          <li><strong>Camera:</strong> Keep your face visible at all times.</li>
          <li><strong>Violations:</strong> {MAX_VIOLATIONS} violations will terminate the interview automatically.</li>
        </ul>
      </div>

      <label className="iv-agree-label">
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
        {' '}I understand and agree to all interview rules and fullscreen monitoring
      </label>

      <div className="iv-step-actions">
        <button className="iv-btn iv-btn--ghost" onClick={onBack}>← Back</button>
        <button className="iv-btn iv-btn--primary" disabled={!camOk || (!personOk && !mobileCheck) || !micOk || !agreed || loading} onClick={onStart}>
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
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [personDetected, setPersonDetected] = useState(false);

  const videoRef        = useRef(null);
  const personCanvasRef = useRef(null);
  const recognitionRef  = useRef(null);
  const answerRecorderRef = useRef(null);
  const answerStreamRef = useRef(null);
  const answerChunksRef = useRef([]);
  const answerCaptureModeRef = useRef(null);
  const animRef         = useRef(null);
  const animFrameRef    = useRef(null);
  const timerRef        = useRef(null);
  const ttsSourceRef    = useRef(null);
  const violationCountRef   = useRef(0);
  const autoSubmittedRef    = useRef(false);
  const finishingRef        = useRef(false);
  const sessionClosedRef    = useRef(false);
  const transcriptRef       = useRef([]);
  const personMissingSinceRef = useRef(null);
  const lastCameraViolationAtRef = useRef(0);

  // Keep transcriptRef in sync
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  /* ── Stop listening ─────────────────────────────── */
  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) { try { rec.onend = null; rec.stop(); } catch {} }
    if (answerRecorderRef.current?.state === 'recording') {
      try { answerRecorderRef.current.requestData?.(); } catch {}
      try { answerRecorderRef.current.stop(); } catch {}
    }
    answerRecorderRef.current = null;
    if (answerStreamRef.current) {
      answerStreamRef.current.getTracks().forEach(track => track.stop());
      answerStreamRef.current = null;
    }
    answerCaptureModeRef.current = null;
    setIsListening(false);
    setInterimText('');
  }, []);

  /* ── Stop TTS ───────────────────────────────────── */
  const stopSpeech = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    stopTtsAudio(ttsSourceRef.current);
    ttsSourceRef.current = null;
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
    if (document.fullscreenElement || document.webkitFullscreenElement) { try { await exitAppFullscreen(); } catch {} }
    if (terminatedBySystem) { setTerminated(true); setEnding(false); return; }
    onComplete(interview._id);
  }, [interview._id, onComplete, stopListening, stopSpeech]);

  /* ── Log violation ──────────────────────────────── */
  const logViolation = useCallback(async (type, description) => {
    if (sessionClosedRef.current || autoSubmittedRef.current) return;
    violationCountRef.current += 1;
    const count = violationCountRef.current;
    setViolations(count);
    setViolationMsg(`Warning (${count}/${MAX_VIOLATIONS}): ${description}`);
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
    const fullscreenRequired = supportsFullscreen() && !isLikelyMobileDevice();
    if (fullscreenRequired) {
      requestAppFullscreen().catch(() => {});
    }

    const onFSChange = () => {
      if (fullscreenRequired && !document.fullscreenElement && !document.webkitFullscreenElement && !autoSubmittedRef.current) {
        logViolation('fullscreen_exit', 'Exited fullscreen mode');
        setTimeout(() => {
          if (!sessionClosedRef.current)
            requestAppFullscreen().catch(() => {});
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

    // 7. Keyboard shortcuts (clipboard, print/save/select-all, devtools, Alt+Tab)
    const onKeyDown = e => {
      if (autoSubmittedRef.current) return;
      if (isBlockedInterviewShortcut(e)) {
        e.preventDefault();
        e.stopPropagation();
        const type = isClipboardShortcut(e) ? 'clipboard_shortcut' : 'blocked_shortcut';
        logViolation(type, `Blocked keyboard shortcut: ${e.key}`);
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

    if (fullscreenRequired) document.addEventListener('fullscreenchange', onFSChange);
    if (fullscreenRequired) document.addEventListener('webkitfullscreenchange', onFSChange);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onCopy, true);
    document.addEventListener('cut', onCut, true);
    document.addEventListener('paste', onPaste, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      if (fullscreenRequired) document.removeEventListener('fullscreenchange', onFSChange);
      if (fullscreenRequired) document.removeEventListener('webkitfullscreenchange', onFSChange);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onCopy, true);
      document.removeEventListener('cut', onCut, true);
      document.removeEventListener('paste', onPaste, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onKeyDown, true);
      clearInterval(devToolsCheck);
      if (document.fullscreenElement || document.webkitFullscreenElement) exitAppFullscreen().catch(() => {});
    };
  }, [logViolation]);

  /* ── Camera PiP + mic analyser ──────────────────── */
  useEffect(() => {
    let stream;
    let personCheck;
    let audioContext;
    const mobileSession = isLikelyMobileDevice();
    const reportCameraViolation = (type, description) => {
      const now = Date.now();
      if (now - lastCameraViolationAtRef.current < PERSON_MISSING_GRACE_MS) return;
      lastCameraViolationAtRef.current = now;
      logViolation(type, description);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            setCameraReady(false);
            setPersonDetected(false);
            reportCameraViolation('camera_off', 'Camera was turned off during the interview');
          };
          track.onmute = () => {
            setCameraReady(false);
            setPersonDetected(false);
            reportCameraViolation('camera_muted', 'Camera feed was interrupted during the interview');
          };
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);

        const checkPerson = async () => {
          if (sessionClosedRef.current || autoSubmittedRef.current) return;
          const videoTrack = stream?.getVideoTracks()[0];
          if (!videoTrack || videoTrack.readyState !== 'live' || videoTrack.muted) {
            setCameraReady(false);
            setPersonDetected(false);
            reportCameraViolation('camera_off', 'Camera must stay on during the interview');
            return;
          }

          const result = await detectPersonPresence(videoRef.current, personCanvasRef.current);
          const detected = result.detected || mobileSession;
          setPersonDetected(detected);
          if (detected) {
            personMissingSinceRef.current = null;
            return;
          }

          const now = Date.now();
          if (!personMissingSinceRef.current) {
            personMissingSinceRef.current = now;
            return;
          }

          if (now - personMissingSinceRef.current >= PERSON_MISSING_GRACE_MS) {
            personMissingSinceRef.current = now;
            reportCameraViolation('person_not_detected', result.reason || 'Person was not detected in camera view');
          }
        };
        personCheck = setInterval(checkPerson, PERSON_CHECK_INTERVAL_MS);
        await checkPerson();

        try {
          const AudioCtor = window.AudioContext || window.webkitAudioContext;
          if (AudioCtor) {
            audioContext = new AudioCtor();
            const src = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser(); analyser.fftSize = 128;
            src.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
              analyser.getByteFrequencyData(data);
              setAudioLevel(data.reduce((a, b) => a + b, 0) / data.length / 128);
              animRef.current = requestAnimationFrame(tick);
            };
            tick();
          }
        } catch {
          setAudioLevel(0.4);
        }
      } catch {
        setCameraReady(false);
        setPersonDetected(false);
        reportCameraViolation('camera_unavailable', 'Camera and microphone access are required during the interview');
      }
    })();
    return () => {
      clearInterval(personCheck);
      if (stream) stream.getTracks().forEach(t => t.stop());
      audioContext?.close?.().catch?.(() => {});
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [logViolation]);

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

  /* ── TTS: play interviewer audio blob ───────────── */
  const playSpeechBlob = useCallback(async (blob) => {
    if (sessionClosedRef.current) return false;
    stopTtsAudio(ttsSourceRef.current);
    ttsSourceRef.current = null;

    try {
      const audio = await playAudioBlob(blob, {
        onPlay: (audioElement) => {
          ttsSourceRef.current = audioElement;
          setIsSpeaking(true);
          const tick = () => {
            if (!ttsSourceRef.current || ttsSourceRef.current.paused) return;
            setAudioLevel(0.2 + Math.random() * 0.6);
            animFrameRef.current = requestAnimationFrame(tick);
          };
          tick();
        },
        onEnded: () => {
          cancelAnimationFrame(animFrameRef.current);
          setAudioLevel(0);
          setIsSpeaking(false);
          ttsSourceRef.current = null;
        },
        onError: () => {
          cancelAnimationFrame(animFrameRef.current);
          setIsSpeaking(false);
          ttsSourceRef.current = null;
        },
      });
      ttsSourceRef.current = audio;
      return true;
    } catch {
      cancelAnimationFrame(animFrameRef.current);
      setIsSpeaking(false);
      ttsSourceRef.current = null;
      return false;
    }
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
      if (sessionClosedRef.current) return;
      const played = await playSpeechBlob(res.data);
      if (!played && !sessionClosedRef.current) {
        setTranscript(prev => [...prev, { role: 'system', text: 'Could not play interviewer audio.' }]);
      }
    } catch (error) {
      if (!sessionClosedRef.current) {
        const message = await ttsErrorMessage(error, 'Interviewer audio unavailable, please continue with the text question.');
        setTranscript(prev => [...prev, { role: 'system', text: message }]);
      }
    }
  }, [interview._id, persona, playSpeechBlob]);

  /* ── Speak first question on mount ─────────────── */
  useEffect(() => {
    if (questions.length > 0 && questions[0]?.question) speakQuestion(questions[0].question);
  }, []); // eslint-disable-line

  /* ── Speech recognition ─────────────────────────── */
  const addCandidateTranscript = useCallback((text) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    setTranscript(prev => [...prev, { role: 'candidate', text: clean }]);
  }, []);

  const startRecordedAnswer = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setTranscript(prev => [...prev, { role: 'system', text: 'Microphone recording is not supported in this browser.' }]);
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        },
      });
      const { recorder, mimeType } = createAudioRecorder(stream);
      answerChunksRef.current = [];
      answerStreamRef.current = stream;
      answerRecorderRef.current = recorder;
      answerCaptureModeRef.current = 'recording';

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) answerChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (answerStreamRef.current) {
          answerStreamRef.current.getTracks().forEach(track => track.stop());
          answerStreamRef.current = null;
        }
      };

      recorder.start(250);
      setIsListening(true);
      setInterimText('Recording your answer...');
      return true;
    } catch {
      setTranscript(prev => [...prev, { role: 'system', text: 'Could not access microphone. Please allow microphone permission and try again.' }]);
      setIsListening(false);
      setInterimText('');
      return false;
    }
  };

  const startListening = ({ allowRecordingFallback = true, preferRecording = false } = {}) => {
    if (sessionClosedRef.current || ending) return;
    stopSpeech();
    if (preferRecording) {
      startRecordedAnswer();
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      if (allowRecordingFallback) startRecordedAnswer();
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
      if (final) { setInterimText(''); addCandidateTranscript(final); }
    };
    rec.onend = () => { if (!sessionClosedRef.current) setIsListening(false); };
    rec.onerror = () => {
      if (!sessionClosedRef.current && answerCaptureModeRef.current === 'speech' && allowRecordingFallback) {
        startRecordedAnswer();
      }
    };
    try {
      rec.start();
    } catch {
      if (allowRecordingFallback) startRecordedAnswer();
      return;
    }
    recognitionRef.current = rec;
    answerCaptureModeRef.current = 'speech';
    setIsListening(true);
  };

  const getAnswerSinceLastQuestion = useCallback(() => {
    const curr = transcriptRef.current;
    const lastInterviewerIdx = [...curr].map((m, i) => m.role === 'interviewer' ? i : -1).filter(i => i >= 0).pop() ?? -1;
    return curr
      .slice(lastInterviewerIdx + 1)
      .filter(m => m.role === 'candidate')
      .map(m => m.text)
      .join(' ')
      .trim();
  }, []);

  const finishRecordedAnswer = async () => {
    const recorder = answerRecorderRef.current;
    if (!recorder || answerCaptureModeRef.current !== 'recording') return '';

    const chunksReady = new Promise((resolve) => {
      recorder.onstop = () => {
        if (answerStreamRef.current) {
          answerStreamRef.current.getTracks().forEach(track => track.stop());
          answerStreamRef.current = null;
        }
        resolve();
      };
    });

    try { recorder.requestData?.(); } catch {}
    try {
      if (recorder.state === 'recording') recorder.stop();
    } catch {}
    await chunksReady;

    const usedType = recorder.mimeType || 'audio/webm';
    answerRecorderRef.current = null;
    answerCaptureModeRef.current = null;
    setIsListening(false);
    setInterimText('');

    if (!answerChunksRef.current.length) return '';

    try {
      setIsProcessingAnswer(true);
      const blob = new Blob(answerChunksRef.current, { type: usedType });
      const formData = new FormData();
      formData.append('audio', blob, getRecordedAudioFileName('interview-answer', blob.type));
      const response = await interviewAPI.transcribe(interview._id, formData);
      const text = response.data?.text || response.data?.transcript || '';
      addCandidateTranscript(text);
      return text.trim();
    } catch {
      setTranscript(prev => [...prev, { role: 'system', text: 'Could not transcribe your answer. Please try again.' }]);
      return '';
    } finally {
      setIsProcessingAnswer(false);
      answerChunksRef.current = [];
    }
  };

  const finishUserAnswer = async () => {
    if (ending || isProcessingAnswer) return;

    if (answerCaptureModeRef.current === 'recording') {
      const recordedAnswer = await finishRecordedAnswer();
      if (recordedAnswer) submitAnswer(recordedAnswer);
      return;
    }

    await stopListening();
    const ans = getAnswerSinceLastQuestion();
    if (ans) submitAnswer(ans);
  };

  const prefersRecordedInput = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  const handleAnswerButton = () => {
    if (ending || isProcessingAnswer) return;
    if (isListening || answerCaptureModeRef.current) {
      finishUserAnswer();
      return;
    }
    startListening({
      allowRecordingFallback: true,
      preferRecording: prefersRecordedInput(),
    });
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

  const playCurrentQuestion = () => {
    if (!currentQ?.question || sessionClosedRef.current || ending) return;
    stopSpeech();
    speakQuestion(currentQ.question, false);
  };

  /* Violation color: green → yellow → orange → red */
  const violationColor = ['#10b981', '#f59e0b', '#f97316', '#ef4444'][Math.min(violations, 3)];

  if (terminated) {
    return (
      <div className="iv-terminated">
        <div className="iv-terminated-icon">!</div>
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
        <canvas ref={personCanvasRef} className="iv-hidden-canvas" aria-hidden="true" />
        <span className="iv-timer" data-warn={timer < 300}>{fmtTime(timer)}</span>
        <span className="iv-q-counter">Q {currentIdx + 1} / {questions.length}</span>
        <span className="iv-rec-dot">● REC</span>
        <span className={`iv-camera-status${cameraReady && personDetected ? ' iv-camera-status--ok' : ''}`}>
          {cameraReady && personDetected ? 'PERSON OK' : cameraReady ? 'PERSON CHECK' : 'CAMERA OFF'}
        </span>
        {violations > 0 && (
          <span className="iv-violation-count" style={{ color: violationColor }}>
            {violations}/{MAX_VIOLATIONS} violations
          </span>
        )}
        <span className="iv-proctor-status">{isSpeaking ? 'Interviewer speaking' : isListening ? 'Listening' : 'Ready'}</span>
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
          <p className="iv-persona-tag">{persona?.name}</p>
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
              type="button"
              className="iv-btn iv-btn--ghost"
              disabled={ending || isProcessingAnswer || !currentQ}
              onClick={playCurrentQuestion}
            >
              Play question
            </button>
            <button
              type="button"
              className={`iv-btn${isListening ? ' iv-btn--danger' : ' iv-btn--primary'}`}
              disabled={ending || isProcessingAnswer}
              onClick={handleAnswerButton}
            >
              {isProcessingAnswer ? 'Checking answer...' : isListening ? 'Submit answer' : 'Start answer'}
            </button>
            <button type="button" className="iv-btn iv-btn--ghost" disabled={ending || isProcessingAnswer}
              onClick={() => { stopListening(); submitAnswer('', true); }}>
              Skip
            </button>
            <button type="button" className="iv-btn iv-btn--ghost iv-btn--finish" disabled={ending || isProcessingAnswer}
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

  if (isLikelyMobileDevice()) {
    return <MobileBlockedInterview onBack={setCurrentView} />;
  }

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
        jobDescription:  data.config?.jobDescription?.trim() || undefined,
        targetCompany:   data.config?.targetCompany || undefined,
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
