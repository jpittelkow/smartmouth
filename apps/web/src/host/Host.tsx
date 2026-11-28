// The TV host screen (ADR 0007, design guide §6 TV). Drawn at 1920×1080 and scaled to the window.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { APP_NAME, BANDS, LEVELS, LEVEL_LABEL, MAX_PLAYERS, SPICE_LABEL, type ClientMsg, type HostLobbyView, type HostView, type ServerMsg } from '@smartmouth/protocol';
import { useSocket, store, save, serverNow } from '../socket.ts';
import { Blob, Grin, Tick } from '../ui/art.tsx';
import { SaltyBadge } from './SaltyStrip.tsx';
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
      {view?.phase === 'lobby' && <Lobby view={view} send={send} problem={problem} />}
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

function Lobby({ view, send, problem }: { view: HostLobbyView; send: (m: ClientMsg) => void; problem: string | null }) {
  const [qr, setQr] = useState('');

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

  // D-pad: the arrows move through the buttons in the right-hand column (game cards, or the setup's options); Back
  // (Escape) steps the setup back (guide §6 TV rule 4).
  const setupStep = view.setup?.step ?? null;
  useEffect(() => {
    const pick = document.querySelector<HTMLButtonElement>('.games .focus-first') ?? document.querySelector<HTMLButtonElement>('.games button');
    pick?.focus();
  }, [setupStep]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && view.setup) { send({ t: 'setup:back' }); e.preventDefault(); return; }
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const btns = [...document.querySelectorAll<HTMLButtonElement>('.games button')];
      const i = btns.indexOf(document.activeElement as HTMLButtonElement);
      const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      btns[Math.max(0, Math.min(btns.length - 1, (i < 0 ? 0 : i + step)))]?.focus();
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.setup, send]);

  const display = view.joinUrl.replace(/^https?:\/\//, '').replace(/\/play\?code=.*$/, '');
  const capped = view.spice.effective !== view.spice.chosen;

  return (
    <>
      <div className="tv-top">
        <div className="wordmark display">sm<Grin />rtmouth</div>
        <div className="tv-top-mid">
          <SaltyBadge cue={view.salty} />
          <div className="spice-chip">
            Spice <b>{SPICE_LABEL[view.spice.effective]}</b>
            {capped && <span className="muted">— capped: {capReason(view)}</span>}
          </div>
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

        {view.setup ? <SetupPanel view={view} send={send} problem={problem} /> : <div className="games">
          <h2>Pick a game</h2>
          {view.games.map((g, i) => (
            <button key={g.id} className={`press game-card${g.ready ? '' : ' soon'}${i === 0 ? ' focus-first' : ''}`}
              onClick={() => send({ t: 'setup:pick', gameId: g.id })}>
              <span className="name display">{g.name}</span>
              <span className="pitch">{g.ready ? g.pitch : `${g.pitch} (coming soon)`}</span>
            </button>
          ))}
          <div className="notice">{problem ?? view.notice ?? ''}</div>
        </div>}
      </div>

      <div className={`tiles${view.players.length > 6 ? ' two-rows' : ''}`}>
        {view.players.map((p) => (
          <div key={p.id} className={`tile${p.connected ? '' : ' away'}`}>
            {view.ready.includes(p.id) && <span className="tile-badge"><Tick size={40} /></span>}
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

/**
 * Setting up the picked game on the TV (owner, 2026-11-27): the question difficulty, then Ready. Once the TV is ready
 * it waits for everyone to tap Ready on their phone; Back (the button, or the remote's Back) goes back to change things.
 * When everyone is ready, a 3-2-1 and the game starts.
 */
function SetupPanel({ view, send, problem }: { view: HostLobbyView; send: (m: ClientMsg) => void; problem: string | null }) {
  const s = view.setup!;
  const game = view.games.find((g) => g.id === s.gameId);
  const people = view.players.filter((p) => !p.isBot && p.connected);
  const readyPeople = people.filter((p) => s.ready.includes(p.id)).length;
  const [, tick] = useState(0);
  useEffect(() => {
    if (s.step !== 'countdown') return;
    const t = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(t);
  }, [s.step]);
  const secs = s.startsAt ? Math.max(1, Math.ceil((s.startsAt - serverNow()) / 1000)) : 0;
  return (
    <div className="games setup">
      <h2>{game?.name ?? 'Game'}{s.asksLevel && s.step !== 'options' ? ` · ${LEVEL_LABEL[s.level]} questions` : ''}</h2>
      {s.step === 'options' && (
        <>
          {s.asksLevel && (
            <>
              <div className="setup-label">How hard should the questions be?</div>
              <div className="setup-row">
                {LEVELS.map((l) => (
                  <button key={l} className="press setup-btn" aria-pressed={s.level === l} onClick={() => send({ t: 'setup:level', level: l })}>{LEVEL_LABEL[l]}</button>
                ))}
              </div>
            </>
          )}
          <button className="press setup-ready focus-first" onClick={() => send({ t: 'setup:ready' })}>Ready</button>
          <button className="press setup-back" onClick={() => send({ t: 'setup:back' })}>Back</button>
        </>
      )}
      {s.step === 'waiting' && (
        <>
          <div className="setup-wait">Everyone tap <b>Ready</b> on your phone</div>
          <div className="setup-count-line"><b>{readyPeople}</b> of {people.length} ready</div>
          <button className="press setup-back focus-first" onClick={() => send({ t: 'setup:back' })}>Back to change things</button>
        </>
      )}
      {s.step === 'countdown' && (
        <>
          <div className="setup-wait">Everyone's ready!</div>
          <div key={secs} className="setup-count display">{secs}</div>
          <button className="press setup-back focus-first" onClick={() => send({ t: 'setup:back' })}>Wait, go back</button>
        </>
      )}
      <div className="notice">{problem ?? view.notice ?? ''}</div>
    </div>
  );
}
