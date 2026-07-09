import React, { useMemo, useRef, useState } from 'react';
import { getTtsApiErrorMessage, playTtsAudio, stopTtsAudio } from '../lib/ttsAudio';
import TtsVoiceSelector, { useTtsSpeaker } from './TtsVoiceSelector';

const listeningSets = [
  {
    id: 'campus-orientation',
    title: 'Campus Orientation Desk',
    section: 'Section 1',
    script:
      'Receptionist: Good morning. You are here for the new student orientation, right? Student: Yes, my name is Kavya Rao. Receptionist: Please take the blue folder from the table. Your first talk is in Room 204 at ten fifteen. After that, you will meet your mentor near the library entrance. Student: Do I need my ID card today? Receptionist: Yes, show it at the lunch counter. The campus tour starts at two o clock, but the sports centre visit is cancelled because of maintenance.',
    questions: [
      {
        prompt: 'What should Kavya take from the table?',
        options: ['A blue folder', 'A sports pass', 'A library card', 'A lunch coupon'],
        answer: 'A blue folder',
      },
      {
        prompt: 'Where is the first talk?',
        options: ['Room 204', 'The library entrance', 'The sports centre', 'The lunch counter'],
        answer: 'Room 204',
      },
      {
        prompt: 'What is cancelled?',
        options: ['The sports centre visit', 'The campus tour', 'The mentor meeting', 'The first talk'],
        answer: 'The sports centre visit',
      },
    ],
  },
  {
    id: 'museum-tour',
    title: 'Museum Tour Information',
    section: 'Section 2',
    script:
      'Guide: Welcome to the city museum audio tour. Start in Gallery A, where you will see photographs of the old railway station. Please spend no more than fifteen minutes there because a school group arrives at half past eleven. Gallery B has the textile collection, but the lights are low to protect the cloth. The cafe is open until four, and tickets for the evening lecture are available at the information desk. If you lose your group, wait beside the large clock near the main staircase.',
    questions: [
      {
        prompt: 'What is shown in Gallery A?',
        options: ['Photographs of the old railway station', 'A textile collection', 'A large clock', 'Evening lecture tickets'],
        answer: 'Photographs of the old railway station',
      },
      {
        prompt: 'Why should visitors limit time in Gallery A?',
        options: ['A school group will arrive', 'The lights are low', 'The cafe will close', 'The staircase is crowded'],
        answer: 'A school group will arrive',
      },
      {
        prompt: 'Where should lost visitors wait?',
        options: ['Beside the large clock', 'Inside Gallery B', 'At the cafe door', 'Near the railway photos'],
        answer: 'Beside the large clock',
      },
    ],
  },
  {
    id: 'volunteer-briefing',
    title: 'Community Volunteer Briefing',
    section: 'Section 3',
    script:
      'Coordinator: Before Saturday clean-up begins, please check your team number on the notice board. Team One will collect plastic near the lake path. Team Two will speak to visitors and explain why reusable bottles are helpful. Team Three will count the bags at the end, so we can report the result to the council. Volunteer: Should we bring gloves? Coordinator: We have gloves and bags, but bring water. If it rains heavily, we will move the briefing to the school hall and start one hour later.',
    questions: [
      {
        prompt: 'What will Team Two do?',
        options: ['Speak to visitors', 'Count the bags', 'Clean the school hall', 'Collect plastic near the path'],
        answer: 'Speak to visitors',
      },
      {
        prompt: 'What should volunteers bring?',
        options: ['Water', 'Gloves', 'Bags', 'A notice board'],
        answer: 'Water',
      },
      {
        prompt: 'What happens if there is heavy rain?',
        options: ['The briefing moves to the school hall', 'The clean-up is cancelled completely', 'Team Three starts first', 'The council sends more bags'],
        answer: 'The briefing moves to the school hall',
      },
    ],
  },
  {
    id: 'accommodation-call',
    title: 'Student Accommodation Call',
    section: 'Section 1',
    script:
      'Agent: Riverside House, how can I help? Student: I am calling about a single room for September. Agent: We have one room on the third floor. It costs eight thousand rupees per month, including internet, but electricity is separate. Student: Is the bus stop close? Agent: Yes, it is two minutes away. The kitchen is shared by five students. If you want the room, send your ID copy before Friday evening. Student: Can I visit tomorrow? Agent: Yes, come after three thirty.',
    questions: [
      {
        prompt: 'Which cost is separate from the rent?',
        options: ['Electricity', 'Internet', 'Kitchen use', 'Bus travel'],
        answer: 'Electricity',
      },
      {
        prompt: 'How far is the bus stop?',
        options: ['Two minutes away', 'Five minutes away', 'Ten minutes away', 'On the third floor'],
        answer: 'Two minutes away',
      },
      {
        prompt: 'What must the student send before Friday evening?',
        options: ['An ID copy', 'A rent receipt', 'An electricity bill', 'A kitchen key'],
        answer: 'An ID copy',
      },
    ],
  },
  {
    id: 'workplace-training',
    title: 'Workplace Training Announcement',
    section: 'Section 4',
    script:
      'Manager: Next week, all new staff will attend a short training session on customer communication. The aim is not to memorize fixed sentences, but to listen for the customer problem and choose a suitable response. On Monday, we will practise greeting callers. On Wednesday, we will review difficult complaints. Please complete the online form before Tuesday noon, so the trainer can prepare examples from your department. Staff who work evening shifts can watch the recording, but they must still submit the practice task by Friday.',
    questions: [
      {
        prompt: 'What is the main aim of the training?',
        options: ['To choose suitable responses to customer problems', 'To memorize fixed sentences', 'To change evening shifts', 'To prepare a sales report'],
        answer: 'To choose suitable responses to customer problems',
      },
      {
        prompt: 'When will difficult complaints be reviewed?',
        options: ['Wednesday', 'Monday', 'Tuesday noon', 'Friday'],
        answer: 'Wednesday',
      },
      {
        prompt: 'What must evening shift staff do by Friday?',
        options: ['Submit the practice task', 'Attend the live Monday session', 'Call every customer again', 'Prepare examples for the trainer'],
        answer: 'Submit the practice task',
      },
    ],
  },
];

