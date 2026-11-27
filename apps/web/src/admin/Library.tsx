// The question library: search, filter by every grade, bulk status changes, and the editor beside the list.
import { useCallback, useEffect, useState } from 'react';
import {
  BANDS, CATEGORIES, FRESHNESS, REGIONS, REGION_LABEL, SEASONS, SOURCES, STATUSES, SPICE_LABEL,
  type Question, type QuestionPage, type QuestionStatus,
} from '@smartmouth/protocol';
import { api } from './api.ts';
import { Editor } from './Editor.tsx';

export interface Filters {
  q: string; band: string; difficulty: string; category: string; freshness: string; status: string;
  source: string; region: string; season: string; needsCheck: boolean; sort: string;
}
export const NO_FILTERS: Filters = {
  q: '', band: '', difficulty: '', category: '', freshness: '', status: '', source: '', region: '', season: '', needsCheck: false, sort: 'updated',
};

const PAGE = 50;
const bandLabel = (id: string) => BANDS.find((b) => b.id === id)?.label ?? id;
const ageText = (q: Question) => (q.ageMin === q.ageMax ? bandLabel(q.ageMin) : `${bandLabel(q.ageMin)}–${bandLabel(q.ageMax)}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');

function freshnessText(q: Question): string {
  if (q.freshness === 'dated') return `Dated · checked ${q.asOf}`;
  if (q.freshness === 'current') return `Current · until ${q.expiresAt}`;
  return 'Evergreen';
}

export function Library({ filters, setFilters, toast }: {
  filters: Filters; setFilters: (f: Filters) => void; toast: (m: string) => void;
}) {
  const [page, setPage] = useState<QuestionPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<Question | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(filters.q);

  const load = useCallback(async () => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v !== '' && v !== false) sp.set(k, v === true ? '1' : String(v));
    sp.set('limit', String(PAGE));
    sp.set('offset', String(offset));
    try { setPage(await api<QuestionPage>(`/api/admin/questions?${sp}`)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Loading failed.'); }
  }, [filters, offset]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setOffset(0); setSelected(new Set()); }, [filters]);
  // Search as you type, a beat after the last key.
  useEffect(() => {
    const t = setTimeout(() => { if (search !== filters.q) setFilters({ ...filters, q: search }); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const set = (k: keyof Filters, v: string | boolean) => setFilters({ ...filters, [k]: v });
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const bulk = async (status: QuestionStatus) => {
    const ids = [...selected];
    const r = await api<{ changed: number }>('/api/admin/questions/status', { method: 'POST', body: { ids, status } });
    toast(`${r.changed} set to ${status}`);
    setSelected(new Set());
    load();
  };

  const select = (key: keyof Filters, all: string, options: ReadonlyArray<readonly [string, string]>) => (
    <select className="adm-field" aria-label={all} value={String(filters[key])} onChange={(e) => set(key, e.target.value)}>
      <option value="">{all}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div className={`adm-main${open ? ' split' : ''}`}>
      <div style={{ display: 'grid', gap: 12, minWidth: 0, alignContent: 'start' }}>
        <div className="adm-filters">
          <input className="adm-field search" type="search" placeholder="Search questions, answers, tags, notes" aria-label="Search"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="adm-btn primary" onClick={() => setOpen('new')}>New question</button>
        </div>
        <div className="adm-filters">
          {select('band', 'Any age', BANDS.map((b) => [b.id, `${b.label} (${b.ages})`]))}
          {select('difficulty', 'Any difficulty', [1, 2, 3, 4, 5].map((d) => [String(d), `Difficulty ${d}`]))}
          {select('category', 'Any category', CATEGORIES.map((c) => [c, c]))}
          {select('freshness', 'Any freshness', FRESHNESS.map((f) => [f, cap(f)]))}
          {select('status', 'Any status', STATUSES.map((s) => [s, cap(s)]))}
          {select('source', 'Any source', SOURCES.map((s) => [s, s === 'ai' ? 'AI' : cap(s)]))}
          {select('region', 'Anywhere', REGIONS.map((r) => [r, REGION_LABEL[r]]))}
          {select('season', 'Any season', SEASONS.map((s) => [s, cap(s)]))}
          {select('sort', 'Sort', [['updated', 'Recently changed'], ['created', 'Newest'], ['difficulty', 'Easiest first'], ['plays', 'Most played'], ['correctness', 'Fewest right']])}
          <label className="check"><input type="checkbox" checked={filters.needsCheck} onChange={(e) => set('needsCheck', e.target.checked)} /> Needs a look</label>
          <button className="adm-btn" onClick={() => { setSearch(''); setFilters(NO_FILTERS); }}>Clear</button>
        </div>

        {selected.size > 0 && (
          <div className="adm-bulk">
            <b>{selected.size} selected</b>
            {STATUSES.map((s) => <button key={s} className="adm-btn" onClick={() => bulk(s)}>Set {s}</button>)}
            <button className="adm-btn" onClick={() => setSelected(new Set())}>Clear selection</button>
          </div>
        )}

        <div className="adm-count">{error ?? (page ? `${page.total} question${page.total === 1 ? '' : 's'}` : 'Loading…')}</div>

        {page && page.items.length === 0 && (
          <div className="adm-empty">No questions match. Clear the filters, or add one with <b>New question</b>.</div>
        )}

        <div className="adm-list">
          {page?.items.map((q) => (
            <div key={q.id} className="adm-row" role="button" tabIndex={0} aria-current={open !== 'new' && open?.id === q.id}
              onClick={() => setOpen(q)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(q); }}>
              <input type="checkbox" aria-label="Select" checked={selected.has(q.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(q.id)} />
              <div style={{ minWidth: 0 }}>
                <div className="prompt">{q.prompt}</div>
                <div className="answers">
                  {q.answers.map((a, i) => <span key={i}>{i > 0 && ' · '}{i === q.correct ? <b>{a.text}</b> : a.text}</span>)}
                </div>
                <div className="adm-chips">
                  <span className={`chip ${q.status}`}>{q.status}</span>
                  <span className="chip">{ageText(q)}</span>
                  <span className="chip" title={`Difficulty ${q.difficulty}`}><span className="dots">{'●'.repeat(q.difficulty)}{'○'.repeat(5 - q.difficulty)}</span></span>
                  <span className="chip">{q.category}</span>
                  <span className="chip">{freshnessText(q)}</span>
                  {q.spice !== 'mild' && <span className="chip">{SPICE_LABEL[q.spice]}</span>}
                  {q.season && <span className="chip">{cap(q.season)}</span>}
                  {q.region !== 'global' && <span className="chip">{REGION_LABEL[q.region]}</span>}
                  {q.stats.asked > 0 && <span className="chip">{Math.round((100 * q.stats.correct) / q.stats.asked)}% right of {q.stats.asked}</span>}
                  {q.needsCheck.map((r) => <span key={r} className="chip check">{r}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {page && page.total > PAGE && (
          <div className="adm-pager">
            <button className="adm-btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</button>
            <span className="adm-count">{offset + 1}–{Math.min(offset + PAGE, page.total)} of {page.total}</span>
            <button className="adm-btn" disabled={offset + PAGE >= page.total} onClick={() => setOffset(offset + PAGE)}>Next</button>
          </div>
        )}
      </div>

      {open && (
        <Editor
          question={open === 'new' ? null : open}
          onClose={() => setOpen(null)}
          onSaved={(q, m) => { toast(m); setOpen(q); load(); }}
          onDeleted={() => { toast('Deleted'); setOpen(null); load(); }}
        />
      )}
    </div>
  );
}
