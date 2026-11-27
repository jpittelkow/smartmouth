// Where the library is thin: live questions per age band × category and × difficulty. A tap opens those questions.
import { useEffect, useState } from 'react';
import { BANDS, CATEGORIES, type Coverage as CoverageData } from '@smartmouth/protocol';
import { api } from './api.ts';
import type { Filters } from './Library.tsx';

/** Below this many live questions a band runs out in a night or two. */
const THIN = 3;

export function Coverage({ goTo }: { goTo: (f: Partial<Filters>) => void }) {
  const [data, setData] = useState<CoverageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<CoverageData>('/api/admin/questions/coverage').then(setData).catch((e) => setError(e.message)); }, []);
  if (!data) return <div className="adm-main"><div className="adm-count">{error ?? 'Loading…'}</div></div>;

  const max = Math.max(1, ...BANDS.flatMap((b) => Object.values(data.byCategory[b.id]).map(Number)));
  const heat = (n: number) => (n ? { background: `rgba(var(--a-heat), ${0.12 + 0.6 * (n / max)})` } : undefined);

  return (
    <div className="adm-main">
      <section className="adm-card">
        <h2>Library</h2>
        <div className="adm-totals">
          {(['live', 'review', 'draft', 'retired'] as const).map((s) => (
            <button key={s} className="adm-btn" onClick={() => goTo({ status: s })}>
              <div><b>{data.totals[s]}</b> <span>{s}</span></div>
            </button>
          ))}
          <button className="adm-btn" onClick={() => goTo({ needsCheck: true })}>
            <div><b style={{ color: data.needsCheck ? 'var(--a-bad)' : undefined }}>{data.needsCheck}</b> <span>need a look</span></div>
          </button>
        </div>
        <p className="adm-count">Counts are <b>live</b> questions. A question counts for every age band in its range. Red cells have fewer than {THIN}.</p>
      </section>

      <section className="adm-card">
        <h2>By age and category</h2>
        <div className="adm-scroll">
          <table className="cov">
            <thead>
              <tr><th className="corner">Age</th>{CATEGORIES.map((c) => <th key={c} scope="col">{c}</th>)}<th scope="col">All</th></tr>
            </thead>
            <tbody>
              {BANDS.map((b) => {
                const row = data.byCategory[b.id];
                const total = Object.values(row).reduce((a, n) => a + Number(n), 0);
                return (
                  <tr key={b.id}>
                    <th className="rowh" scope="row">{b.label} <span className="adm-count">{b.ages}</span></th>
                    {CATEGORIES.map((c) => {
                      const n = row[c] ?? 0;
                      return (
                        <td key={c} className={n < THIN ? 'gap' : ''} style={heat(n)}>
                          <button onClick={() => goTo({ band: b.id, category: c, status: 'live' })} aria-label={`${b.label}, ${c}: ${n}`}>{n}</button>
                        </td>
                      );
                    })}
                    <td><b>{total}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="adm-card">
        <h2>By age and difficulty</h2>
        <div className="adm-scroll">
          <table className="cov">
            <thead><tr><th className="corner">Age</th>{[1, 2, 3, 4, 5].map((d) => <th key={d} className="corner" scope="col">{d}</th>)}</tr></thead>
            <tbody>
              {BANDS.map((b) => (
                <tr key={b.id}>
                  <th className="rowh" scope="row">{b.label}</th>
                  {data.byDifficulty[b.id].map((n, i) => (
                    <td key={i} className={n < THIN ? 'gap' : ''} style={heat(n)}>
                      <button onClick={() => goTo({ band: b.id, difficulty: String(i + 1), status: 'live' })} aria-label={`${b.label}, difficulty ${i + 1}: ${n}`}>{n}</button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
