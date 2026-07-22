import React, { useMemo, useState } from 'react';

const PRACTICE_CONTENT = {
  sde: {
    title: 'SDE Practice Mode',
    description: 'Warm up with coding, SQL, debugging, and complexity prompts before the live interview.',
    sqlPrompt: 'Write a SQL query to find the second highest salary in each department.',
    sqlStarter: 'SELECT department_id, salary\nFROM employees\n-- continue here',
    codingPrompt: 'Given an array of integers, return the indices of two numbers that add up to a target.',
    codingStarter: 'function twoSum(nums, target) {\n  // write your approach\n}',
    debuggingScenario: 'A Node.js API intermittently returns HTTP 500 during peak traffic. List the first checks you would perform and what logs/metrics you would inspect.',
    complexityQuestion: 'Explain the time and space complexity of your coding approach, then mention one optimization or trade-off.',
  },
  data_analyst: {
    title: 'Data Analyst Practice Mode',
    description: 'Warm up with SQL, analytical reasoning, debugging data quality issues, and complexity thinking.',
    sqlPrompt: 'Write a SQL query to calculate monthly active users and month-over-month growth.',
    sqlStarter: 'SELECT DATE_TRUNC(month, event_date) AS month,\n       COUNT(DISTINCT user_id) AS active_users\nFROM events\n-- continue here',
    codingPrompt: 'Given a list of transaction records, outline how you would find duplicate transactions and summarize them by customer.',
    codingStarter: 'def find_duplicate_transactions(transactions):\n    # write your approach\n    pass',
    debuggingScenario: 'A dashboard suddenly shows a 40% drop in conversions. Explain how you would debug whether this is a real business change or a data issue.',
    complexityQuestion: 'Explain the time and space complexity of your duplicate-detection approach, and how it changes for millions of rows.',
  },
};

const TABS = [
  { key: 'sql', label: 'SQL' },
  { key: 'coding', label: 'Coding' },
  { key: 'debugging', label: 'Debugging' },
  { key: 'complexity', label: 'Complexity' },
];

const fieldForTab = {
  sql: 'sqlAnswer',
  coding: 'codingAnswer',
  debugging: 'debuggingAnswer',
  complexity: 'complexityAnswer',
};

export const supportsPracticeMode = (mode) => Boolean(PRACTICE_CONTENT[mode]);

function PracticeModePanel({ interviewMode, roleDomain }) {
  const content = PRACTICE_CONTENT[interviewMode];
  const [activeTab, setActiveTab] = useState('sql');
  const [answers, setAnswers] = useState({
    sqlAnswer: content?.sqlStarter || '',
    codingAnswer: content?.codingStarter || '',
    debuggingAnswer: '',
    complexityAnswer: '',
  });

  const completedCount = useMemo(
    () => Object.values(answers).filter(value => value.trim().length > 20).length,
    [answers],
  );

  if (!content) return null;

  const updateAnswer = (key, value) => setAnswers(prev => ({ ...prev, [key]: value }));
  const currentField = fieldForTab[activeTab];
  const prompt =
    activeTab === 'sql'
      ? content.sqlPrompt
      : activeTab === 'coding'
      ? content.codingPrompt
      : activeTab === 'debugging'
      ? content.debuggingScenario
      : content.complexityQuestion;

  return (
    <section className="iv-practice-panel" aria-label="Practice Mode">
      <div className="iv-practice-head">
        <div>
          <span className="iv-section-kicker">Practice Mode</span>
          <h3>{content.title}</h3>
          <p>{content.description}</p>
        </div>
        <strong>{completedCount}/4 drafted</strong>
      </div>

      <div className="iv-practice-tabs" role="tablist" aria-label={`${roleDomain || content.title} practice prompts`}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`iv-practice-tab${activeTab === tab.key ? ' iv-practice-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="iv-practice-workspace">
        <div className="iv-practice-prompt">
          <span>{TABS.find(tab => tab.key === activeTab)?.label}</span>
          <p>{prompt}</p>
        </div>
        <textarea
          className={`iv-input iv-textarea iv-practice-editor${activeTab === 'sql' || activeTab === 'coding' ? ' iv-practice-editor--code' : ''}`}
          value={answers[currentField]}
          onChange={event => updateAnswer(currentField, event.target.value)}
          rows={8}
          spellCheck={activeTab !== 'sql' && activeTab !== 'coding'}
        />
      </div>
    </section>
  );
}

export default PracticeModePanel;
