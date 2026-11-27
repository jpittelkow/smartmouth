// The TV host screen (ADR 0007, design guide §6 TV). Drawn at 1920×1080 and scaled to the window.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { APP_NAME, BANDS, MAX_PLAYERS, SPICE_LABEL, type HostLobbyView, type HostView, type ServerMsg } from '@smartmouth/protocol';
import { useSocket, store, save } from '../socket.ts';
import { Blob, Grin } from '../ui/art.tsx';
import { SaltyStrip } from './SaltyStrip.tsx';
import { TriviaHost } from '../games/trivia/TriviaHost.tsx';
import { bed, fx } from '../games/trivia/audio.ts';
import { SnakesHost } from '../games/snakes/SnakesHost.tsx';

const KEY = 'smartmouth.host';

declare global {
  interface Window { smartmouthBack?: () => boolean }
}

export function Host() {
  const [view, setView] = useState<HostView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const { status, send } = useSocket(
    () => {
      const saved = store(KEY);
      if (saved) {
        try {
          const { code, token } = JSON.parse(saved) as { code: string; token: string };
          return { t: 'host:resume', code, token };
        } catch { /* fall through */ }
      }
      return { t: 'host:create' };
    },
    (m: ServerMsg) => {
      if (m.t === 'host:welcome') { save(KEY, JSON.stringify({ code: m.code, token: m.token })); setProblem(null); }
      else if (m.t === 'view' && m.view.role === 'host') setView(m.view);
      else if (m.t === 'error' && m.code === 'bad-token') { save(KEY, null); send({ t: 'host:create' }); }
      else if (m.t === 'error') setProblem(m.message);
    },
  );

  // Back on the TV remote: in a game it opens the menu (never quits mid-game, guide §6 TV rule 5); in the lobby
  // the shell asks before quitting.
  const [menu, setMenu] = useState(false);
  const inGame = view?.phase === 'game';
  useEffect(() => {
    window.smartmouthBack = () => { if (!inGame) return false; setMenu((m) => !m); return true; };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && inGame) setMenu((m) => !m); };
    window.addEventListener('keydown', onKey);
    return () => { delete window.smartmouthBack; window.removeEventListener('keydown', onKey); };
  }, [inGame]);
  useEffect(() => { if (!inGame) setMenu(false); }, [inGame]);
  // The menu pauses the game: every clock stops until Resume. A grown-up can also pause from their phone, and then
  // the TV shows the same menu.
  const paused = view?.phase === 'game' && view.paused;
  const showMenu = inGame && (menu || paused);
  const prevMenu = useRef(false);
  useEffect(() => {
    if (menu && !prevMenu.current && !paused) send({ t: 'admin:pause', paused: true });
    prevMenu.current = menu;
  }, [menu, paused, send]);
  const resume = () => { setMenu(false); send({ t: 'admin:pause', paused: false }); };

  return (
    <Stage variant={view?.phase === 'game' && view.gameId === 'snakes' && !showMenu ? 'snakes' : undefined}
      outside={inGame && !showMenu ? <button className="tv-menu-btn" onClick={() => setMenu(true)} aria-label="Pause and open the menu">❚❚ Pause</button> : null}>
      {!view && <div className="tv-message display"><Grin />{status === 'open' ? 'Setting up a room…' : `Finding the ${APP_NAME} server…`}</div>}
      {view?.phase === 'lobby' && <Lobby view={view} onPick={(gameId) => send({ t: 'admin:start', gameId })} problem={problem} />}
      {view?.phase === 'game' && !showMenu && view.gameId === 'snakes' && <SnakesHost view={view} send={send} />}
      {view?.phase === 'game' && !showMenu && view.gameId !== 'snakes' && <TriviaHost view={view} send={send} />}
      {view?.phase === 'game' && showMenu && <Menu onResume={resume} onEnd={() => { setMenu(false); send({ t: 'admin:end' }); }} />}
    </Stage>
  );
}

