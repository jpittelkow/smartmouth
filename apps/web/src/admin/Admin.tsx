// The grown-ups' admin area (ADR 0015): our own password, then the question library (ADR 0010).
import { useEffect, useState } from 'react';
import { APP_NAME } from '@smartmouth/protocol';
import { Library, NO_FILTERS, type Filters } from './Library.tsx';
import { Coverage } from './Coverage.tsx';
import './admin.css';

type Me = { enabled: boolean; signedIn: boolean };
type Tab = 'library' | 'coverage';

export function Admin() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add('admin-body');
    return () => document.body.classList.remove('admin-body');
  }, []);

  const load = () => fetch('/api/admin/me').then((r) => r.json()).then(setMe).catch(() => setError("Couldn't reach the server."));
  useEffect(() => { load(); }, []);

  if (!me) return <div className="adm-signin"><h1>Admin</h1><p>{error ?? 'Loading…'}</p></div>;
  if (!me.signedIn) return <SignIn enabled={me.enabled} onDone={load} />;
  return <Signedin onSignOut={async () => { await fetch('/api/admin/logout', { method: 'POST' }); load(); }} />;
}

function SignIn({ enabled, onDone }: { enabled: boolean; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      const body = await r.json();
      if (!r.ok) setError(body.error ?? 'Sign-in failed.');
      else { setPassword(''); onDone(); }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="adm adm-signin" onSubmit={submit}>
      <h1>{APP_NAME} admin</h1>
      {!enabled && <p style={{ color: 'var(--a-bad)' }}>No admin password is set on the server. Add ADMIN_PASSWORD to its settings.</p>}
      <label htmlFor="admin-password" style={{ display: 'grid', gap: 6, fontWeight: 700 }}>Password
        <input id="admin-password" className="adm-field" type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} autoFocus />
      </label>
      <div role="alert" style={{ color: 'var(--a-bad)', minHeight: 20 }}>{error ?? ''}</div>
      <button className="adm-btn primary" type="submit" disabled={busy || !password || !enabled}>Sign in</button>
    </form>
  );
}

function Signedin({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>(() => (location.hash === '#coverage' ? 'coverage' : 'library'));
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [toastText, setToastText] = useState<string | null>(null);

  useEffect(() => { history.replaceState(null, '', tab === 'coverage' ? '#coverage' : '#library'); }, [tab]);
  useEffect(() => {
    if (!toastText) return;
    const t = setTimeout(() => setToastText(null), 2500);
    return () => clearTimeout(t);
  }, [toastText]);

  return (
    <div className="adm">
      <header className="adm-top">
        <span className="brand">{APP_NAME} admin</span>
        <nav className="adm-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'library'} onClick={() => setTab('library')}>Questions</button>
          <button role="tab" aria-selected={tab === 'coverage'} onClick={() => setTab('coverage')}>Coverage</button>
        </nav>
        <span className="adm-spacer" />
        <a className="adm-btn" href="/api/admin/questions/export" download="smartmouth-questions.json">Export</a>
        <button className="adm-btn" onClick={onSignOut}>Sign out</button>
      </header>
      {tab === 'library'
        ? <Library filters={filters} setFilters={setFilters} toast={setToastText} />
        : <Coverage goTo={(f) => { setFilters({ ...NO_FILTERS, ...f }); setTab('library'); }} />}
      {toastText && <div className="adm-toast" role="status">{toastText}</div>}
    </div>
  );
}
