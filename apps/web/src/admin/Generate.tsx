// Admin > Generate: ask the AI for a batch of questions on a topic (server: generator.ts). It researches on the web,
// writes per age, has a second AI check every answer, and publishes the ones that pass (the rest wait in review).
import { useEffect, useState } from 'react';
import { BANDS, SPICES, SPICE_LABEL, spiceAllows, spiceCap, type Band, type Spice } from '@smartmouth/protocol';
import { api } from './api.ts';
import type { Filters } from './Library.tsx';

interface JobResult { id: number; prompt: string; ageMin: Band; status: 'live' | 'review'; note: string }
interface Job {
  id: string;
  request: { topic: string; bands: Band[]; perBand: number; spice: Spice; publish: boolean };
  state: 'running' | 'done' | 'failed';
  startedAt: number;
  finishedAt: number | null;
  log: string[];
  results: JobResult[];
  skipped: Array<{ prompt: string; reason: string }>;
  sources: Array<{ url: string; title: string }>;
  cost: number;
  error: string | null;
}
interface Status {
  enabled: boolean;
  models: { writer: string; checker: string; budget: number } | null;
  jobs: Job[];
  voice: { enabled: boolean; busy: boolean; lastRun: { at: number; ok: boolean; output: string } | null } | null;
}

const EXAMPLES = ['Paw Patrol', 'Dinosaurs', 'Minecraft', 'The solar system', '90s movies', 'Taylor Swift', 'World capitals'];
const bandLabel = (b: Band) => BANDS.find((x) => x.id === b)?.label ?? b;

export function Generate({ goTo, toast }: { goTo: (f: Partial<Filters>) => void; toast: (s: string) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [bands, setBands] = useState<Band[]>(['kids']);
  const [perBand, setPerBand] = useState(5);
  const [spice, setSpice] = useState<Spice>('mild');
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => api<Status>('/api/admin/generate').then((s) => { setStatus(s); setError(null); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const running = !!status?.jobs.some((j) => j.state === 'running') || !!status?.voice?.busy;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [running]);

  // The youngest age picked caps how spicy the batch can be.
  const cap = spiceCap(bands.length ? bands : ['grownups']);
  useEffect(() => { if (!spiceAllows(cap, spice)) setSpice(cap); }, [cap, spice]);

  const toggle = (b: Band) => setBands((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/admin/generate', { method: 'POST', body: { topic, bands, perBand, spice, publish } });
      toast('Writing questions…');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn\'t work.');
    } finally {
      setBusy(false);
    }
  };

  if (!status) return <div className="adm-main"><div className="adm-count">{error ?? 'Loading…'}</div></div>;
  const jobRunning = status.jobs.some((j) => j.state === 'running');
  const total = bands.length * perBand;

  return (
    <div className="adm-main">
      <form className="adm-card gen-form" onSubmit={submit}>
        <h2>Write questions with AI</h2>
        {!status.enabled && <p style={{ color: 'var(--a-bad)' }}>No OpenRouter key on the server (OPENROUTER_API_KEY).</p>}
        <label className="gen-label">What about?
          <input className="adm-field" value={topic} maxLength={300} placeholder="e.g. Paw Patrol, the ocean, 80s music"
            onChange={(e) => setTopic(e.target.value)} />
        </label>
        <div className="gen-examples">
          {EXAMPLES.map((x) => <button type="button" key={x} className="chip" onClick={() => setTopic(x)}>{x}</button>)}
        </div>
        <fieldset className="gen-set">
          <legend>For which ages?</legend>
          {BANDS.map((b) => (
            <label key={b.id} className="check">
              <input type="checkbox" checked={bands.includes(b.id)} onChange={() => toggle(b.id)} /> {b.label} <span className="adm-count">{b.ages}</span>
            </label>
          ))}
        </fieldset>
        <div className="gen-row">
          <label className="gen-label">Per age
            <input className="adm-field" type="number" min={1} max={15} value={perBand}
              onChange={(e) => setPerBand(Math.max(1, Math.min(15, Number(e.target.value) || 1)))} />
          </label>
          <label className="gen-label">Spice
            <select className="adm-field" value={spice} onChange={(e) => setSpice(e.target.value as Spice)}>
              {SPICES.map((s) => <option key={s} value={s} disabled={!spiceAllows(cap, s)}>{SPICE_LABEL[s]}</option>)}
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          Publish the ones the checker agrees with (the rest go to Review)
        </label>
        <div className="gen-row">
          <button className="adm-btn primary" type="submit" disabled={busy || jobRunning || !status.enabled || topic.trim().length < 2 || !bands.length}>
            {jobRunning ? 'Writing…' : `Write ${total} question${total === 1 ? '' : 's'}`}
          </button>
          {error && <span role="alert" style={{ color: 'var(--a-bad)' }}>{error}</span>}
        </div>
        {status.models && (
          <p className="adm-count">
            Researched and written by <b>{status.models.writer}</b>, checked blind by <b>{status.models.checker}</b>.
            Each batch may spend up to ${status.models.budget.toFixed(2)}. New live questions are recorded in Salty's voices afterwards.
          </p>
        )}
      </form>

      {status.voice?.enabled && (status.voice.busy || status.voice.lastRun) && (
        <div className="adm-count gen-voice">
          {status.voice.busy ? 'Salty is recording the new questions…' : `Last recording: ${status.voice.lastRun!.ok ? 'done' : 'had a problem'} (${status.voice.lastRun!.output.split('\n').pop()})`}
        </div>
      )}

      {status.jobs.map((j) => <JobCard key={j.id} job={j} goTo={goTo} />)}
    </div>
  );
}

function JobCard({ job, goTo }: { job: Job; goTo: (f: Partial<Filters>) => void }) {
  const live = job.results.filter((r) => r.status === 'live').length;
  return (
    <section className="adm-card gen-job">
      <h2>
        {job.request.topic} <span className="adm-count">{job.request.bands.map(bandLabel).join(', ')} · {job.request.perBand} each</span>
        <span className={`chip ${job.state === 'failed' ? 'retired' : job.state === 'done' ? 'live' : 'review'}`}>{job.state}</span>
      </h2>
      <ul className="gen-log">{job.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
      {job.results.length > 0 && (
        <>
          <div className="gen-row">
            <b>{live} live, {job.results.length - live} in review</b>
            <span className="adm-spacer" />
            {job.results.length - live > 0 && <button className="adm-btn" onClick={() => goTo({ status: 'review', source: 'ai' })}>Review the rest</button>}
          </div>
          <ul className="gen-results">
            {job.results.map((r) => (
              <li key={r.id}>
                <span className={`chip ${r.status}`}>{r.status}</span> <span className="chip">{bandLabel(r.ageMin)}</span> {r.prompt}
                {r.note && <div className="adm-count">{r.note}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
      {job.skipped.length > 0 && (
        <details><summary className="adm-count">{job.skipped.length} skipped</summary>
          <ul className="gen-results">{job.skipped.map((s, i) => <li key={i}>{s.prompt} <span className="adm-count">· {s.reason}</span></li>)}</ul>
        </details>
      )}
      {job.sources.length > 0 && (
        <details><summary className="adm-count">{job.sources.length} sources</summary>
          <ul className="gen-results">{job.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a></li>)}</ul>
        </details>
      )}
      <div className="adm-count">Spent ${job.cost.toFixed(3)}</div>
    </section>
  );
}
