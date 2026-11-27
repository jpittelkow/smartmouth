// Pictures on a question in the admin editor (owner, 2026-11-27): the question's picture, up to 3 reveal pictures, and a
// picture per answer on Little picture questions. Each can be found on Wikimedia Commons, uploaded, or removed; "Find
// pictures for me" runs the same planner the backfill uses. Credits are shown and saved with each picture.
import { useState } from 'react';
import type { ImageRef } from '@smartmouth/protocol';
import { api } from './api.ts';

interface Found { key: string; title: string; license: string; author: string; width: number; height: number; pageUrl: string }

/** Shrinks an upload to TV size and re-encodes it, which also drops camera data such as the GPS position. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('That file isn’t a picture.')); img.src = url; });
    const scale = Math.min(1, 1600 / img.naturalWidth, 1600 / img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  } finally { URL.revokeObjectURL(url); }
}

/** One picture: shows it with its credit, and finds, uploads or removes it. */
export function PictureSlot({ label, hint, value, defaultQuery, onChange }: {
  label: string; hint?: string; value: ImageRef | null; defaultQuery: string; onChange: (v: ImageRef | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'That didn’t work.'); } finally { setBusy(false); }
  };
  const search = (q: string) => run(async () => {
    const r = await api<{ results: Found[] }>(`/api/admin/images/search?q=${encodeURIComponent(q)}`);
    setFound(r.results);
    if (!r.results.length) setError('Nothing on Commons for that. Try simpler words.');
  });
  const pick = (f: Found) => run(async () => {
    const r = await api<{ image: ImageRef }>('/api/admin/images/commons', { method: 'POST', body: { key: f.key, alt: query || f.title } });
    onChange(r.image); setOpen(false); setFound(null);
  });
  const upload = (file: File) => run(async () => {
    const data = await shrink(file);
    const r = await api<{ image: ImageRef }>('/api/admin/images/upload', {
      method: 'POST', body: { data, alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), credit: 'Our own photo' },
    });
    onChange(r.image);
  });
  const startFind = () => {
    const q = query || defaultQuery;
    setQuery(q); setOpen(true);
    if (q.trim().length >= 2 && !found) void search(q);
  };

  return (
    <div className="adm-pic">
      <div className="adm-pic-row">
        <div className="adm-pic-thumb">{value ? <img src={value.url} alt={value.alt} /> : <span className="help">No picture</span>}</div>
        <div className="adm-pic-info">
          <div className="lbl">{label}</div>
          {hint && <div className="help">{hint}</div>}
          {value && (
            <>
              <input className="adm-field" aria-label={`${label}: what it shows`} value={value.alt} maxLength={200} placeholder="What it shows"
                onChange={(e) => onChange({ ...value, alt: e.target.value })} />
              <input className="adm-field" aria-label={`${label}: credit`} value={value.credit} maxLength={200} placeholder="Credit"
                onChange={(e) => onChange({ ...value, credit: e.target.value })} />
            </>
          )}
          <div className="adm-actions">
            <button type="button" className="adm-btn" onClick={startFind} disabled={busy}>Find…</button>
            <label className="adm-btn">Upload…
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
            </label>
            {value && <button type="button" className="adm-btn danger" onClick={() => onChange(null)} disabled={busy}>Remove</button>}
            {busy && <span className="help">Working…</span>}
          </div>
        </div>
      </div>
      {error && <div className="err">{error}</div>}
      {open && (
        <div className="adm-pic-find">
          <form className="adm-actions" onSubmit={(e) => { e.preventDefault(); if (query.trim().length >= 2) void search(query.trim()); }}>
            <input className="adm-field" style={{ flex: 1 }} aria-label="Search Wikimedia Commons" value={query} placeholder="e.g. red fire truck"
              onChange={(e) => setQuery(e.target.value)} />
            <button className="adm-btn" disabled={busy}>Search</button>
            <button type="button" className="adm-btn" onClick={() => { setOpen(false); setFound(null); }}>Close</button>
          </form>
          <div className="help">Free-licensed photos from Wikimedia Commons; the credit is saved with the one you pick. No cartoon characters or logos.</div>
          {found && found.length > 0 && (
            <div className="adm-pic-grid">
              {found.map((f) => (
                <button key={f.key} type="button" className="adm-pic-cand" onClick={() => void pick(f)} disabled={busy} title={`${f.title} — ${f.author} (${f.license})`}>
                  <img src={`/api/admin/images/preview/${f.key}`} alt={f.title} loading="lazy" />
                  <span>{f.license}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const toRef = (a: { image?: string | null; credit?: string; text: string }): ImageRef | null =>
  a.image ? { url: a.image, alt: a.text, credit: a.credit ?? '' } : null;
export { toRef as answerPicture };
