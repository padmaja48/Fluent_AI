import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sessionAPI } from '../services/api';
import { createAudioRecorder, getRecordedAudioFileName } from '../lib/audioRecording';
import '../styles/Practice.css';
import '../styles/MixedTests.css';
import '../styles/Writing.css';
import '../styles/Reading.css';
import '../styles/TestGuard.css';

export const MixedTests = ({ onTestActiveChange }) => {
  const [journey, setJourney] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState('A1');
  const [selectedTestNumber, setSelectedTestNumber] = useState(1);
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [finishedSession, setFinishedSession] = useState(null);
  const [error, setError] = useState(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [speakingResult, setSpeakingResult] = useState(null);
  const [checkingSpeaking, setCheckingSpeaking] = useState(false);
  const [writingText, setWritingText] = useState('');
  const [writingResult, setWritingResult] = useState(null);
  const [checkingWriting, setCheckingWriting] = useState(false);
  const [answersByQuestion, setAnswersByQuestion] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const startedAtRef = useRef(null);
  const timerRef = useRef(null);
  const autoSubmitRef = useRef(false);

  const currentQuestion = questions[currentIndex];
  const selectedLevelMeta = journey?.levels?.find((level) => level.id === selectedLevel);
  const selectedTest = selectedLevelMeta?.tests?.find((test) => test.testNumber === selectedTestNumber);
  const activeLevel = journey?.activeLevel || 'A1';

  // ── Time limits per question skill (seconds) ───────────────────────
  const TIME_LIMITS = { Listening: 60, Speaking: 90, Reading: 120, Writing: 300 };

  // ── Fullscreen helpers ─────────────────────────────────────────────
  const enterFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  };

  const exitFullscreen = () => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  };

  const isCurrentlyFullscreen = () =>
    Boolean(document.fullscreenElement || document.webkitFullscreenElement);

  const cleanupRecordingUrl = useCallback(() => {
    setRecordedAudioUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
  }, []);

  const resetQuestionState = useCallback(() => {
    setSelectedAnswer(null);
    setSpeakingResult(null);
    setRecordedBlob(null);
    cleanupRecordingUrl();
    setRecording(false);
    setAudioPlaying(false);
    setWritingText('');
    setWritingResult(null);
    window.speechSynthesis?.cancel();
  }, [cleanupRecordingUrl]);

  const loadJourney = useCallback(async () => {
    try {
      setLoading(true);
      const response = await sessionAPI.getTestJourney();
      setJourney(response.data);
      setSelectedLevel((current) => {
        const currentLevel = response.data.levels?.find((level) => level.id === current);
        const nextLevel = currentLevel && !currentLevel.locked ? currentLevel : response.data.levels?.find((level) => level.id === response.data.activeLevel);
        setSelectedTestNumber(nextLevel?.nextTestNumber || 1);
        return nextLevel?.id || response.data.activeLevel || 'A1';
      });
    } catch (err) {
      console.error('Failed to load test journey:', err);
      setError('Failed to load mixed test journey.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJourney();
  }, [loadJourney]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      cleanupRecordingUrl();
      mediaRecorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
      clearInterval(timerRef.current);
      if (isCurrentlyFullscreen()) exitFullscreen();
    };
  }, [cleanupRecordingUrl]);

  // ── Notify parent about active test state ─────────────────────────
  useEffect(() => {
    onTestActiveChange?.(sessionStarted);
  }, [sessionStarted, onTestActiveChange]);

  // ── Comprehensive test-integrity guards ───────────────────────────
  useEffect(() => {
    if (!sessionStarted) return;

    const trigger = (reason) => {
      if (autoSubmitRef.current) return;
      autoSubmitRef.current = true;
      handleAutoSubmitOnFullscreenExit(reason);
    };

    // 1. Fullscreen exit
    const onFsChange = () => {
      const nowFs = isCurrentlyFullscreen();
      setIsFullscreen(nowFs);
      if (!nowFs) trigger('Test auto-submitted: fullscreen was exited.');
    };

    // 2. Tab hidden / window minimised
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        trigger('Test auto-submitted: you switched tabs or minimised the window.');
      }
    };

    // 3. Window loses focus (Alt+Tab, another app, etc.) — 800ms grace to avoid
    //    false positives from browser chrome interactions (URL bar, devtools)
    let blurTimer = null;
    const onBlur = () => {
      blurTimer = setTimeout(() => {
        if (!document.hasFocus()) {
          trigger('Test auto-submitted: window lost focus (tab switch or alt+tab detected).');
        }
      }, 800);
    };
    const onFocus = () => clearTimeout(blurTimer);

    // 4. Refresh / close tab
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('beforeunload', onBeforeUnload);
      clearTimeout(blurTimer);
    };
  }, [sessionStarted]);

  // ── Per-question countdown timer ─────────────────────────────────
  useEffect(() => {
    if (!sessionStarted || !currentQuestion) return;

    const skill = currentQuestion.skill || 'Listening';
    const limit = TIME_LIMITS[skill] || 60;
    setTimeLeft(limit);
    clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [sessionStarted, currentIndex]);

  // ── Auto-submit all unanswered and finish ─────────────────────────
  const forceFinish = useCallback(async (reason = '') => {
    clearInterval(timerRef.current);
    if (!session) return;
    try {
      const duration = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0;
      const response = await sessionAPI.submitSession(session._id, duration, {});
      setFinishedSession(response.data);
      setSessionStarted(false);
      setSession(null);
      setQuestions([]);
      if (isCurrentlyFullscreen()) exitFullscreen();
      await loadJourney();
      if (reason) setError(reason);
    } catch (err) {
      console.error('Force finish failed:', err);
    }
  }, [session, loadJourney]);

  const handleTimeExpired = useCallback(() => {
    // Auto-skip: submit blank answer and move on
    if (!session || !currentQuestion) return;
    sessionAPI
      .submitAnswer(session._id, currentQuestion._id, '', false, 0)
      .catch(() => {})
      .finally(async () => {
        setAnswersByQuestion((cur) => ({
          ...cur,
          [currentQuestion._id]: { answer: '', score: 0 },
        }));
        if (currentIndex < questions.length - 1) {
          resetQuestionState();
          setCurrentIndex((i) => i + 1);
        } else {
          await forceFinish();
        }
      });
  }, [session, currentQuestion, currentIndex, questions.length, forceFinish, resetQuestionState]);

  const handleAutoSubmitOnFullscreenExit = useCallback(async (reason = 'Test auto-submitted: test integrity violation detected.') => {
    await forceFinish(reason);
  }, [forceFinish]);

  const chooseLevel = (level) => {
    if (level.locked || sessionStarted) return;
    setSelectedLevel(level.id);
    setSelectedTestNumber(level.nextTestNumber || 1);
    setFinishedSession(null);
    setError(null);
  };

  const chooseTest = (test) => {
    if (test.locked || sessionStarted) return;
    setSelectedTestNumber(test.testNumber);
    setFinishedSession(null);
    setError(null);
  };

  const startMixedTest = () => {
    if (!selectedLevelMeta || selectedLevelMeta.locked || selectedTest?.locked || selectedTest?.status === 'Completed') return;
    setShowFullscreenPrompt(true);
  };

  const confirmStartTest = async () => {
    setShowFullscreenPrompt(false);
    enterFullscreen();
    setIsFullscreen(true);
    autoSubmitRef.current = false;
    try {
      setStarting(true);
      setError(null);
      setFinishedSession(null);
      const response = await sessionAPI.createMixedTest(selectedLevel, selectedTestNumber);
      setSession(response.data.session);
      setQuestions(response.data.questions || []);
      setAnswersByQuestion({});
      setCurrentIndex(0);
      startedAtRef.current = Date.now();
      resetQuestionState();
      setSessionStarted(true);
    } catch (err) {
      console.error('Failed to start mixed test:', err);
      setError(err.response?.data?.message || 'Failed to start mixed test.');
      if (isCurrentlyFullscreen()) exitFullscreen();
    } finally {
      setStarting(false);
    }
  };

  const playListeningAudio = () => {
    if (!currentQuestion) return;

    if (audioPlaying) {
      window.speechSynthesis?.cancel();
      setAudioPlaying(false);
      return;
    }

    if (!window.speechSynthesis) {
      setError('Text-to-speech is not supported in this browser.');
      return;
    }

    let didStartSpeaking = false;
    const speak = () => {
      if (didStartSpeaking) return;
      didStartSpeaking = true;
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume?.();
      const utterance = new SpeechSynthesisUtterance(currentQuestion.passageText || currentQuestion.stem);
      utterance.lang = 'en-US';
      utterance.rate = selectedLevel === 'A1' || selectedLevel === 'A2' ? 0.84 : selectedLevel === 'C1' || selectedLevel === 'C2' ? 1.02 : 0.94;
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find((v) => v.lang.startsWith('en'));
      if (englishVoice) utterance.voice = englishVoice;
      utterance.onend = () => setAudioPlaying(false);
      utterance.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        setAudioPlaying(false);
        setError('Unable to play listening audio.');
      };
      setAudioPlaying(true);
      window.speechSynthesis.speak(utterance);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', speak, { once: true });
    }
    speak();
  };

  const startRecording = async () => {
    try {
      setError(null);
      setSpeakingResult(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Microphone recording is not supported in this browser.');
        return;
      }
      if (typeof MediaRecorder === 'undefined') {
        setError('Audio recording is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const { recorder, mimeType } = createAudioRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const usedType = recorder.mimeType || mimeType || 'audio/webm';
        if (!audioChunksRef.current.length) {
          setError('No audio was captured. Please try recording again.');
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: usedType });
        cleanupRecordingUrl();
        setRecordedAudioUrl(URL.createObjectURL(blob));
        setRecordedBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250); // collect chunks every 250ms for reliability
      setRecording(true);
    } catch (err) {
      console.error('Recording failed:', err);
      setError('Microphone access failed. Please allow microphone permission and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      try {
        mediaRecorderRef.current.requestData?.();
      } catch {
        // Some browsers do not allow requestData during shutdown.
      }
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const checkSpeakingAnswer = async () => {
    if (!recordedBlob || !currentQuestion) return;

    try {
      setCheckingSpeaking(true);
      setError(null);
      const formData = new FormData();
      formData.append('audio', recordedBlob, getRecordedAudioFileName('mixed-speaking-answer', recordedBlob.type));
      formData.append('question', currentQuestion.stem);
      formData.append('expectedAnswer', currentQuestion.correctAnswer || '');
      const response = await sessionAPI.checkSpeaking(formData);
      setSpeakingResult(response.data);
    } catch (err) {
      console.error('Speaking check failed:', err);
      setError('Could not check your speaking answer.');
    } finally {
      setCheckingSpeaking(false);
    }
  };

  const moveNextOrFinish = async () => {
    resetQuestionState();
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((idx) => idx + 1);
      return;
    }

    clearInterval(timerRef.current);
    try {
      const duration = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0;
      const response = await sessionAPI.submitSession(session._id, duration, {});
      setFinishedSession(response.data);
      setSessionStarted(false);
      setSession(null);
      setQuestions([]);
      if (isCurrentlyFullscreen()) exitFullscreen();
      await loadJourney();
    } catch (err) {
      console.error('Failed to submit mixed test:', err);
      setError('Failed to submit mixed test.');
    }
  };

  const submitObjectiveAnswer = async () => {
    if (!session || !currentQuestion || !selectedAnswer) return;

    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    try {
      await sessionAPI.submitAnswer(session._id, currentQuestion._id, selectedAnswer, isCorrect, isCorrect ? 100 : 0);
      setAnswersByQuestion((current) => ({
        ...current,
        [currentQuestion._id]: { answer: selectedAnswer, score: isCorrect ? 100 : 0 },
      }));
      await moveNextOrFinish();
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setError('Failed to submit answer.');
    }
  };

  const submitSpeakingAnswer = async () => {
    if (!session || !currentQuestion || !speakingResult) return;
    const score = speakingResult.evaluation?.score ?? 0;

    try {
      await sessionAPI.submitAnswer(
        session._id,
        currentQuestion._id,
        speakingResult.transcript || 'Recorded speaking answer',
        score >= 60,
        score,
      );
      setAnswersByQuestion((current) => ({
        ...current,
        [currentQuestion._id]: { answer: speakingResult.transcript, score },
      }));
      await moveNextOrFinish();
    } catch (err) {
      console.error('Failed to submit speaking answer:', err);
      setError('Failed to submit speaking answer.');
    }
  };

  const checkWritingAnswer = async () => {
    if (!writingText.trim() || !currentQuestion) return;
    try {
      setCheckingWriting(true);
      setError(null);
      const criteria = currentQuestion.audioPrompt || 'grammar, vocabulary, coherence, task achievement';
      const response = await sessionAPI.checkWriting(currentQuestion.stem, selectedLevel, criteria, writingText);
      setWritingResult(response.data.evaluation);
    } catch (err) {
      console.error('Writing check failed:', err);
      setError(err.response?.data?.message || 'Could not evaluate your writing. Please try again.');
    } finally {
      setCheckingWriting(false);
    }
  };

  const submitWritingAnswer = async () => {
    if (!session || !currentQuestion || !writingResult) return;
    const score = writingResult.score ?? 0;
    try {
      await sessionAPI.submitAnswer(session._id, currentQuestion._id, writingText, score >= 60, score);
      setAnswersByQuestion((current) => ({
        ...current,
        [currentQuestion._id]: { answer: writingText, score },
      }));
      await moveNextOrFinish();
    } catch (err) {
      console.error('Failed to submit writing answer:', err);
      setError('Failed to submit writing answer.');
    }
  };

  if (loading) return <div className="loading">Loading mixed tests...</div>;

  if (!sessionStarted) {
    return (
      <div className="mixed-tests-page">
        {showFullscreenPrompt && (
          <div className="test-fs-overlay">
            <div className="test-fs-modal">
              <div className="test-fs-icon">⛶</div>
              <h3>Fullscreen Required</h3>
              <p>This test runs in fullscreen mode to maintain focus. Exiting fullscreen will automatically submit your test.</p>
              <div className="test-fs-actions">
                <button type="button" className="btn-primary" onClick={confirmStartTest}>
                  Enter Fullscreen & Start Test
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowFullscreenPrompt(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="mixed-hero">
          <div>
            <span className="journey-kicker">Level Test Environment</span>
            <h2>Mixed Listening, Speaking, Reading, and Writing tests.</h2>
            <p>
              Each level contains {journey?.testsPerLevel || 100} separate tests. Every test uses its own question slice, so test slots do not repeat question IDs inside the same level.
            </p>
          </div>
          <div className="mixed-hero-panel">
            <strong>{journey?.testsPerLevel || 100}</strong>
            <span>tests per level</span>
            <small>{journey?.questionsPerSkill || 6} from each skill</small>
          </div>
        </div>

        <div className="test-level-grid">
          {(journey?.levels || []).map((level) => {
            const isSelected = selectedLevel === level.id;
            const isActive = activeLevel === level.id;
            return (
              <button
                key={level.id}
                type="button"
                className={`test-level-card ${isSelected ? 'active' : ''} ${isActive ? 'current' : ''} ${level.locked ? 'locked' : ''}`}
                onClick={() => chooseLevel(level)}
                disabled={level.locked}
              >
                <span>{level.id}</span>
                <strong>{level.label}</strong>
                <p>{level.description}</p>
                <div className="test-level-stats">
                  <small>{level.completedTests} completed</small>
                  <small>{Number(level.averageScore || 0).toFixed(1)} avg</small>
                </div>
              </button>
            );
          })}
        </div>

        <div className="test-console">
          <div>
            <span className="journey-kicker">Selected Level</span>
            <h3>
              {selectedLevelMeta?.id} {selectedLevelMeta?.label} · Test {selectedTestNumber}
            </h3>
            <p>{selectedLevelMeta?.description}</p>
            {selectedLevelMeta?.locked && <p className="journey-lock-note">Complete earlier level tests to unlock this level.</p>}
            {selectedTest?.status === 'Completed' && <p className="journey-lock-note">This test is complete. Select the next unlocked test.</p>}
            {finishedSession && (
              <div className="test-complete-note">
                <strong>Report sent</strong>
                <span>
                  {finishedSession.testLabel || 'Mixed test'} finished with {Number(finishedSession.averageScore || 0).toFixed(1)}/100. A structured report was queued to your email.
                </span>
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={!selectedLevelMeta || selectedLevelMeta.locked || selectedTest?.locked || selectedTest?.status === 'Completed' || starting}
            onClick={startMixedTest}
          >
            {starting ? 'Building fresh test...' : selectedTest?.status === 'In Progress' ? 'Continue Test' : 'Start Selected Test'}
          </button>
        </div>

        <div className="test-slot-panel">
          <div className="test-slot-header">
            <div>
              <span className="journey-kicker">{selectedLevel} Test Map</span>
              <h3>100 separate tests</h3>
            </div>
            <strong>{selectedLevelMeta?.completedTests || 0}/{selectedLevelMeta?.totalTests || 100} complete</strong>
          </div>
          <div className="test-slot-map">
            {(selectedLevelMeta?.tests || []).map((test) => (
              <button
                key={test.testNumber}
                type="button"
                className={`test-slot ${test.testNumber === selectedTestNumber ? 'selected' : ''} ${test.status === 'Completed' ? 'completed' : ''} ${
                  test.status === 'In Progress' ? 'in-progress' : ''
                } ${test.locked ? 'locked' : ''}`}
                onClick={() => chooseTest(test)}
                disabled={test.locked}
                title={`${selectedLevel} Test ${test.testNumber}`}
              >
                {test.testNumber}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return <div className="loading">Loading test question...</div>;

  const answeredCount = Object.keys(answersByQuestion).length;
  const progressPercent = questions.length ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const questionSkill = currentQuestion.skill || 'Practice';

  const timerMins = timeLeft !== null ? Math.floor(timeLeft / 60) : null;
  const timerSecs = timeLeft !== null ? timeLeft % 60 : null;
  const timerClass = timeLeft !== null && timeLeft <= 10 ? 'test-timer danger' : timeLeft !== null && timeLeft <= 30 ? 'test-timer warning' : 'test-timer';

  return (
    <div className={`practice-session mixed-test-session skill-${questionSkill.toLowerCase()}`}>
      {!isFullscreen && (
        <div className="test-integrity-banner">
          <span>⚠ Fullscreen exited — your test is being submitted automatically.</span>
        </div>
      )}
      <div className="practice-header mixed-test-header">
        <div>
          <h2>{session?.testLabel || `${selectedLevel} Mixed Test`}</h2>
          <p>
            {questionSkill} · Question {currentIndex + 1} of {questions.length} · {answeredCount} saved
          </p>
        </div>
        {timeLeft !== null && (
          <div className={timerClass}>
            <span className="test-timer-icon">⏱</span>
            <span className="test-timer-value">
              {String(timerMins).padStart(2, '0')}:{String(timerSecs).padStart(2, '0')}
            </span>
            <span className="test-timer-label">per question</span>
          </div>
        )}
        <span className="progress-text">{Math.round(progressPercent)}%</span>
      </div>

      <div className="mixed-progress-track">
        <div style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="skill-lab mixed-skill-lab">
        <span>{questionSkill}</span>
        <p>
          This mixed test scores each answer and emails a structured report when the final question is submitted.
        </p>
      </div>

      <div className="question-card">
        <div className="question-meta">
          <span className="level-badge">{selectedLevel}</span>
          <span className="question-type">{questionSkill}</span>
          <span className="question-type">{currentQuestion.moduleLabel || currentQuestion.type}</span>
        </div>
        <p className="question-text">{currentQuestion.stem}</p>

        {questionSkill === 'Reading' && currentQuestion.passageText && (
          <div className="reading-inline-passage">
            {currentQuestion.audioPrompt && (
              <h4 className="reading-passage-title">{currentQuestion.audioPrompt}</h4>
            )}
            <div className="reading-passage-body">
              {currentQuestion.passageText.split('\n\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          </div>
        )}

        {currentQuestion.hints && currentQuestion.hints.length > 0 && (
          <div className="hint-grid">
            {currentQuestion.hints.map((hint, idx) => (
              <span key={idx}>{hint}</span>
            ))}
          </div>
        )}

        {questionSkill === 'Listening' && (
          <div className="listening-player">
            {currentQuestion.audioPrompt && <strong>{currentQuestion.audioPrompt}</strong>}
            {currentQuestion.audioUrl ? (
              <audio controls src={currentQuestion.audioUrl} />
            ) : (
              <button type="button" className="audio-btn" onClick={playListeningAudio}>
                {audioPlaying ? 'Stop Audio' : 'Play Listening Audio'}
              </button>
            )}
          </div>
        )}

        {questionSkill === 'Speaking' && (
          <div className="speaking-recorder">
            <div className="recorder-actions">
              <button
                type="button"
                className={`record-btn ${recording ? 'recording' : ''}`}
                onClick={recording ? stopRecording : startRecording}
              >
                {recording ? 'Stop Recording' : 'Record Answer'}
              </button>
              <button
                type="button"
                className="audio-btn"
                onClick={checkSpeakingAnswer}
                disabled={!recordedBlob || checkingSpeaking || recording}
              >
                {checkingSpeaking ? 'Checking...' : 'Check Speaking'}
              </button>
            </div>
            {recordedAudioUrl && (
              <audio
                controls
                src={recordedAudioUrl}
                style={{ width: '100%', marginTop: '8px' }}
                onError={() => setError('Could not play recorded audio. Try recording again.')}
              >
                Your browser does not support audio playback.
              </audio>
            )}
            {speakingResult && (
              <div className="speaking-feedback">
                <div>
                  <strong>Your transcript</strong>
                  <p>{speakingResult.transcript}</p>
                </div>
                <div>
                  <strong>Evaluation</strong>
                  <p>{speakingResult.evaluation?.feedback}</p>
                  <span>Score: {speakingResult.evaluation?.score ?? 0}/100</span>
                </div>
              </div>
            )}
          </div>
        )}

        {questionSkill === 'Writing' && (
          <div className="writing-workspace">
            <div className="writing-criteria">
              <strong>Evaluation criteria:</strong>
              <span>{currentQuestion.audioPrompt || 'grammar, vocabulary, coherence, task achievement'}</span>
            </div>
            <div className="writing-hints">
              {(currentQuestion.hints || []).map((hint, idx) => (
                <span key={idx} className="writing-hint">{hint}</span>
              ))}
            </div>
            <textarea
              className="writing-textarea"
              placeholder="Write your response here…"
              value={writingText}
              onChange={(e) => setWritingText(e.target.value)}
              disabled={Boolean(writingResult)}
              rows={10}
            />
            <div className="writing-counter">
              {writingText.trim().split(/\s+/).filter(Boolean).length} words
            </div>
            {writingResult && (
              <div className="writing-result">
                <div className="writing-score-row">
                  <div className="writing-score-main">
                    <strong>{writingResult.score}</strong>
                    <span>/100</span>
                  </div>
                  <div className="writing-score-breakdown">
                    <div><span>Grammar</span><strong>{writingResult.grammarScore}</strong></div>
                    <div><span>Vocabulary</span><strong>{writingResult.vocabularyScore}</strong></div>
                    <div><span>Coherence</span><strong>{writingResult.coherenceScore}</strong></div>
                    <div><span>Task</span><strong>{writingResult.taskAchievementScore}</strong></div>
                  </div>
                </div>
                <p className="writing-feedback">{writingResult.feedback}</p>
                {writingResult.strengths?.length > 0 && (
                  <div className="writing-detail strengths">
                    <strong>Strengths</strong>
                    <ul>{writingResult.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {writingResult.improvements?.length > 0 && (
                  <div className="writing-detail improvements">
                    <strong>Areas to improve</strong>
                    <ul>{writingResult.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {questionSkill !== 'Speaking' && questionSkill !== 'Writing' && (
          <div className={questionSkill === 'Reading' ? 'reading-options-list' : 'options-list'}>
            {(currentQuestion.options || []).map((option, idx) => (
              <button
                key={idx}
                className={questionSkill === 'Reading'
                  ? `reading-option-btn ${selectedAnswer === option.text ? 'selected' : ''}`
                  : `option-btn ${selectedAnswer === option.text ? 'selected' : ''}`}
                onClick={() => setSelectedAnswer(option.text)}
              >
                <span className={questionSkill === 'Reading' ? 'reading-option-key' : 'option-key'}>
                  {String.fromCharCode(questionSkill === 'Reading' ? 97 + idx : 65 + idx)}
                </span>
                <span>{option.text}</span>
              </button>
            ))}
          </div>
        )}

        <div className="question-actions">
          {questionSkill === 'Speaking' ? (
            <button onClick={submitSpeakingAnswer} disabled={!speakingResult} className="btn-primary">
              Save Speaking Answer
            </button>
          ) : questionSkill === 'Writing' ? (
            writingResult ? (
              <button onClick={submitWritingAnswer} className="btn-primary">
                Save & Continue
              </button>
            ) : (
              <button
                onClick={checkWritingAnswer}
                disabled={checkingWriting || writingText.trim().split(/\s+/).filter(Boolean).length < 5}
                className="btn-primary"
              >
                {checkingWriting ? 'Evaluating…' : 'Submit for Evaluation'}
              </button>
            )
          ) : (
            <button onClick={submitObjectiveAnswer} disabled={!selectedAnswer} className="btn-primary">
              Save Answer
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
};

export default MixedTests;
