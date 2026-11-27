// The grown-ups' admin area (ADR 0015): our own password, then the tools (review queue etc. in milestone 2).
import { useEffect, useState } from 'react';

type Me = { enabled: boolean; signedIn: boolean };

export function Admin() {
  const [me, setMe] = useState<Me | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => fetch('/api/admin/me').then((r) => r.json()).then(setMe).catch(() => setError("Couldn't reach the server."));
  useEffect(() => { load(); }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const body = await r.json();
      if (!r.ok) setError(body.error ?? 'Sign-in failed.');
      else { setPassword(''); await load(); }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => { await fetch('/api/admin/logout', { method: 'POST' }); await load(); };

  if (!me) return <div className="phone"><h1 className="display">Admin</h1><p className="muted">{error ?? 'Loading…'}</p></div>;

  if (!me.signedIn) {
    return (
      <form className="phone" onSubmit={signIn}>
        <h1 className="display">Admin</h1>
        {!me.enabled && <p className="error">No admin password is set on the server. Add ADMIN_PASSWORD to its settings.</p>}
        <label htmlFor="admin-password">Password
          <input id="admin-password" className="field" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} autoFocus />
        </label>
        <div className="error" role="alert">{error ?? ''}</div>
        <button className="press primary big-btn" type="submit" disabled={busy || !password || !me.enabled}>Sign in</button>
      </form>
    );
  }

  return (
    <div className="phone">
      <h1 className="display">Admin</h1>
      <p className="muted">You're signed in. The question review queue, Salty's lines and settings arrive in milestone 2 (ADR 0019).</p>
      <button className="press big-btn" onClick={signOut}>Sign out</button>
    </div>
  );
}