const scoreAnswers = (set, answers) =>
  set.questions.reduce((score, question, index) => score + (answers[index] === question.answer ? 1 : 0), 0);

export default function ListeningReferenceTask({ level, onBack }) {
  const [selectedSetId, setSelectedSetId] = useState(listeningSets[0].id);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [error, setError] = useState('');
  const [ttsSpeaker, setTtsSpeaker] = useTtsSpeaker();
  const audioRef = useRef(null);

  const selectedSet = useMemo(
    () => listeningSets.find((set) => set.id === selectedSetId) || listeningSets[0],
    [selectedSetId],
  );
  const score = scoreAnswers(selectedSet, answers);

  const stopAudio = () => {
    stopTtsAudio(audioRef.current);
    audioRef.current = null;
    setAudioPlaying(false);
  };

  const playAudio = async () => {
    if (audioPlaying) {
      stopAudio();
      return;
    }

    try {
      setError('');
      setAudioPlaying(true);
      const audio = await playTtsAudio({
        text: selectedSet.script,
        speaker: ttsSpeaker,
        level,
        context: 'listening',
        onPlay: (audioElement) => {
          audioRef.current = audioElement;
          setAudioPlaying(true);
        },
        onEnded: () => {
          audioRef.current = null;
          setAudioPlaying(false);
        },
        onError: () => {
          audioRef.current = null;
          setAudioPlaying(false);
          setError('Unable to play listening audio.');
        },
      });
      audioRef.current = audio;
    } catch (err) {
      setError(await getTtsApiErrorMessage(err, 'Unable to play listening audio.'));
      setAudioPlaying(false);
    }
  };

  const chooseSet = (setId) => {
    stopAudio();
    setSelectedSetId(setId);
    setAnswers({});
    setSubmitted(false);
    setError('');
  };

  return (
    <div className="listening-reference-task">
      <div className="practice-header">
        <div className="practice-header-left">
          <button type="button" className="practice-back-btn" onClick={() => { stopAudio(); onBack(); }}>
            ← Back
          </button>
          <div>
            <h2>IELTS-style Listening</h2>
            <p>Original practice sets inspired by standard listening-test formats</p>
          </div>
        </div>
        <TtsVoiceSelector value={ttsSpeaker} onChange={setTtsSpeaker} />
      </div>

      <div className="listening-reference-layout">
        <div className="listening-set-list">
          {listeningSets.map((set) => (
            <button
              key={set.id}
              type="button"
              className={set.id === selectedSet.id ? 'active' : ''}
              onClick={() => chooseSet(set.id)}
            >
              <span>{set.section}</span>
              <strong>{set.title}</strong>
            </button>
          ))}
        </div>

        <div className="listening-reference-panel">
          <div className="listening-reference-head">
            <div>
              <span className="journey-kicker">{selectedSet.section}</span>
              <h3>{selectedSet.title}</h3>
            </div>
            <button type="button" className="audio-btn" onClick={playAudio}>
              {audioPlaying ? 'Stop audio' : 'Play audio'}
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          <div className="listening-reference-questions">
            {selectedSet.questions.map((question, index) => (
              <div key={question.prompt} className="listening-reference-question">
                <strong>{index + 1}. {question.prompt}</strong>
                <div className="options-list">
                  {question.options.map((option) => {
                    const selected = answers[index] === option;
                    const correct = submitted && option === question.answer;
                    const wrong = submitted && selected && option !== question.answer;
                    return (
                      <button
                        key={option}
                        type="button"
                        className={`option-btn ${selected ? 'selected' : ''} ${correct ? 'correct' : ''} ${wrong ? 'incorrect' : ''}`}
                        onClick={() => setAnswers((current) => ({ ...current, [index]: option }))}
                        disabled={submitted}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="question-actions">
            <button type="button" className="btn-secondary" onClick={() => { setAnswers({}); setSubmitted(false); }}>
              Reset
            </button>
            <button type="button" className="btn-primary" onClick={() => setSubmitted(true)}>
              Check answers
            </button>
          </div>

          {submitted && (
            <div className="listening-reference-result">
              <strong>Score: {score}/{selectedSet.questions.length}</strong>
              <p>{selectedSet.script}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
