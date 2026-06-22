import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { sessionAPI } from '../services/api';
import { createAudioRecorder, getRecordedAudioFileName } from '../lib/audioRecording';
import { getApiErrorMessage, playTtsAudio, stopTtsAudio } from '../lib/ttsAudio';
import ImageDescriptionTask from './ImageDescriptionTask';
import ListeningReferenceTask from './ListeningReferenceTask';
import TtsVoiceSelector, { useTtsSpeaker } from './TtsVoiceSelector';
import '../styles/Practice.css';
import '../styles/Writing.css';
import '../styles/Reading.css';

const SKILLS = ['Listening', 'Speaking', 'Reading', 'Writing'];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const DEFAULT_SET_SIZE = 10;
const DEFAULT_TOTAL_SETS = 100;
const DEFAULT_SETS_PER_MODULE = 20;

export const Practice = ({
  resumeSession = null,
  initialSkill = null,
  onInitialSkillConsumed = null,
  onMounted = null,
  onGoToDashboard = null,
}) => {
  const { user } = useContext(AuthContext);
  const [skill, setSkill] = useState('Listening');
  const [level, setLevel] = useState(user?.level || 'A1');
  const [selectedModuleOrder, setSelectedModuleOrder] = useState(1);
  const [selectedModuleSet, setSelectedModuleSet] = useState(1);
  const [journey, setJourney] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [error, setError] = useState(null);
  const [completionNotice, setCompletionNotice] = useState(null);
  // Track stored answers for each question (index → answer text / feedback)
  const [storedAnswers, setStoredAnswers] = useState({});
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [speakingResult, setSpeakingResult] = useState(null);
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [checkingSpeaking, setCheckingSpeaking] = useState(false);
  const [imageTaskActive, setImageTaskActive] = useState(false);
  const [listeningReferenceActive, setListeningReferenceActive] = useState(false);
  const [writingText, setWritingText] = useState('');
  const [writingResult, setWritingResult] = useState(null);
  const [checkingWriting, setCheckingWriting] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const ttsAudioRef = useRef(null);
  const [ttsSpeaker, setTtsSpeaker] = useTtsSpeaker();

  const stopCurrentTts = useCallback(() => {
    stopTtsAudio(ttsAudioRef.current);
    ttsAudioRef.current = null;
    setAudioPlaying(false);
  }, []);

  const setSize = journey?.setSize || DEFAULT_SET_SIZE;
  const totalSets = journey?.totalSetsPerSkillLevel || DEFAULT_TOTAL_SETS;
  const totalSetsPerModule = journey?.totalSetsPerModule || DEFAULT_SETS_PER_MODULE;
  const currentLevelProgress = journey?.progress?.[skill]?.[level];
  const modules = currentLevelProgress?.modules || [];
  const currentModuleProgress =
    modules.find((module) => module.moduleOrder === selectedModuleOrder) || modules[0] || {
      moduleOrder: 1,
      label: 'Module',
      totalSets: totalSetsPerModule,
      completedSets: [],
      completedCount: 0,
      nextSetNumber: 1,
      locked: false,
    };
  const completedSetNumbers = new Set((currentModuleProgress?.completedSets || []).map((item) => item.setNumber));
  const selectedSet = (selectedModuleOrder - 1) * totalSetsPerModule + selectedModuleSet;
  const selectedSetCompleted = completedSetNumbers.has(selectedModuleSet);
  const canStartSelectedSet =
    !currentModuleProgress.locked && (selectedSetCompleted || selectedModuleSet <= (currentModuleProgress.nextSetNumber || 1));
  const selectedSetStartOrder = (selectedSet - 1) * setSize + 1;
  const selectedSetEndOrder = selectedSet * setSize;

  const resetQuestionState = useCallback(() => {
    setSelectedAnswer(null);
    setSpeakingResult(null);
    setAnswerFeedback(null);
    setRecordedBlob(null);
    setRecordedAudioUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
    setRecording(false);
    setAudioPlaying(false);
    setWritingText('');
    setWritingResult(null);
    stopCurrentTts();
  }, [stopCurrentTts]);

  const loadJourney = useCallback(async () => {
    try {
      const response = await sessionAPI.getJourney();
      setJourney(response.data);
      return response.data;
    } catch (err) {
      console.error('Failed to load journey map:', err);
      setError('Failed to load journey map.');
      return null;
    }
  }, []);

  useEffect(() => {
    loadJourney();
  }, [loadJourney]);

  useEffect(() => {
    return () => {
      stopCurrentTts();
      setRecordedAudioUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return null;
      });
      mediaRecorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stopCurrentTts]);

  useEffect(() => {
    const progress = journey?.progress?.[skill]?.[level];
    if (!progress) return;
    setSelectedModuleOrder(progress.nextModuleOrder || 1);
    setSelectedModuleSet(progress.nextModuleSetNumber || 1);
  }, [journey, skill, level]);

  // Notify parent once so it clears resumeTarget (prevents re-applying on re-renders)
  useEffect(() => {
    if (onMounted) onMounted();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore an in-progress session passed from Dashboard
  useEffect(() => {
    if (!resumeSession) return;
    const { session: s, questions: qs } = resumeSession;
    if (!s || !qs?.length) return;

    // Rebuild stored answers from session.questions (answered so far)
    const stored = {};
    (s.questions || []).forEach((qa, idx) => {
      if (qa.userAnswer) stored[idx] = qa.userAnswer;
    });

    const answeredCount = (s.questions || []).filter(q => q.userAnswer).length;
    const resumeIndex = Math.min(answeredCount, qs.length - 1);

    setSkill(s.skill || 'Listening');
    setLevel(s.level || 'A1');
    setSession(s);
    setQuestions(qs);
    setCurrentIndex(resumeIndex);
    setStoredAnswers(stored);
    setSessionStarted(true);
    resetQuestionState();
  }, [resumeSession]);

  const getLevelProgress = (targetSkill, targetLevel) =>
    journey?.progress?.[targetSkill]?.[targetLevel] || {
      totalQuestions: 0,
      totalSets,
      completedSets: [],
      completedCount: 0,
      nextSetNumber: 1,
    };

  const getCurrentPosition = (targetSkill) => {
    for (const targetLevel of LEVELS) {
      const progress = getLevelProgress(targetSkill, targetLevel);
      if ((progress.completedCount || 0) < (progress.totalSets || totalSets)) {
        return {
          level: targetLevel,
          moduleOrder: progress.nextModuleOrder || 1,
          moduleSetNumber: progress.nextModuleSetNumber || 1,
          setNumber: progress.nextSetNumber || 1,
          completedCount: progress.completedCount || 0,
          totalSets: progress.totalSets || totalSets,
        };
      }
    }

    return {
      level: 'C2',
      moduleOrder: 5,
      moduleSetNumber: totalSetsPerModule,
      setNumber: totalSets,
      completedCount: totalSets,
      totalSets,
    };
  };

  const chooseSkill = (targetSkill) => {
    const position = getCurrentPosition(targetSkill);
    setSkill(targetSkill);
    setLevel(position.level);
    setSelectedModuleOrder(position.moduleOrder);
    setSelectedModuleSet(position.moduleSetNumber);
  };

  useEffect(() => {
    if (!initialSkill || sessionStarted) return;
    if (!SKILLS.includes(initialSkill)) return;
    chooseSkill(initialSkill);
    onInitialSkillConsumed?.();
  }, [initialSkill, journey]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseLevel = (targetLevel) => {
    const progress = getLevelProgress(skill, targetLevel);
    setLevel(targetLevel);
    setSelectedModuleOrder(progress.nextModuleOrder || 1);
    setSelectedModuleSet(progress.nextModuleSetNumber || 1);
  };

  const chooseModule = (module) => {
    if (module.locked) return;
    setSelectedModuleOrder(module.moduleOrder);
    setSelectedModuleSet(module.nextSetNumber || 1);
  };

  const startPracticeSession = async () => {
    if (!canStartSelectedSet) return;

    try {
      setLoading(true);
      setError(null);
      setCompletionNotice(null);
      const sessionRes = await sessionAPI.createSession(skill, level, selectedSet, selectedModuleOrder, selectedModuleSet);
      const createdSession = sessionRes.data.session || sessionRes.data;
      const sessionQuestions = sessionRes.data.questions || [];

      if (!sessionQuestions.length) {
        setSession(null);
        setQuestions([]);
        setSessionStarted(false);
        setError(`No active ${skill} questions are available for ${level} set ${selectedSet}.`);
        return;
      }

      setSession(createdSession);
      setQuestions(sessionQuestions);
      setCurrentIndex(0);
      resetQuestionState();
      setSessionStarted(true);
    } catch (err) {
      console.error('Failed to start session:', err);
      setError('Failed to start practice session.');
    } finally {
      setLoading(false);
    }
  };

  const advanceQuestion = () => {
    resetQuestionState();
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishSession();
    }
  };

  const submitAnswer = async (isCorrect, answerOverride = selectedAnswer, scoreOverride = isCorrect ? 100 : 0) => {
    if (!session || !questions[currentIndex]) return;

    try {
      await sessionAPI.submitAnswer(
        session._id,
        questions[currentIndex]._id,
        answerOverride,
        isCorrect,
        scoreOverride,
      );
      advanceQuestion();
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setError('Failed to submit answer.');
    }
  };

  const submitObjectiveAnswer = async () => {
    const currentQuestion = questions[currentIndex];
    if (!session || !currentQuestion || !selectedAnswer || answerFeedback) return;

    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    try {
      await sessionAPI.submitAnswer(session._id, currentQuestion._id, selectedAnswer, isCorrect, isCorrect ? 100 : 0);
      setStoredAnswers(prev => ({ ...prev, [currentIndex]: selectedAnswer }));
      setAnswerFeedback({
        isCorrect,
        selectedAnswer,
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
      });
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setError('Failed to submit answer.');
    }
  };

  const playListeningAudio = async () => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) return;

    if (audioPlaying) {
      stopCurrentTts();
      return;
    }

    const spokenText = currentQuestion.passageText || currentQuestion.stem;
    if (!spokenText) return;

    try {
      setError(null);
      setAudioPlaying(true);
      const audio = await playTtsAudio({
        text: spokenText,
        speaker: ttsSpeaker,
        level,
        context: 'listening',
        onPlay: (audioElement) => {
          ttsAudioRef.current = audioElement;
          setAudioPlaying(true);
        },
        onEnded: () => {
          ttsAudioRef.current = null;
          setAudioPlaying(false);
        },
        onError: () => {
          ttsAudioRef.current = null;
          setAudioPlaying(false);
          setError('Unable to play listening audio.');
        },
      });
      ttsAudioRef.current = audio;
    } catch (err) {
      console.error('ElevenLabs TTS failed:', err);
      ttsAudioRef.current = null;
      setAudioPlaying(false);
      const message = await getApiErrorMessage(err, 'Unable to play listening audio.');
      setError(
        message.includes('ELEVENLABS_API_KEY')
          ? 'ElevenLabs API key is missing in server/.env. Add ELEVENLABS_API_KEY and restart the server.'
          : message.includes('ELEVENLABS_VOICE_ID')
            ? 'ElevenLabs voice ID is missing in server/.env. Add ELEVENLABS_VOICE_ID and restart the server.'
          : message,
      );
    }
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
        setRecordedAudioUrl((currentUrl) => {
          if (currentUrl) URL.revokeObjectURL(currentUrl);
          return URL.createObjectURL(blob);
        });
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
    const currentQuestion = questions[currentIndex];
    if (!recordedBlob || !currentQuestion) return;

    try {
      setCheckingSpeaking(true);
      setError(null);
      const formData = new FormData();
      formData.append('audio', recordedBlob, getRecordedAudioFileName('speaking-answer', recordedBlob.type));
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

  const checkWritingAnswer = async () => {
    const currentQuestion = questions[currentIndex];
    if (!writingText.trim() || !currentQuestion) return;

    try {
      setCheckingWriting(true);
      setError(null);
      const criteria = currentQuestion.audioPrompt || 'grammar, vocabulary, coherence, task achievement';
      const response = await sessionAPI.checkWriting(currentQuestion.stem, level, criteria, writingText);
      setWritingResult(response.data.evaluation);
    } catch (err) {
      console.error('Writing check failed:', err);
      setError(err.response?.data?.message || 'Could not evaluate your writing. Please try again.');
    } finally {
      setCheckingWriting(false);
    }
  };

  const submitWritingAnswer = async () => {
    const currentQuestion = questions[currentIndex];
    if (!session || !currentQuestion || !writingResult) return;

    const score = writingResult.score ?? 0;
    try {
      await sessionAPI.submitAnswer(session._id, currentQuestion._id, writingText, score >= 60, score);
      setStoredAnswers(prev => ({ ...prev, [currentIndex]: writingText }));
      setAnswerFeedback({
        isCorrect: score >= 60,
        selectedAnswer: writingText,
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
      });
    } catch (err) {
      console.error('Failed to submit writing answer:', err);
      setError('Failed to submit writing answer.');
    }
  };

  const finishSession = async () => {
    try {
      await sessionAPI.submitSession(session._id, 0, {});
      setSessionStarted(false);
      const freshJourney = await loadJourney();
      const freshProgress = freshJourney?.progress?.[skill]?.[level];
      setSelectedModuleOrder(freshProgress?.nextModuleOrder || selectedModuleOrder);
      setSelectedModuleSet(freshProgress?.nextModuleSetNumber || selectedModuleSet);
      setCompletionNotice('Set completed. Your journey map has been updated.');
    } catch (err) {
      console.error('Failed to finish session:', err);
      setError('Failed to finish session.');
    }
  };

  if (!sessionStarted) {
    if (imageTaskActive) {
      return (
        <ImageDescriptionTask
          level={level}
          onBack={() => {
            setImageTaskActive(false);
            loadJourney();
          }}
        />
      );
    }

    if (listeningReferenceActive) {
      return (
        <ListeningReferenceTask
          level={level}
          onBack={() => {
            setListeningReferenceActive(false);
            loadJourney();
          }}
        />
      );
    }

    return (
      <div className="practice-journey">
        <div className="practice-page-actions">
          <button
            type="button"
            className="practice-dashboard-btn"
            onClick={() => onGoToDashboard?.()}
          >
            Back to Dashboard
          </button>
        </div>

        <div className="journey-hero">
          <div>
            <span className="journey-kicker">Practice Journey</span>
            <h2>1000 questions per level, unlocked module by module.</h2>
            <p>
              Each skill-level has 5 modules, each module has {totalSetsPerModule} sets, and each set has {setSize} questions.
            </p>
          </div>
          <div className="journey-stat">
            <strong>{SKILLS.length * LEVELS.length * (journey?.questionsPerSkillLevel || 1000)}</strong>
            <span>Total practice questions</span>
          </div>
        </div>

        <div className="skill-overview">
          {SKILLS.map((item) => {
            const position = getCurrentPosition(item);
            const isActive = item === skill;
            return (
              <button
                key={item}
                type="button"
                className={`skill-card ${isActive ? 'active' : ''}`}
                onClick={() => chooseSkill(item)}
              >
                <span>{item}</span>
                <strong>
                  {position.level} M{position.moduleOrder}.S{position.moduleSetNumber}
                </strong>
                <small>
                  {position.completedCount}/{position.totalSets} sets in current level
                </small>
              </button>
            );
          })}
        </div>

        <div className="journey-board">
          <div className="journey-sidebar">
            <div className="segmented-control">
              {SKILLS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === skill ? 'active' : ''}
                  onClick={() => chooseSkill(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="level-stack">
              {LEVELS.map((item) => {
                const progress = getLevelProgress(skill, item);
                const percent = progress.totalSets ? Math.round((progress.completedCount / progress.totalSets) * 100) : 0;
                return (
                  <button
                    key={item}
                    type="button"
                    className={`level-card ${item === level ? 'active' : ''}`}
                    onClick={() => chooseLevel(item)}
                  >
                    <span className="level-card-badge">{item}</span>
                    <div className="level-card-info">
                      <strong>{progress.completedCount}/{progress.totalSets || totalSets} sets</strong>
                      <small>{percent}% complete</small>
                      <div className="level-progress-track">
                        <div style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="set-map-panel">
            <div className="set-map-header">
              <div>
                <span className="journey-kicker">{skill} Journey</span>
                <h3>
                  {level} Module {selectedModuleOrder}: {currentModuleProgress.label}
                </h3>
                <p>
                  Set {selectedModuleSet}/{currentModuleProgress.totalSets || totalSetsPerModule} · Questions {selectedSetStartOrder}-{selectedSetEndOrder}
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={startPracticeSession}
                disabled={loading || !canStartSelectedSet}
              >
                {loading ? 'Starting...' : selectedSetCompleted ? 'Review Set' : 'Start Module Set'}
              </button>
            </div>

            {skill === 'Speaking' && (
              <div className="speaking-hub-card">
                <div>
                  <span className="journey-kicker">Speaking Exercise</span>
                  <h4>Describe the image</h4>
                  <p>Prepare for 30 seconds, then speak for 60 seconds about a contextual image.</p>
                </div>
                <button type="button" className="btn-primary" onClick={() => setImageTaskActive(true)}>
                  Describe the image
                </button>
              </div>
            )}

            {skill === 'Listening' && (
              <div className="speaking-hub-card">
                <div>
                  <span className="journey-kicker">Listening Exercise</span>
                  <h4>IELTS-style listening</h4>
                  <p>Practise original listening sections inspired by test-style audio resources.</p>
                </div>
                <button type="button" className="btn-primary" onClick={() => setListeningReferenceActive(true)}>
                  IELTS-style listening
                </button>
              </div>
            )}

            <div className="module-track">
              {(modules.length ? modules : Array.from({ length: 5 }, (_, idx) => ({ moduleOrder: idx + 1, label: `Module ${idx + 1}`, totalSets: totalSetsPerModule, completedCount: 0, locked: idx > 0 }))).map((module) => (
                <button
                  key={module.moduleOrder}
                  type="button"
                  className={`module-node ${module.moduleOrder === selectedModuleOrder ? 'active' : ''} ${module.locked ? 'locked' : ''}`}
                  onClick={() => chooseModule(module)}
                  disabled={module.locked}
                >
                  <span>M{module.moduleOrder}</span>
                  <strong>{module.label}</strong>
                  <small>{module.completedCount}/{module.totalSets} sets</small>
                </button>
              ))}
            </div>

            <div className="set-map-wrap">
              <div className="set-map-legend">
                <div className="set-legend-item"><span className="set-legend-dot completed" />Completed</div>
                <div className="set-legend-item"><span className="set-legend-dot current" />Current</div>
                <div className="set-legend-item"><span className="set-legend-dot available" />Available</div>
                <div className="set-legend-item"><span className="set-legend-dot locked-dot" />Locked</div>
              </div>
              <div className="set-map">
                {Array.from({ length: currentModuleProgress?.totalSets || totalSetsPerModule }, (_, idx) => {
                  const setNumber = idx + 1;
                  const isCompleted = completedSetNumbers.has(setNumber);
                  const isCurrent = setNumber === currentModuleProgress.nextSetNumber && !isCompleted;
                  const isSelected = setNumber === selectedModuleSet;
                  const isLocked = currentModuleProgress.locked || (setNumber > currentModuleProgress.nextSetNumber && !isCompleted);
                  return (
                    <button
                      key={setNumber}
                      type="button"
                      className={`set-node ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${
                        isSelected ? 'selected' : ''
                      } ${isLocked ? 'locked' : ''}`}
                      onClick={() => !isLocked && setSelectedModuleSet(setNumber)}
                      disabled={isLocked}
                      title={`${level} ${currentModuleProgress.label} Set ${setNumber}`}
                    >
                      {setNumber}
                    </button>
                  );
                })}
              </div>

              {!canStartSelectedSet && (
                <p className="journey-lock-note">
                  Complete the earlier module sets first to unlock this part of the journey.
                </p>
              )}
              {error && <p className="error">{error}</p>}
              {completionNotice && <p className="completion-note">✓ {completionNotice}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return <div className="loading">Loading questions...</div>;
  const skillMode = {
    Listening: {
      label: 'Audio Lab',
      description: 'Play the clip, track the speaker intent, then choose the answer that matches the actual audio.',
    },
    Speaking: {
      label: 'Voice Studio',
      description: 'Record your response, check it against the expected answer signal, then submit your score.',
    },
    Reading: {
      label: 'Comprehension Desk',
      description: 'Read the passage first, then answer using direct evidence from the text.',
    },
    Writing: {
      label: 'Writing Studio',
      description: 'Read the prompt carefully, write your response in the text area, then submit for AI evaluation.',
    },
  }[skill];

  const handleBackToJourney = () => {
    stopCurrentTts();
    setSessionStarted(false);
    setSession(null);
    setQuestions([]);
    setCurrentIndex(0);
    setStoredAnswers({});
    resetQuestionState();
    loadJourney();
  };

  if (skill === 'Reading') {
    return (
      <div className="practice-session skill-reading">
        <div className="practice-header">
          <div className="practice-header-left">
            <button type="button" className="practice-back-btn" onClick={handleBackToJourney} title="Back to Practice">
              « all texts
            </button>
            <div>
              <h2>Reading {level} Set {session?.setNumber || selectedSet}</h2>
              <p>{session?.moduleLabel || currentModuleProgress.label} · Questions {session?.startOrder || selectedSetStartOrder}–{session?.endOrder || selectedSetEndOrder}</p>
            </div>
          </div>
          <div className="practice-header-right">
            <div className="practice-q-dots">
              {questions.map((_, idx) => (
                <span
                  key={idx}
                  className={`pq-dot ${idx < currentIndex ? 'done' : idx === currentIndex ? 'active' : ''}`}
                  title={`Q${idx + 1}${storedAnswers[idx] ? ' (answered)' : ''}`}
                />
              ))}
            </div>
            <span className="progress-text">Question {currentIndex + 1} of {questions.length}</span>
          </div>
        </div>

        <div className="reading-layout">
          <div className="reading-passage-panel">
            {currentQuestion.audioPrompt && (
              <h3 className="reading-passage-title">{currentQuestion.audioPrompt}</h3>
            )}
            <div className="reading-passage-body">
              {(currentQuestion.passageText || '').split('\n\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="reading-question-panel">
            <div className="reading-comprehension-copy">
              <h2>Did you understand the text?</h2>
              <p>Please answer the following questions of understanding:</p>
            </div>

            <div className="reading-question-block">
              <span className="reading-question-label">Question {currentIndex + 1}:</span>
              <p className="reading-question-text">{currentQuestion.stem}</p>
            </div>

            <div className="reading-options-list">
              {(currentQuestion.options || []).map((option, idx) => (
                <button
                  key={idx}
                  className={`reading-option-btn ${selectedAnswer === option.text ? 'selected' : ''} ${
                    answerFeedback && option.isCorrect ? 'correct-option' : ''
                  } ${answerFeedback && selectedAnswer === option.text && !option.isCorrect ? 'wrong-option' : ''}`}
                  onClick={() => !answerFeedback && setSelectedAnswer(option.text)}
                  disabled={Boolean(answerFeedback)}
                >
                  <span className="reading-option-key">{String.fromCharCode(97 + idx)}</span>
                  <span>{option.text}</span>
                </button>
              ))}
            </div>

            {answerFeedback && (
              <div className={`answer-feedback ${answerFeedback.isCorrect ? 'correct' : 'incorrect'}`}>
                <strong>{answerFeedback.isCorrect ? 'Correct!' : 'Not quite'}</strong>
                <p>{answerFeedback.explanation}</p>
                {!answerFeedback.isCorrect && <span>Correct answer: {answerFeedback.correctAnswer}</span>}
              </div>
            )}

            <div className="question-actions">
              {answerFeedback ? (
                <button onClick={advanceQuestion} className="btn-primary">
                  {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Set'}
                </button>
              ) : (
                <button onClick={submitObjectiveAnswer} disabled={!selectedAnswer} className="btn-primary">
                  Check Answer
                </button>
              )}
            </div>
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`practice-session skill-${skill.toLowerCase()}`}>
      <div className="practice-header">
        <div className="practice-header-left">
          <button type="button" className="practice-back-btn" onClick={handleBackToJourney} title="Back to Practice">
            ← Back
          </button>
          <div>
            <h2>
              {skill} {level} Set {session?.setNumber || selectedSet}
            </h2>
            <p>
              {session?.moduleLabel || currentModuleProgress.label} · Questions {session?.startOrder || selectedSetStartOrder}-{session?.endOrder || selectedSetEndOrder}
            </p>
          </div>
        </div>
        <div className="practice-header-right">
          <div className="practice-q-dots">
            {questions.map((_, idx) => (
              <span
                key={idx}
                className={`pq-dot ${idx < currentIndex ? 'done' : idx === currentIndex ? 'active' : ''}`}
                title={`Q${idx + 1}${storedAnswers[idx] ? ' (answered)' : ''}`}
              />
            ))}
          </div>
          <span className="progress-text">
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>
      </div>

      <div className="skill-lab">
        <span>{skillMode.label}</span>
        <p>{skillMode.description}</p>
      </div>

      <div className="question-card">
        <div className="question-meta">
          <span className="level-badge">{level}</span>
          <span className="question-type">{currentQuestion.type}</span>
          <span className="question-type">{currentQuestion.moduleLabel || currentModuleProgress.label}</span>
          <span className="question-type">Set {session?.moduleSetNumber || selectedModuleSet}</span>
        </div>
        <p className="question-text">{currentQuestion.stem}</p>

        {currentQuestion.hints && currentQuestion.hints.length > 0 && (
          <div className="hint-grid">
            {currentQuestion.hints.map((hint, idx) => (
              <span key={idx}>{hint}</span>
            ))}
          </div>
        )}

        {skill === 'Listening' && (
          <div className="listening-player">
            {currentQuestion.audioPrompt && <strong>{currentQuestion.audioPrompt}</strong>}
            {currentQuestion.audioUrl ? (
              <audio controls src={currentQuestion.audioUrl} />
            ) : (
              <div className="listening-controls">
                <TtsVoiceSelector value={ttsSpeaker} onChange={setTtsSpeaker} />
                <button type="button" className="audio-btn" onClick={playListeningAudio}>
                  {audioPlaying ? 'Stop Audio' : 'Play Listening Audio'}
                </button>
              </div>
            )}
          </div>
        )}

        {skill === 'Speaking' && (
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
                {checkingSpeaking ? 'Checking...' : 'Check With Answer'}
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
                  <strong>Feedback</strong>
                  <p>{speakingResult.evaluation?.feedback}</p>
                  <span>Score: {speakingResult.evaluation?.score ?? 0}/100</span>
                </div>
              </div>
            )}
          </div>
        )}

        {skill === 'Writing' && (
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

        {skill !== 'Speaking' && skill !== 'Writing' && currentQuestion.options && currentQuestion.options.length > 0 && (
          <div className="options-list">
            {currentQuestion.options.map((option, idx) => (
              <button
                key={idx}
                className={`option-btn ${selectedAnswer === option.text ? 'selected' : ''} ${
                  answerFeedback && option.isCorrect ? 'correct-option' : ''
                } ${answerFeedback && selectedAnswer === option.text && !option.isCorrect ? 'wrong-option' : ''}`}
                onClick={() => !answerFeedback && setSelectedAnswer(option.text)}
                disabled={Boolean(answerFeedback)}
              >
                <span className="option-key">{String.fromCharCode(65 + idx)}</span>
                {option.text}
              </button>
            ))}
          </div>
        )}

        {answerFeedback && skill !== 'Writing' && (
          <div className={`answer-feedback ${answerFeedback.isCorrect ? 'correct' : 'incorrect'}`}>
            <strong>{answerFeedback.isCorrect ? 'Correct evaluation' : 'Review this one'}</strong>
            <p>{answerFeedback.explanation}</p>
            {!answerFeedback.isCorrect && <span>Correct answer: {answerFeedback.correctAnswer}</span>}
          </div>
        )}

        <div className="question-actions">
          {skill === 'Speaking' ? (
            <button
              onClick={() =>
                submitAnswer(
                  (speakingResult?.evaluation?.score ?? 0) >= 60,
                  speakingResult?.transcript || 'Recorded speaking answer',
                  speakingResult?.evaluation?.score ?? 0,
                )
              }
              disabled={!speakingResult}
              className="btn-primary"
            >
              Submit Speaking Answer
            </button>
          ) : skill === 'Writing' ? (
            writingResult ? (
              answerFeedback ? (
                <button onClick={advanceQuestion} className="btn-primary">
                  {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Set'}
                </button>
              ) : (
                <button onClick={submitWritingAnswer} className="btn-primary">
                  Save & Continue
                </button>
              )
            ) : (
              <button
                onClick={checkWritingAnswer}
                disabled={checkingWriting || writingText.trim().split(/\s+/).filter(Boolean).length < 5}
                className="btn-primary"
              >
                {checkingWriting ? 'Evaluating…' : 'Submit for Evaluation'}
              </button>
            )
          ) : answerFeedback ? (
            <button onClick={advanceQuestion} className="btn-primary">
              {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Set'}
            </button>
          ) : (
            <button
              onClick={submitObjectiveAnswer}
              disabled={!selectedAnswer}
              className="btn-primary"
            >
              Check Answer
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
};
