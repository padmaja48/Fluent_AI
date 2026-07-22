import React from 'react';

const LANGUAGE_OPTIONS = [
  { id: 'python', label: 'Python', starter: 'def solve():\n    # write your approach\n    pass\n' },
  { id: 'javascript', label: 'JavaScript', starter: 'function solve() {\n  // write your approach\n}\n' },
  { id: 'java', label: 'Java', starter: 'class Solution {\n    public void solve() {\n        // write your approach\n    }\n}\n' },
  { id: 'cpp', label: 'C++', starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // write your approach\n    return 0;\n}\n' },
  { id: 'sql', label: 'SQL', starter: 'SELECT *\nFROM table_name\n-- continue here\n' },
];

export const detectMentionedLanguage = (text = '') => {
  const lower = String(text).toLowerCase();
  const patterns = [
    ['python', /\bpython\b|\bpy\b/],
    ['javascript', /\bjavascript\b|\bjs\b|\bnode(?:\.js)?\b/],
    ['java', /\bjava\b(?!script)/],
    ['cpp', /\bc\+\+\b|\bcpp\b/],
    ['sql', /\bsql\b|\bmysql\b|\bpostgres/],
  ];

  if (/\b(i know|i'm good at|proficient in|experienced in|comfortable with|worked with|using)\b/.test(lower)) {
    const match = patterns.find(([, pattern]) => pattern.test(lower));
    if (match) return match[0];
  }

  return patterns.find(([, pattern]) => pattern.test(lower))?.[0];
};

export const isCodingQuestion = (question) => {
  if (!question?.question) return false;
  const text = question.question.toLowerCase();
  return (
    question.difficulty === 'problem-solving' ||
    /implement|write a function|write code|coding|algorithm|time complexity|space complexity|data structure|leetcode|pseudocode|sql query|array|linked list|binary tree|hash map|dynamic programming/.test(text)
  );
};

export const languageStarter = (languageId) =>
  LANGUAGE_OPTIONS.find(option => option.id === languageId)?.starter || LANGUAGE_OPTIONS[0].starter;

function LiveCodingPanel({ language, onLanguageChange, value, onChange, prompt }) {
  return (
    <section className="iv-live-coding" aria-label="Coding workspace">
      <div className="iv-live-coding-head">
        <div>
          <span className="iv-section-kicker">Coding workspace</span>
          <h3>Write your solution here</h3>
        </div>
        <label className="iv-live-coding-lang">
          <span>Language</span>
          <select value={language} onChange={event => onLanguageChange(event.target.value)}>
            {LANGUAGE_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      {prompt && <p className="iv-live-coding-prompt">{prompt}</p>}
      <textarea
        className="iv-input iv-textarea iv-practice-editor iv-practice-editor--code"
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={12}
        spellCheck={false}
        placeholder="Write code or pseudocode for your answer..."
      />
    </section>
  );
}

export default LiveCodingPanel;