/** Scales the 1920×1080 stage to fit any window, keeping its proportions. */
function Stage({ children, variant, outside }: { children: React.ReactNode; variant?: string; outside?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      if (ref.current) ref.current.style.transform = `translate(-50%, -50%) scale(${s})`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return <div className="tv-viewport"><div className={`tv${variant ? ` ${variant}` : ''}`} ref={ref}>{outside}<div className="tv-panel">{children}</div></div></div>;
}

/** The pause menu (Back on the remote, Escape, or the Pause button). The game is paused while it's open. */
function Menu({ onResume, onEnd }: { onResume: () => void; onEnd: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = [...document.querySelectorAll<HTMLButtonElement>('.menu .game-card')];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="menu">
      <div className="display" style={{ fontSize: 72 }}>Paused</div>
      <div className="muted" style={{ fontSize: 32 }}>Every clock has stopped. Nobody loses a second.</div>
      <button ref={first} className="press game-card" onClick={onResume}><span className="name display">Resume</span></button>
      <button className="press game-card danger" onClick={onEnd}><span className="name display">End game</span></button>
    </div>
  );
}

function Lobby({ view, onPick, problem }: { view: HostLobbyView; onPick: (id: string) => void; problem: string | null }) {
  const [qr, setQr] = useState('');
  const firstCard = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    QRCode.toDataURL(view.joinUrl, { margin: 0, width: 600, color: { dark: '#14111f', light: '#fff6e6' } })
      .then(setQr).catch(() => setQr(''));
  }, [view.joinUrl]);

  // Lobby music while people join, and a pop for each new player (the owner's picks, 2026-11-27).
  useEffect(() => { bed('lobby'); }, []);
  const joined = useRef(view.players.length);
  useEffect(() => {
    if (view.players.length > joined.current) fx('join', 0, 0.6);
    joined.current = view.players.length;
  }, [view.players.length]);

  // D-pad: focus starts on the first game; up/down moves between games (guide §6 TV rule 4).
  useEffect(() => { firstCard.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const cards = [...document.querySelectorAll<HTMLButtonElement>('.game-card')];
      const i = cards.indexOf(document.activeElement as HTMLButtonElement);
      const next = cards[Math.max(0, Math.min(cards.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
      next?.focus();
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const display = view.joinUrl.replace(/^https?:\/\//, '').replace(/\/play\?code=.*$/, '');
  const capped = view.spice.effective !== view.spice.chosen;

  return (
    <>
      <div className="tv-top">
        <div className="wordmark display">sm<Grin />rtmouth</div>
        <div className="spice-chip">
          Spice <b>{SPICE_LABEL[view.spice.effective]}</b>
          {capped && <span className="muted">— capped: {capReason(view)}</span>}
        </div>
      </div>

      <div className="tv-main">
        <div className="join-card">
          <div>
            <div className="how">Grab a phone and go to</div>
            <div className="url display">{display}</div>
            <div className="how" style={{ marginTop: 24 }}>Room code</div>
            <div className="room-code display">{view.code}</div>
          </div>
          <div className="qr">{qr && <img src={qr} alt="QR code to join" />}</div>
        </div>

        <div className="games">
          <h2>Pick a game</h2>
          {view.games.map((g, i) => (
            <button key={g.id} ref={i === 0 ? firstCard : undefined} className={`press game-card${g.ready ? '' : ' soon'}`}
              onClick={() => onPick(g.id)}>
              <span className="name display">{g.name}</span>
              <span className="pitch">{g.ready ? g.pitch : `${g.pitch} (coming soon)`}</span>
            </button>
          ))}
          <div className="notice">{problem ?? view.notice ?? ''}</div>
        </div>
      </div>

      <SaltyStrip cue={view.salty} />

      <div className={`tiles${view.players.length > 6 ? ' two-rows' : ''}`}>
        {view.players.map((p) => (
          <div key={p.id} className={`tile${p.connected ? '' : ' away'}`}>
            <Blob avatar={p.avatar} color={p.color} />
            <div className="name">{p.name}</div>
            <div className="band">{BANDS.find((b) => b.id === p.band)?.label}{p.isAdmin ? ' · host' : ''}{p.connected ? '' : ' · away'}</div>
          </div>
        ))}
        {view.players.length < MAX_PLAYERS && (
          <div className="tile empty">+{MAX_PLAYERS - view.players.length} seats</div>
        )}
      </div>
    </>
  );
}

function capReason(view: HostLobbyView): string {
  const bands = new Set(view.players.map((p) => p.band));
  if (bands.has('little')) return 'a little one is playing';
  if (bands.has('kids') || bands.has('tweens')) return 'kids are playing';
  if (bands.has('teens')) return 'teens are playing';
  return 'nobody has joined yet';
}
