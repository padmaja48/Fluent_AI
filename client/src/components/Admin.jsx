import React, { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { questionAPI, testAPI, adminAPI } from '../services/api';
import '../styles/Admin.css';

const SKILLS = ['Listening', 'Speaking', 'Reading', 'Writing'];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const TYPES = ['MCQ', 'T-F-NG', 'Task', 'Essay'];
const STATUSES = ['Draft', 'Active', 'Archived'];

const CSV_TEMPLATE =
  'stem,skill,level,type,option_a,option_b,option_c,option_d,correct_option,correctAnswer,explanation,passageText,audioPrompt,topic,competency,journeyOrder,moduleOrder,moduleQuestionOrder\n';

function parseCSVToQuestions(rows) {
  return rows.map((r) => ({
    stem: r.stem || '',
    skill: r.skill || 'Reading',
    level: r.level || 'A1',
    type: r.type || 'MCQ',
    options: ['a', 'b', 'c', 'd']
      .filter((k) => r[`option_${k}`])
      .map((k) => ({ text: r[`option_${k}`], isCorrect: r.correct_option === k })),
    correctAnswer: r.correctAnswer || '',
    explanation: r.explanation || '',
    passageText: r.passageText || '',
    audioPrompt: r.audioPrompt || '',
    topic: r.topic || '',
    competency: r.competency || '',
    journeyOrder: Number(r.journeyOrder) || 0,
    moduleOrder: Number(r.moduleOrder) || 0,
    moduleQuestionOrder: Number(r.moduleQuestionOrder) || 0,
    status: 'Active',
  }));
}

const emptyQuestion = () => ({
  stem: '', skill: 'Reading', level: 'A1', type: 'MCQ',
  options: [
    { text: '', isCorrect: true }, { text: '', isCorrect: false },
    { text: '', isCorrect: false }, { text: '', isCorrect: false },
  ],
  correctAnswer: '', explanation: '', audioUrl: '', audioPrompt: '',
  passageText: '', topic: '', competency: '',
  journeyOrder: 0, moduleOrder: 0, moduleQuestionOrder: 0, status: 'Active',
});

/* ── Flash helper ─────────────────────────────────────────── */
function Flash({ msg }) {
  if (!msg) return null;
  const isErr = msg.startsWith('❌');
  return (
    <div className={`adm-flash ${isErr ? 'adm-flash--error' : 'adm-flash--success'}`}>
      {msg}
    </div>
  );
}

/* ── Stats row ────────────────────────────────────────────── */
function StatsRow({ totalQuestions, users, tests }) {
  return (
    <div className="adm-stats">
      <div className="adm-stat-card">
        <span className="adm-stat-label">Total Questions</span>
        <span className="adm-stat-value">{totalQuestions.toLocaleString()}</span>
        <span className="adm-stat-sub">across all skills &amp; levels</span>
      </div>
      <div className="adm-stat-card">
        <span className="adm-stat-label">Students</span>
        <span className="adm-stat-value">{users.length}</span>
        <span className="adm-stat-sub">registered learners</span>
      </div>
      <div className="adm-stat-card">
        <span className="adm-stat-label">Tests</span>
        <span className="adm-stat-value">{tests.length}</span>
        <span className="adm-stat-sub">{tests.filter(t => t.isActive).length} active</span>
      </div>
      <div className="adm-stat-card">
        <span className="adm-stat-label">Skills</span>
        <span className="adm-stat-value">4</span>
        <span className="adm-stat-sub">Listening · Speaking · Reading · Writing</span>
      </div>
    </div>
  );
}

/* ── Questions Tab ────────────────────────────────────────── */
function QuestionsTab({ onQuestionsLoaded }) {
  const [questions, setQuestions] = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const PAGE_SIZE = 50;

  const [filters, setFilters] = useState({ skill: '', level: '', type: '', status: '' });
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyQuestion());
  const [audioFile, setAudioFile] = useState(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = { page: targetPage, limit: PAGE_SIZE };
      if (filters.skill)  params.skill  = filters.skill;
      if (filters.level)  params.level  = filters.level;
      if (filters.type)   params.type   = filters.type;
      if (filters.status) params.status = filters.status;
      const res = await questionAPI.getQuestions(
        params.skill  || undefined,
        params.level  || undefined,
        params,
      );
      // Support both paginated { questions, total, pages } and plain array responses
      const data   = Array.isArray(res.data) ? res.data          : (res.data?.questions || []);
      const tot    = Array.isArray(res.data) ? res.data.length   : (res.data?.total     || data.length);
      const pgs    = Array.isArray(res.data) ? 1                 : (res.data?.pages     || 1);
      setQuestions(data);
      setTotal(tot);
      setPage(targetPage);
      setPages(pgs);
      onQuestionsLoaded?.(data, tot);
    } catch { setQuestions([]); setTotal(0); }
    setLoading(false);
  }, [filters, onQuestionsLoaded]);

  // Reset to page 1 when filters change
  useEffect(() => { load(1); }, [load]);

  const openNew  = () => { setEditing(null); setForm(emptyQuestion()); setDrawerOpen(true); };
  const openEdit = (q) => { setEditing(q); setForm({ ...emptyQuestion(), ...q }); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); setAudioFile(null); };

  const setField  = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setOption = (i, k, v) => setForm(prev => ({
    ...prev,
    options: prev.options.map((o, idx) => idx === i ? { ...o, [k]: v } : o),
  }));
  const addOption    = () => setForm(prev => ({ ...prev, options: [...prev.options, { text: '', isCorrect: false }] }));
  const removeOption = (i) => setForm(prev => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }));

  const handleAudioUpload = async () => {
    if (!audioFile) return;
    setUploadingAudio(true);
    try {
      const fd = new FormData();
      fd.append('audio', audioFile);
      const res = await questionAPI.uploadAudio(fd);
      setField('audioUrl', res.data.audioUrl);
      flash('Audio uploaded');
    } catch { flash('Audio upload failed', true); }
    setUploadingAudio(false);
  };

  const flash = (text, err = false) => {
    setMsg(err ? `❌ ${text}` : `✓ ${text}`);
    setTimeout(() => setMsg(''), 3500);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await questionAPI.updateQuestion(editing._id, form);
        flash('Question updated');
      } else {
        await questionAPI.createQuestion(form);
        flash('Question created');
      }
      closeDrawer();
      load(page);
    } catch (e) { flash(e.response?.data?.message || 'Save failed', true); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await questionAPI.deleteQuestion(id);
      setDeleteTarget(null);
      flash('Question deleted');
      load(page);
    } catch { flash('Delete failed', true); }
  };

  return (
    <div className="adm-tab-content">
      <Flash msg={msg} />

      <div className="adm-card">
        {/* Filter bar */}
        <div className="adm-filters">
          <span className="adm-filters-label">Filter:</span>
          {[
            ['skill',  ['', ...SKILLS],   'All Skills'],
            ['level',  ['', ...LEVELS],   'All Levels'],
            ['type',   ['', ...TYPES],    'All Types'],
            ['status', ['', ...STATUSES], 'All Status'],
          ].map(([key, opts, placeholder]) => (
            <select
              key={key}
              className="adm-select"
              value={filters[key]}
              onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
            >
              <option value="">{placeholder}</option>
              {opts.filter(o => o).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          <span className="adm-filters-count">
            {total.toLocaleString()} question{total !== 1 ? 's' : ''}
          </span>
          <div style={{ marginLeft: 'auto' }}>
            <button className="adm-btn adm-btn--primary" onClick={openNew}>
              + Add Question
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="adm-card-body">
          {loading ? (
            <p className="adm-loading">⟳ Loading questions…</p>
          ) : (
            <>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Skill</th>
                      <th>Level</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.length === 0 && (
                      <tr><td colSpan={6} className="adm-empty">
                        No questions found. Try changing filters or add a new question.
                      </td></tr>
                    )}
                    {questions.map((q) => (
                      <tr key={q._id}>
                        <td className="adm-stem">{q.stem?.slice(0, 65)}{q.stem?.length > 65 ? '…' : ''}</td>
                        <td>{q.skill}</td>
                        <td>{q.level}</td>
                        <td>{q.type}</td>
                        <td>
                          <span className={`adm-badge adm-badge--${q.status?.toLowerCase()}`}>
                            {q.status}
                          </span>
                        </td>
                        <td className="adm-actions">
                          <button className="adm-btn adm-btn--sm" onClick={() => openEdit(q)}>Edit</button>
                          <button className="adm-btn adm-btn--sm adm-btn--danger" onClick={() => setDeleteTarget(q)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className="adm-pagination">
                  <span className="adm-pagination-info">
                    Page {page} of {pages} &nbsp;·&nbsp; {total.toLocaleString()} total
                  </span>
                  <div className="adm-pagination-btns">
                    <button className="adm-btn adm-btn--sm" disabled={page <= 1}
                      onClick={() => load(1)}>«</button>
                    <button className="adm-btn adm-btn--sm" disabled={page <= 1}
                      onClick={() => load(page - 1)}>‹ Prev</button>
                    {/* Page number pills */}
                    {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                      const start = Math.max(1, Math.min(page - 2, pages - 4));
                      const p = start + i;
                      return (
                        <button key={p}
                          className={`adm-btn adm-btn--sm ${p === page ? 'adm-btn--primary' : ''}`}
                          onClick={() => load(p)}>{p}</button>
                      );
                    })}
                    <button className="adm-btn adm-btn--sm" disabled={page >= pages}
                      onClick={() => load(page + 1)}>Next ›</button>
                    <button className="adm-btn adm-btn--sm" disabled={page >= pages}
                      onClick={() => load(pages)}>»</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="adm-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="adm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Delete Question?</h3>
            <p>"{deleteTarget.stem?.slice(0, 80)}"<br />This action cannot be undone.</p>
            <div className="adm-dialog-actions">
              <button className="adm-btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="adm-btn adm-btn--danger" onClick={() => handleDelete(deleteTarget._id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <div className="adm-overlay" onClick={closeDrawer}>
          <div className="adm-drawer" onClick={e => e.stopPropagation()}>
            <div className="adm-drawer-header">
              <h3>{editing ? 'Edit Question' : 'New Question'}</h3>
              <button className="adm-close" onClick={closeDrawer}>✕</button>
            </div>
            <div className="adm-drawer-body">
              <div>
                <label className="adm-label">Question / Stem</label>
                <textarea className="adm-textarea" value={form.stem}
                  onChange={e => setField('stem', e.target.value)} rows={3}
                  placeholder="Enter the question text…" />
              </div>

              <div className="adm-row">
                {[
                  ['skill',  SKILLS,   'Skill'],
                  ['level',  LEVELS,   'Level'],
                  ['type',   TYPES,    'Type'],
                  ['status', STATUSES, 'Status'],
                ].map(([k, opts, label]) => (
                  <div key={k}>
                    <label className="adm-label">{label}</label>
                    <select className="adm-select" value={form[k]}
                      onChange={e => setField(k, e.target.value)}>
                      {opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {['MCQ', 'T-F-NG'].includes(form.type) && (
                <div>
                  <label className="adm-label">Answer Options (select correct)</label>
                  {form.options.map((opt, i) => (
                    <div key={i} className="adm-option-row">
                      <input
                        type="radio"
                        name="correct"
                        checked={opt.isCorrect}
                        onChange={() => setForm(prev => ({
                          ...prev,
                          options: prev.options.map((o, idx) => ({ ...o, isCorrect: idx === i })),
                        }))}
                      />
                      <input className="adm-input" value={opt.text}
                        onChange={e => setOption(i, 'text', e.target.value)}
                        placeholder={`Option ${i + 1}`} />
                      <button className="adm-btn adm-btn--sm adm-btn--danger"
                        onClick={() => removeOption(i)}>✕</button>
                    </div>
                  ))}
                  <button className="adm-btn adm-btn--sm adm-btn--ghost" style={{ marginTop: 4 }}
                    onClick={addOption}>+ Add option</button>
                </div>
              )}

              <div>
                <label className="adm-label">Correct Answer (text)</label>
                <input className="adm-input" value={form.correctAnswer}
                  onChange={e => setField('correctAnswer', e.target.value)}
                  placeholder="The correct answer text" />
              </div>

              <div>
                <label className="adm-label">Explanation</label>
                <textarea className="adm-textarea" value={form.explanation}
                  onChange={e => setField('explanation', e.target.value)} rows={2}
                  placeholder="Why is this the correct answer?" />
              </div>

              <div>
                <label className="adm-label">Audio File (Listening)</label>
                <div className="adm-audio-row">
                  <input type="file" accept="audio/*"
                    onChange={e => setAudioFile(e.target.files[0])} />
                  <button className="adm-btn adm-btn--sm" onClick={handleAudioUpload}
                    disabled={!audioFile || uploadingAudio}>
                    {uploadingAudio ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
                {form.audioUrl && (
                  <p className="adm-audio-url">✓ Audio: <a href={form.audioUrl} target="_blank" rel="noreferrer">Preview</a></p>
                )}
              </div>

              <div>
                <label className="adm-label">Passage Text (Reading)</label>
                <textarea className="adm-textarea" value={form.passageText}
                  onChange={e => setField('passageText', e.target.value)} rows={4}
                  placeholder="Paste the reading passage here…" />
              </div>

              <div>
                <label className="adm-label">Audio Prompt (Speaking / Writing)</label>
                <input className="adm-input" value={form.audioPrompt}
                  onChange={e => setField('audioPrompt', e.target.value)}
                  placeholder="Prompt shown to the student" />
              </div>

              <div className="adm-row">
                <div>
                  <label className="adm-label">Topic</label>
                  <input className="adm-input" value={form.topic}
                    onChange={e => setField('topic', e.target.value)} />
                </div>
                <div>
                  <label className="adm-label">Competency</label>
                  <input className="adm-input" value={form.competency}
                    onChange={e => setField('competency', e.target.value)} />
                </div>
              </div>

              <div className="adm-row">
                {[['journeyOrder', 'Journey Order'], ['moduleOrder', 'Module Order'], ['moduleQuestionOrder', 'Q Order']].map(([k, label]) => (
                  <div key={k}>
                    <label className="adm-label">{label}</label>
                    <input className="adm-input" type="number" value={form[k]}
                      onChange={e => setField(k, Number(e.target.value))} />
                  </div>
                ))}
              </div>
            </div>
            <div className="adm-drawer-footer">
              <button className="adm-btn" onClick={closeDrawer}>Cancel</button>
              <button className="adm-btn adm-btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Update Question' : 'Create Question'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Bulk Upload Tab ──────────────────────────────────────── */
function BulkTab() {
  const [csvFile, setCsvFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleCSV = (file) => {
    if (!file) return;
    setCsvFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setPreview(parseCSVToQuestions(res.data).slice(0, 5)),
    });
  };

  const handleInsert = async () => {
    if (!csvFile) return;
    setBusy(true);
    try {
      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (res) => {
          try {
            const questions = parseCSVToQuestions(res.data);
            const r = await questionAPI.bulkInsert(questions);
            setResult(r.data);
          } catch (e) {
            setResult({ error: e.message });
          }
          setBusy(false);
        },
      });
    } catch (e) {
      setResult({ error: e.message });
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'questions_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="adm-tab-content">
      <div className="adm-card" style={{ padding: '20px 24px' }}>
        <div className="adm-bulk-header">
          <div>
            <h3>Bulk Question Upload</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Upload a CSV file to add multiple questions at once.
            </p>
          </div>
          <button className="adm-btn adm-btn--ghost" onClick={downloadTemplate}>
            ⬇ Download Template
          </button>
        </div>
      </div>

      <div
        className="adm-drop-zone"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleCSV(e.dataTransfer.files[0]); }}
        onClick={() => document.getElementById('bulk-csv').click()}
      >
        {csvFile ? (
          <span className="adm-drop-ok">✓ {csvFile.name} — {preview.length}+ rows parsed</span>
        ) : (
          <>
            <span className="adm-drop-icon">📂</span>
            <strong>Drag & drop CSV here</strong>
            <span style={{ fontSize: 12 }}>or click to browse files</span>
          </>
        )}
        <input id="bulk-csv" type="file" accept=".csv" style={{ display: 'none' }}
          onChange={e => handleCSV(e.target.files[0])} />
      </div>

      {preview.length > 0 && (
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title">Preview (first {preview.length} rows)</h3>
            <button className="adm-btn adm-btn--primary" onClick={handleInsert} disabled={busy}>
              {busy ? 'Uploading…' : `Insert All Questions`}
            </button>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Stem</th><th>Skill</th><th>Level</th><th>Type</th></tr></thead>
              <tbody>
                {preview.map((q, i) => (
                  <tr key={i}>
                    <td>{q.stem?.slice(0, 70)}</td>
                    <td>{q.skill}</td>
                    <td>{q.level}</td>
                    <td>{q.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="adm-bulk-result">
          {result.error ? (
            <p className="adm-error">❌ {result.error}</p>
          ) : (
            <p>✓ Inserted: <strong>{result.inserted}</strong> questions · Errors: <strong>{result.errors?.length ?? 0}</strong></p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Tests Tab ───────────────────────────────────────────── */
function TestsTab({ onTestsLoaded }) {
  const [tests, setTests] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', level: 'B1', durationMinutes: 60, sections: [], isActive: true });
  const [editingTest, setEditingTest] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const flash = (t, err = false) => { setMsg(err ? `❌ ${t}` : `✓ ${t}`); setTimeout(() => setMsg(''), 3500); };

  const load = async () => {
    setLoading(true);
    try {
      const [tr, qr] = await Promise.all([
        testAPI.list(),
        questionAPI.getQuestions(undefined, undefined, { status: 'Active' }),
      ]);
      const tData = Array.isArray(tr.data) ? tr.data : [];
      const qData = Array.isArray(qr.data) ? qr.data : [];
      setTests(tData);
      setQuestions(qData);
      onTestsLoaded?.(tData);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addSection    = (skill) => { if (form.sections.find(s => s.skill === skill)) return; setForm(prev => ({ ...prev, sections: [...prev.sections, { skill, questionIds: [] }] })); };
  const removeSection = (skill) => setForm(prev => ({ ...prev, sections: prev.sections.filter(s => s.skill !== skill) }));
  const toggleQuestion = (skill, qid) => setForm(prev => ({
    ...prev,
    sections: prev.sections.map(s =>
      s.skill !== skill ? s : {
        ...s,
        questionIds: s.questionIds.includes(qid)
          ? s.questionIds.filter(id => id !== qid)
          : [...s.questionIds, qid],
      }
    ),
  }));

  const openNew = () => { setEditingTest(null); setForm({ title: '', description: '', level: 'B1', durationMinutes: 60, sections: [], isActive: true }); setShowForm(true); };
  const openEdit = (t) => {
    setEditingTest(t);
    setForm({ title: t.title, description: t.description || '', level: t.level, durationMinutes: t.durationMinutes, sections: t.sections.map(s => ({ ...s, questionIds: s.questionIds.map(id => id?.toString ? id.toString() : id) })), isActive: t.isActive });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingTest) { await testAPI.update(editingTest._id, form); flash('Test updated'); }
      else { await testAPI.create(form); flash('Test created'); }
      setShowForm(false);
      load();
    } catch (e) { flash(e.response?.data?.message || 'Save failed', true); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try { await testAPI.delete(id); flash('Test deleted'); load(); }
    catch { flash('Delete failed', true); }
  };

  const skillQuestions = (skill) => questions.filter(q => q.skill === skill && q.level === form.level);

  return (
    <div className="adm-tab-content">
      <Flash msg={msg} />

      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title">Test Builder</h3>
          <button className="adm-btn adm-btn--primary" onClick={openNew}>+ New Test</button>
        </div>

        <div className="adm-card-body">
          {loading ? <p className="adm-loading">⟳ Loading tests…</p> : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr><th>Title</th><th>Level</th><th>Duration</th><th>Sections</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {tests.length === 0 && <tr><td colSpan={6} className="adm-empty">No tests yet. Create your first test.</td></tr>}
                  {tests.map(t => (
                    <tr key={t._id}>
                      <td><strong style={{ color: 'var(--text)' }}>{t.title}</strong></td>
                      <td>{t.level}</td>
                      <td>{t.durationMinutes} min</td>
                      <td>{t.sections?.map(s => s.skill).join(', ') || '—'}</td>
                      <td><span className={`adm-badge adm-badge--${t.isActive ? 'active' : 'inactive'}`}>{t.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td className="adm-actions">
                        <button className="adm-btn adm-btn--sm" onClick={() => openEdit(t)}>Edit</button>
                        <button className="adm-btn adm-btn--sm adm-btn--danger" onClick={() => handleDelete(t._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="adm-overlay" onClick={() => setShowForm(false)}>
          <div className="adm-drawer adm-drawer--wide" onClick={e => e.stopPropagation()}>
            <div className="adm-drawer-header">
              <h3>{editingTest ? 'Edit Test' : 'New Test'}</h3>
              <button className="adm-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="adm-drawer-body">
              <div>
                <label className="adm-label">Title</label>
                <input className="adm-input" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. B1 Placement Test" />
              </div>
              <div>
                <label className="adm-label">Description</label>
                <input className="adm-input" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="adm-row">
                <div>
                  <label className="adm-label">Level</label>
                  <select className="adm-select" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>
                    {LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="adm-label">Duration (min)</label>
                  <input className="adm-input" type="number" value={form.durationMinutes}
                    onChange={e => setForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))} />
                </div>
                <div style={{ justifyContent: 'center', alignItems: 'center', display: 'flex', gap: 8, paddingTop: 20 }}>
                  <input type="checkbox" checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
                  <label className="adm-label" style={{ margin: 0, textTransform: 'none', fontSize: 13 }}>Active</label>
                </div>
              </div>

              <div>
                <label className="adm-label">Sections</label>
                <div className="adm-section-toggles">
                  {SKILLS.map(skill => (
                    <button key={skill}
                      className={`adm-btn adm-btn--sm ${form.sections.find(s => s.skill === skill) ? 'adm-btn--primary' : ''}`}
                      onClick={() => form.sections.find(s => s.skill === skill) ? removeSection(skill) : addSection(skill)}>
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              {form.sections.map(section => (
                <div key={section.skill} className="adm-test-section">
                  <h4 className="adm-section-title">{section.skill} Questions ({section.questionIds.length} selected)</h4>
                  <div className="adm-q-picker">
                    {skillQuestions(section.skill).length === 0 && (
                      <p className="adm-empty" style={{ padding: '8px 0', fontSize: 12 }}>
                        No {section.skill} questions at {form.level}. Add questions first.
                      </p>
                    )}
                    {skillQuestions(section.skill).map(q => {
                      const qid = q._id?.toString ? q._id.toString() : q._id;
                      const checked = section.questionIds.includes(qid);
                      return (
                        <label key={qid} className={`adm-q-pick-item ${checked ? 'adm-q-pick-item--selected' : ''}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleQuestion(section.skill, qid)} />
                          {q.stem?.slice(0, 80)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="adm-drawer-footer">
              <button className="adm-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="adm-btn adm-btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingTest ? 'Update Test' : 'Create Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Students Tab ────────────────────────────────────────── */
function StudentsTab({ onUsersLoaded }) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [anaLoading, setAnaLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    adminAPI.getAllUsers()
      .then(r => {
        const data = Array.isArray(r.data) ? r.data : [];
        setUsers(data);
        onUsersLoaded?.(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const viewAnalytics = async (user) => {
    setSelected(user);
    setAnalytics(null);
    setAnaLoading(true);
    try {
      const r = await adminAPI.getUserAnalytics(user._id);
      setAnalytics(r.data);
    } catch {}
    setAnaLoading(false);
  };

  const filtered = users.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const ScoreBar = ({ score }) => (
    <div className="adm-skill-bar-wrap">
      <div className="adm-skill-bar-track">
        <div className="adm-skill-bar" style={{ width: `${Math.min(100, score || 0)}%` }} />
      </div>
      <span>{Math.round(score || 0)}%</span>
    </div>
  );

  return (
    <div className="adm-tab-content">
      {loading ? <p className="adm-loading">⟳ Loading students…</p> : (
        <div className="adm-students-layout">
          <div className="adm-students-list">
            <div className="adm-card">
              <div className="adm-card-header">
                <h3 className="adm-card-title">Students ({filtered.length})</h3>
                <input
                  className="adm-input"
                  style={{ width: 200 }}
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Level</th><th></th></tr></thead>
                  <tbody>
                    {filtered.length === 0 && <tr><td colSpan={4} className="adm-empty">No students found.</td></tr>}
                    {filtered.map(u => (
                      <tr key={u._id} className={selected?._id === u._id ? 'adm-row--selected' : ''}>
                        <td><strong style={{ color: 'var(--text)' }}>{u.name}</strong></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{u.email}</td>
                        <td>{u.level || '—'}</td>
                        <td>
                          <button className="adm-btn adm-btn--sm" onClick={() => viewAnalytics(u)}>
                            View Progress
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {selected && (
            <div className="adm-analytics-panel">
              <h4>📊 {selected.name}'s Progress</h4>
              {anaLoading && <p className="adm-loading">⟳ Loading analytics…</p>}
              {analytics && (
                <>
                  <section>
                    <h5>Skill Scores (last 30 days)</h5>
                    {analytics.skillTrend?.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No practice data yet.</p>}
                    {(analytics.skillTrend || []).map(s => (
                      <div key={s._id} className="adm-skill-row">
                        <span className="adm-skill-name">{s._id}</span>
                        <ScoreBar score={s.avgScore} />
                        <span className="adm-skill-sessions">{s.sessions} sessions</span>
                      </div>
                    ))}
                  </section>

                  <section>
                    <h5>Recent Practice Sessions</h5>
                    <table className="adm-table">
                      <thead><tr><th>Date</th><th>Skill</th><th>Level</th><th>Score</th></tr></thead>
                      <tbody>
                        {(analytics.recentSessions || []).slice(0, 8).map(s => (
                          <tr key={s._id}>
                            <td>{new Date(s.updatedAt || s.createdAt).toLocaleDateString()}</td>
                            <td>{s.skill}</td>
                            <td>{s.level}</td>
                            <td>{Math.round(s.averageScore || 0)}%</td>
                          </tr>
                        ))}
                        {!analytics.recentSessions?.length && <tr><td colSpan={4} className="adm-empty" style={{ padding: '12px 0' }}>No sessions yet.</td></tr>}
                      </tbody>
                    </table>
                  </section>

                  <section>
                    <h5>Interview History</h5>
                    <table className="adm-table">
                      <thead><tr><th>Date</th><th>Domain</th><th>Score</th></tr></thead>
                      <tbody>
                        {(analytics.interviewHistory || []).slice(0, 8).map(iv => (
                          <tr key={iv._id}>
                            <td>{new Date(iv.createdAt).toLocaleDateString()}</td>
                            <td>{iv.roleDomain}</td>
                            <td>{Math.round(iv.totalScore || 0)}%</td>
                          </tr>
                        ))}
                        {!analytics.interviewHistory?.length && <tr><td colSpan={3} className="adm-empty" style={{ padding: '12px 0' }}>No interviews yet.</td></tr>}
                      </tbody>
                    </table>
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Admin Component ────────────────────────────────── */
const TABS = ['Questions', 'Bulk Upload', 'Tests', 'Students'];

export const Admin = () => {
  const [activeTab, setActiveTab]       = useState('Questions');
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [allUsers, setAllUsers]         = useState([]);
  const [allTests, setAllTests]         = useState([]);

  // Load global stats on mount so the StatsRow is populated regardless of active tab
  useEffect(() => {
    Promise.all([
      questionAPI.getQuestions(undefined, undefined, { page: 1, limit: 1 }).catch(() => ({ data: {} })),
      testAPI.list().catch(() => ({ data: [] })),
      adminAPI.getAllUsers().catch(() => ({ data: [] })),
    ]).then(([qRes, tRes, uRes]) => {
      // Use total count from paginated response for the stats card
      const qTotal = qRes.data?.total ?? (Array.isArray(qRes.data) ? qRes.data.length : 0);
      setTotalQuestions(qTotal);
      setAllTests(Array.isArray(tRes.data) ? tRes.data : []);
      setAllUsers(Array.isArray(uRes.data) ? uRes.data : []);
    });
  }, []);

  return (
    <div className="adm-container">
      <div className="adm-page-header">
        <div className="adm-page-header-left">
          <span className="adm-page-kicker">Admin Portal</span>
          <h1 className="adm-title">Content Management</h1>
          <p className="adm-subtitle">Manage questions, tests, and monitor student progress</p>
        </div>
      </div>

      <StatsRow totalQuestions={totalQuestions} users={allUsers} tests={allTests} />

      <div className="adm-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`adm-tab ${activeTab === tab ? 'adm-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="adm-tab-panel">
        {activeTab === 'Questions'   && <QuestionsTab onQuestionsLoaded={(_, tot) => { if (tot !== undefined) setTotalQuestions(tot); }} />}
        {activeTab === 'Bulk Upload' && <BulkTab />}
        {activeTab === 'Tests'       && <TestsTab onTestsLoaded={setAllTests} />}
        {activeTab === 'Students'    && <StudentsTab onUsersLoaded={setAllUsers} />}
      </div>
    </div>
  );
};

export default Admin;
