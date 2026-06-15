import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sessionAPI } from '../services/api';
import { createAudioRecorder, getRecordedAudioFileName } from '../lib/audioRecording';

const PREP_SECONDS = 30;
const SPEAKING_SECONDS = 60;

const pickImage = (images, currentId = null) => {
  if (!images?.length) return null;
  if (images.length === 1) return images[0];
  const pool = images.filter((image) => image.id !== currentId);
  return pool[Math.floor(Math.random() * pool.length)];
};

export default function ImageDescriptionTask({ level, onBack }) {
  const [images, setImages] = useState([]);
  const [currentImage, setCurrentImage] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [prepLeft, setPrepLeft] = useState(PREP_SECONDS);
  const [speakingLeft, setSpeakingLeft] = useState(SPEAKING_SECONDS);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [checking, setChecking] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startedAtRef = useRef(null);

  const cleanupRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current?.state === 'recording') {
      try { recorderRef.current.stop(); } catch {}
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const cleanupRecordedUrl = useCallback(() => {
    setRecordedAudioUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    sessionAPI
      .getImageDescriptionImages(level)
      .then((response) => {
        if (!mounted) return;
        const nextImages = response.data?.images || [];
        setImages(nextImages);
        setCurrentImage(pickImage(nextImages));
        setPrepLeft(response.data?.prepSeconds || PREP_SECONDS);
        setSpeakingLeft(response.data?.speakingSeconds || SPEAKING_SECONDS);
        setPhase('ready');
      })
      .catch(() => {
        if (!mounted) return;
        setError('Could not load image description tasks.');
        setPhase('ready');
      });

    return () => {
      mounted = false;
      cleanupRecording();
      cleanupRecordedUrl();
    };
  }, [cleanupRecordedUrl, cleanupRecording, level]);

  const submitAudio = useCallback(async (blob, durationSeconds) => {
    if (!currentImage) return;
    try {
      setChecking(true);
      setError('');
      const formData = new FormData();
      formData.append('audio', blob, getRecordedAudioFileName('image-description', blob.type));
      formData.append('imageId', currentImage.id);
      formData.append('level', level);
      formData.append('durationSeconds', String(durationSeconds || SPEAKING_SECONDS));
      const response = await sessionAPI.checkImageDescription(formData);
      setFeedback(response.data);
      setPhase('feedback');
    } catch (err) {
      console.error('Image description check failed:', err);
      setError(err.response?.data?.message || 'Could not evaluate your image description.');
      setPhase('recorded');
    } finally {
      setChecking(false);
    }
  }, [currentImage, level]);

  const finishRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current?.state === 'recording') {
      try { recorderRef.current.requestData?.(); } catch {}
      try { recorderRef.current.stop(); } catch {}
    }
  }, []);

  const beginRecording = useCallback(async () => {
    try {
      setError('');
      setFeedback(null);
      cleanupRecordedUrl();

      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setError('Audio recording is not supported in this browser.');
        setPhase('ready');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { recorder, mimeType } = createAudioRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const usedType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: usedType });
        recorderRef.current = null;

        if (!blob.size) {
          setError('No audio was captured. Please try again.');
          setPhase('ready');
          return;
        }

        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        setRecordedAudioUrl(URL.createObjectURL(blob));
        setPhase('recorded');
        submitAudio(blob, durationSeconds);
      };

      recorder.start(250);
      setSpeakingLeft(SPEAKING_SECONDS);
      setPhase('speaking');
      timerRef.current = setInterval(() => {
        setSpeakingLeft((seconds) => {
          if (seconds <= 1) {
            finishRecording();
            return 0;
          }
          return seconds - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Recording failed:', err);
      setError('Microphone access failed. Please allow microphone permission and try again.');
      setPhase('ready');
    }
  }, [cleanupRecordedUrl, finishRecording, submitAudio]);

  const startTask = () => {
    if (!currentImage) return;
    setError('');
    setFeedback(null);
    cleanupRecordedUrl();
    setPrepLeft(PREP_SECONDS);
    setPhase('prep');
    timerRef.current = setInterval(() => {
      setPrepLeft((seconds) => {
        if (seconds <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          beginRecording();
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
  };

  const chooseAnotherImage = () => {
    cleanupRecording();
    cleanupRecordedUrl();
    setCurrentImage((current) => pickImage(images, current?.id));
    setFeedback(null);
    setError('');
    setPrepLeft(PREP_SECONDS);
    setSpeakingLeft(SPEAKING_SECONDS);
    setPhase('ready');
  };

  const timerValue = phase === 'prep' ? prepLeft : speakingLeft;
  const timerLabel = phase === 'prep' ? 'Prep time' : phase === 'speaking' ? 'Speaking time' : 'Ready';

  if (phase === 'loading') {
    return <div className="loading">Loading image description task...</div>;
  }

  return (
    <div className="image-description-task">
      <div className="practice-header">
        <div className="practice-header-left">
          <button type="button" className="practice-back-btn" onClick={onBack}>
            ← Back
          </button>
          <div>
            <h2>Describe the image</h2>
            <p>Speaking {level} · IELTS-style long turn</p>
          </div>
        </div>
        <div className={`image-task-timer ${phase === 'speaking' ? 'active' : ''}`}>
          <span>{timerLabel}</span>
          <strong>{String(Math.floor(timerValue / 60)).padStart(2, '0')}:{String(timerValue % 60).padStart(2, '0')}</strong>
        </div>
      </div>

      {currentImage && (
        <div className="image-task-layout">
          <div className="image-task-media">
            <img
              src={currentImage.imageUrl}
              alt={currentImage.alt || currentImage.title}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = `https://picsum.photos/seed/${encodeURIComponent(currentImage.id)}/900/600`;
              }}
            />
            <span>{currentImage.credit}</span>
          </div>

          <div className="image-task-panel">
            <div>
              <span className="journey-kicker">{currentImage.title}</span>
              <p className="image-task-prompt">{currentImage.prompt}</p>
            </div>

            <div className="image-task-actions">
              {phase === 'ready' || phase === 'feedback' || phase === 'recorded' ? (
                <button type="button" className="btn-primary" onClick={startTask} disabled={checking}>
                  Start Task
                </button>
              ) : null}
              {phase === 'speaking' && (
                <button type="button" className="record-btn recording" onClick={finishRecording}>
                  Stop Recording
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={chooseAnotherImage} disabled={phase === 'prep' || phase === 'speaking' || checking}>
                New Image
              </button>
            </div>

            {recordedAudioUrl && (
              <audio
                controls
                src={recordedAudioUrl}
                onError={() => setError('Could not play recorded audio. Try recording again.')}
              />
            )}

            {checking && <p className="completion-note">Checking your image description...</p>}
            {error && <p className="error">{error}</p>}

            {feedback && (
              <div className="image-feedback">
                <div className="image-feedback-grid">
                  <div><span>Words</span><strong>{feedback.wordCount}/{feedback.targetWordCount}</strong></div>
                  <div><span>Fluency</span><strong>{feedback.fluencyWpm} wpm</strong></div>
                  <div><span>Vocabulary</span><strong>{feedback.keywordScore}%</strong></div>
                  <div><span>Overall</span><strong>{feedback.scores?.overall ?? 0}%</strong></div>
                </div>
                <div>
                  <strong>Transcript</strong>
                  <p>{feedback.transcript || 'No transcript was returned.'}</p>
                </div>
                {feedback.vocabularySuggestions?.length > 0 && (
                  <div>
                    <strong>Try these words next time</strong>
                    <div className="hint-grid">
                      {feedback.vocabularySuggestions.map((word) => <span key={word}>{word}</span>)}
                    </div>
                  </div>
                )}
                {feedback.feedback?.map((item) => <p key={item} className="image-feedback-note">{item}</p>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
