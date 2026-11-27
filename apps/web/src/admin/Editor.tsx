// Add or edit one question, with every grade (ADR 0010). Checks with the same rules as the server before saving.
import { useEffect, useState } from 'react';
import {
  BANDS, CATEGORIES, DIFFICULTY_HELP, FRESHNESS, FRESHNESS_LABEL, KINDS, KIND_LABEL, REGIONS, REGION_LABEL, SEASONS,
  SPICES, SPICE_LABEL, STATUSES, spiceAllows, spiceCap, validateQuestion,
  type ImageRef, type Question, type QuestionInput, type QuestionKind,
} from '@smartmouth/protocol';
import { api, ApiError } from './api.ts';
import { PictureSlot, answerPicture } from './Pictures.tsx';

type Errors = Partial<Record<string, string>>;

export const BLANK: QuestionInput = {
  prompt: '', kind: 'choice', answers: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }], correct: 0, explain: '',
  ageMin: 'kids', ageMax: 'tweens', difficulty: 3, category: 'Animals', tags: [], freshness: 'evergreen', asOf: null,
  expiresAt: null, season: null, region: 'global', spice: 'mild', status: 'draft', source: 'manual', sourceRef: '', notes: '',
};

const today = () => new Date().toISOString().slice(0, 10);
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');

export function Editor({ question, onSaved, onDeleted, onClose }: {
  question: Question | null;
  onSaved: (q: Question, message: string) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState<QuestionInput>(question ?? BLANK);
  const [tagsText, setTagsText] = useState((question?.tags ?? []).join(', '));
  const [errors, setErrors] = useState<Errors>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [finding, setFinding] = useState('');

  useEffect(() => {
    setQ(question ?? BLANK);
    setTagsText((question?.tags ?? []).join(', '));
    setErrors({}); setWarnings([]); setConfirmDelete(false); setFinding('');
  }, [question?.id]);

  const set = <K extends keyof QuestionInput>(k: K, v: QuestionInput[K]) => setQ((old) => ({ ...old, [k]: v }));

  const setKind = (kind: QuestionKind) => setQ((old) => {
    if (kind === 'truefalse') return { ...old, kind, answers: [{ text: 'True' }, { text: 'False' }], correct: Math.min(old.correct, 1) };
    const n = kind === 'picture' ? 3 : 4;
    const answers = [...old.answers.slice(0, n)];
    while (answers.length < (kind === 'picture' ? 3 : 4)) answers.push({ text: '' });
    return { ...old, kind, answers, correct: Math.min(old.correct, answers.length - 1) };
  });

  // Blank trailing answers are left out, so a 3-answer question can be typed into the 4 boxes.
  const draftOf = () => {
    const answers = q.answers.filter((a, i) => a.text.trim() || i === q.correct);
    return { ...q, answers, tags: tagsText.split(','), correct: answers.indexOf(q.answers[q.correct] as typeof answers[number]) };
  };

  /** Plans, searches and picks pictures for the empty slots; the grown-up's own picks are kept. */
  const findPictures = async () => {
    const v = validateQuestion(draftOf());
    if (!v.ok) { setErrors(v.errors); setFinding('Fill in the question and its answers first.'); return; }
    setFinding('Looking… (about a minute)');
    try {
      const r = await api<{ image: ImageRef | null; revealImages: ImageRef[]; answers: QuestionInput['answers']; log: string[] }>(
        '/api/admin/images/suggest', { method: 'POST', body: { question: v.value } });
      setQ((o) => ({
        ...o,
        image: o.image ?? r.image,
        revealImages: o.revealImages?.length ? o.revealImages : r.revealImages,
        answers: o.answers.map((a) => {
          const hit = r.answers.find((x) => x.text === a.text && x.image);
          return a.image || !hit ? a : { ...a, image: hit.image, credit: hit.credit };
        }),
      }));
      setFinding(r.log.join(' · ') || 'Nothing suitable found.');
    } catch (e) {
      setFinding(e instanceof Error ? e.message : 'Finding pictures failed.');
    }
  };

  const save = async () => {
    const v = validateQuestion(draftOf());
    setWarnings(v.warnings);
    if (!v.ok) { setErrors(v.errors); return; }
    setErrors({});
    setBusy(true);
    try {
      const r = question
        ? await api<{ question: Question; warnings: string[] }>(`/api/admin/questions/${question.id}`, { method: 'PUT', body: v.value })
        : await api<{ question: Question; warnings: string[] }>('/api/admin/questions', { method: 'POST', body: v.value });
      onSaved(r.question, question ? 'Saved' : 'Added to the library');
    } catch (e) {
      if (e instanceof ApiError && e.body.errors) setErrors(e.body.errors);
      else setErrors({ form: e instanceof Error ? e.message : 'Saving failed.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!question) return;
    setBusy(true);
    try { await api(`/api/admin/questions/${question.id}`, { method: 'DELETE' }); onDeleted(question.id); }
    catch (e) { setErrors({ form: e instanceof Error ? e.message : 'Deleting failed.' }); }
    finally { setBusy(false); }
  };

  const cap = spiceCap([q.ageMin]);
  const maxAnswers = q.kind === 'truefalse' ? 2 : q.kind === 'picture' ? 3 : 4;

  return (
    <section className="adm-editor" aria-label={question ? 'Edit question' : 'New question'}>
      <div className="adm-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{question ? `Question #${question.id}` : 'New question'}</h2>
        <button className="adm-btn" onClick={onClose}>Close</button>
      </div>

      <fieldset>
        <label className="lbl" htmlFor="q-prompt">Question</label>
        <textarea id="q-prompt" className="adm-field" value={q.prompt} maxLength={300} onChange={(e) => set('prompt', e.target.value)} />
        {errors.prompt && <div className="err">{errors.prompt}</div>}
      </fieldset>

      <div className="adm-grid2">
        <fieldset>
          <label className="lbl" htmlFor="q-kind">Kind</label>
          <select id="q-kind" className="adm-field" value={q.kind} onChange={(e) => setKind(e.target.value as QuestionKind)}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </fieldset>
        <fieldset>
          <label className="lbl" htmlFor="q-category">Category</label>
          <select id="q-category" className="adm-field" value={q.category} onChange={(e) => set('category', e.target.value as QuestionInput['category'])}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          {errors.category && <div className="err">{errors.category}</div>}
        </fieldset>
      </div>

      <fieldset>
        <legend>Answers <span className="help">(pick the right one)</span></legend>
        {q.answers.slice(0, maxAnswers).map((a, i) => (
          <div className="adm-answer" key={i}>
            <input type="radio" name="q-correct" id={`q-correct-${i}`} checked={q.correct === i} onChange={() => set('correct', i)}
              aria-label={`Answer ${i + 1} is right`} />
            <input id={`q-answer-${i}`} className="adm-field" value={a.text} maxLength={80} disabled={q.kind === 'truefalse'}
              placeholder={i < 2 ? 'Answer' : 'Answer (optional)'}
              onChange={(e) => set('answers', q.answers.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            <span className="help">{q.correct === i ? 'right' : ''}</span>
          </div>
        ))}
        {(errors.answers || errors.correct) && <div className="err">{errors.answers ?? errors.correct}</div>}
      </fieldset>

      <fieldset>
        <label className="lbl" htmlFor="q-explain">Salty's follow-up <span className="help">(one line after the reveal)</span></label>
        <input id="q-explain" className="adm-field" value={q.explain} maxLength={200} onChange={(e) => set('explain', e.target.value)} />
      </fieldset>

      <fieldset>
        <legend>Pictures <span className="help">(optional; shown on the TV with a small credit)</span></legend>
        <div className="adm-actions">
          <button type="button" className="adm-btn" onClick={findPictures} disabled={busy || finding.startsWith('Looking')}>Find pictures for me</button>
          {finding && <span className="help">{finding}</span>}
        </div>
        <PictureSlot label="With the question" hint="Shown while players answer, so it must not give the answer away."
          value={q.image ?? null} defaultQuery="" onChange={(v) => set('image', v)} />
        {[0, 1, 2].slice(0, Math.min(3, (q.revealImages?.length ?? 0) + 1)).map((i) => (
          <PictureSlot key={`r${i}-${q.revealImages?.[i]?.url ?? ''}`} label={`At the reveal ${i + 1}`} hint={i === 0 ? 'Shown with the fun fact; it can show the answer.' : undefined}
            value={q.revealImages?.[i] ?? null} defaultQuery={q.answers[q.correct]?.text ?? ''}
            onChange={(v) => {
              const list = [...(q.revealImages ?? [])];
              if (v) list[i] = v; else list.splice(i, 1);
              set('revealImages', list.filter(Boolean));
            }} />
        ))}
        {q.kind === 'picture' && q.answers.slice(0, maxAnswers).map((a, i) => (
          <PictureSlot key={`a${i}`} label={`Answer ${i + 1}${a.text ? `: ${a.text}` : ''}`} hint={i === 0 ? 'Little ones pick between these picture cards.' : undefined}
            value={answerPicture(a)} defaultQuery={a.text}
            onChange={(v) => set('answers', q.answers.map((x, j) => (j === i ? { text: x.text, image: v?.url ?? null, ...(v?.credit ? { credit: v.credit } : {}) } : x)))} />
        ))}
      </fieldset>

      <fieldset>
        <legend>Ages it suits</legend>
        <div className="adm-grid2">
          <select id="q-agemin" className="adm-field" aria-label="Youngest" value={q.ageMin} onChange={(e) => set('ageMin', e.target.value as QuestionInput['ageMin'])}>
            {BANDS.map((b) => <option key={b.id} value={b.id}>From {b.label} ({b.ages})</option>)}
          </select>
          <select id="q-agemax" className="adm-field" aria-label="Oldest" value={q.ageMax} onChange={(e) => set('ageMax', e.target.value as QuestionInput['ageMax'])}>
            {BANDS.map((b) => <option key={b.id} value={b.id}>to {b.label} ({b.ages})</option>)}
          </select>
        </div>
        {(errors.ageMin || errors.ageMax) && <div className="err">{errors.ageMin ?? errors.ageMax}</div>}
      </fieldset>

      <fieldset>
        <legend>Difficulty <span className="help">(for the youngest age in the range)</span></legend>
        <div className="seg" role="group" aria-label="Difficulty">
          {[1, 2, 3, 4, 5].map((d) => (
            <button key={d} type="button" aria-pressed={q.difficulty === d} onClick={() => set('difficulty', d)}>{d}</button>
          ))}
        </div>
        <div className="help">{DIFFICULTY_HELP[q.difficulty] ?? ''}</div>
        {errors.difficulty && <div className="err">{errors.difficulty}</div>}
      </fieldset>

      <fieldset>
        <legend>How long it stays true</legend>
        <select id="q-freshness" className="adm-field" value={q.freshness}
          onChange={(e) => { const f = e.target.value as QuestionInput['freshness']; setQ((o) => ({ ...o, freshness: f, asOf: f !== 'evergreen' ? o.asOf ?? today() : o.asOf })); }}>
          {FRESHNESS.map((f) => <option key={f} value={f}>{FRESHNESS_LABEL[f]}</option>)}
        </select>
        {q.freshness !== 'evergreen' && (
          <div className="adm-grid2">
            <label className="help" htmlFor="q-asof">{q.freshness === 'dated' ? 'Answer checked on' : 'Event date'}
              <input id="q-asof" type="date" className="adm-field" value={q.asOf ?? ''} onChange={(e) => set('asOf', e.target.value || null)} />
            </label>
            {q.freshness === 'current' && (
              <label className="help" htmlFor="q-expires">Stop asking after
                <input id="q-expires" type="date" className="adm-field" value={q.expiresAt ?? ''} onChange={(e) => set('expiresAt', e.target.value || null)} />
              </label>
            )}
          </div>
        )}
        {(errors.asOf || errors.expiresAt) && <div className="err">{errors.asOf ?? errors.expiresAt}</div>}
      </fieldset>

      <div className="adm-grid3">
        <fieldset>
          <label className="lbl" htmlFor="q-spice">Spice</label>
          <select id="q-spice" className="adm-field" value={q.spice} onChange={(e) => set('spice', e.target.value as QuestionInput['spice'])}>
            {SPICES.map((s) => <option key={s} value={s} disabled={!spiceAllows(cap, s)}>{SPICE_LABEL[s]}</option>)}
          </select>
        </fieldset>
        <fieldset>
          <label className="lbl" htmlFor="q-region">Who gets it</label>
          <select id="q-region" className="adm-field" value={q.region} onChange={(e) => set('region', e.target.value as QuestionInput['region'])}>
            {REGIONS.map((r) => <option key={r} value={r}>{REGION_LABEL[r]}</option>)}
          </select>
        </fieldset>
        <fieldset>
          <label className="lbl" htmlFor="q-season">Season</label>
          <select id="q-season" className="adm-field" value={q.season ?? ''} onChange={(e) => set('season', (e.target.value || null) as QuestionInput['season'])}>
            <option value="">Any time</option>
            {SEASONS.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </fieldset>
      </div>
      {errors.spice && <div className="err">{errors.spice}</div>}

      <fieldset>
        <label className="lbl" htmlFor="q-tags">Tags <span className="help">(comma-separated)</span></label>
        <input id="q-tags" className="adm-field" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="ocean, records" />
      </fieldset>

      <div className="adm-grid2">
        <fieldset>
          <label className="lbl" htmlFor="q-status">Status</label>
          <select id="q-status" className="adm-field" value={q.status} onChange={(e) => set('status', e.target.value as QuestionInput['status'])}>
            {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </fieldset>
        <fieldset>
          <label className="lbl" htmlFor="q-sourceref">Source</label>
          <input id="q-sourceref" className="adm-field" value={q.sourceRef} placeholder="Where the fact came from" onChange={(e) => set('sourceRef', e.target.value)} />
        </fieldset>
      </div>

      <fieldset>
        <label className="lbl" htmlFor="q-notes">Notes <span className="help">(grown-ups only)</span></label>
        <textarea id="q-notes" className="adm-field" value={q.notes} onChange={(e) => set('notes', e.target.value)} />
      </fieldset>

      {question && (
        <div className="adm-stats">
          <span>From: {question.source}{question.seedKey ? ` (seed "${question.seedKey}")` : ''}. Added {question.createdAt.slice(0, 10)}, changed {question.updatedAt.slice(0, 10)}.</span>
          <span>
            {question.stats.asked
              ? `Asked ${question.stats.asked}×, ${Math.round((100 * question.stats.correct) / question.stats.asked)}% right${question.playsAs ? `, plays as ${question.playsAs}` : ''}.`
              : 'Not asked in a game yet.'}
          </span>
          {question.needsCheck.length > 0 && <span className="err">Needs a look: {question.needsCheck.join('; ')}</span>}
        </div>
      )}

      {warnings.map((w) => <div key={w} className="warn">{w}</div>)}
      {errors.form && <div className="err">{errors.form}</div>}

      <div className="adm-actions">
        <button className="adm-btn primary" onClick={save} disabled={busy}>{question ? 'Save' : 'Add question'}</button>
        {question && !confirmDelete && <button className="adm-btn danger" onClick={() => setConfirmDelete(true)} disabled={busy}>Delete…</button>}
        {question && confirmDelete && (
          <>
            <button className="adm-btn danger" onClick={remove} disabled={busy}>Delete for good</button>
            <button className="adm-btn" onClick={() => setConfirmDelete(false)}>Keep it</button>
            <span className="help">Retiring keeps its stats; deleting can't be undone.</span>
          </>
        )}
      </div>
    </section>
  );
}
