// The phone controller (design guide §6 Phone). Join in one screen, then "look at the TV".
import { useState } from 'react';
import {
  AVATAR_COUNT, BANDS, DRAMAS, LENGTHS, LENGTH_LABEL, LENGTH_QUESTIONS, type GameLength, MAX_PLAYERS, NAME_MAX, PLAYER_COLORS, SPICES, SPICE_LABEL, VOICES, VOICE_LABEL, spiceAllows, type Drama, type VoiceId,
  type Band, type PlayerView, type ServerMsg, type Spice,
} from '@smartmouth/protocol';
import { useSocket, store, save } from '../socket.ts';
import { BandIcon, Blob } from '../ui/art.tsx';
import { TriviaController } from '../games/trivia/TriviaController.tsx';
import { SnakesController } from '../games/snakes/SnakesController.tsx';

const seatKey = (code: string) => `smartmouth.seat.${code}`;
const LAST_NAME = 'smartmouth.name';

export function Play() {
  const initialCode = (new URLSearchParams(location.search).get('code') ?? store('smartmouth.lastCode') ?? '')
    .toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const [code, setCode] = useState(initialCode);
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The blob picker shows once, right after joining; a reload or reconnect goes straight back to the seat.
  const [pickedAvatar, setPickedAvatar] = useState(true);

  const { status, send } = useSocket(
    () => {
      const token = code.length === 4 ? store(seatKey(code)) : null;
      return token ? { t: 'player:resume', code, token } : null;
    },
    (m: ServerMsg) => {
      if (m.t === 'player:welcome') {
        save(seatKey(m.code), m.token);
        save('smartmouth.lastCode', m.code);
        setError(null);
      } else if (m.t === 'view' && m.view.role === 'player') {
        setView(m.view);
      } else if (m.t === 'error') {
        if (m.code === 'bad-token' || m.code === 'kicked') { save(seatKey(code), null); setView(null); }
        setError(m.message);
      }
    },
  );

  if (!view) {
    return <Join code={code} setCode={setCode} error={error} online={status === 'open'}
      onJoin={(name, band) => {
        save(LAST_NAME, name);
        setPickedAvatar(false);
        send({ t: 'player:join', code, name, band, avatar: Math.floor(Math.random() * AVATAR_COUNT) });
      }} />;
  }
  if (!pickedAvatar) {
    return <AvatarPick view={view} onPick={(a) => { send({ t: 'player:avatar', avatar: a }); setPickedAvatar(true); }}
      onSkip={() => setPickedAvatar(true)} />;
  }
  if (view.phase === 'game' && view.gameId === 'snakes') return <SnakesController view={view} send={send} />;
  if (view.phase === 'game') return <TriviaController view={view} send={send} />;
  return <Waiting view={view} send={send} online={status === 'open'} onLeave={() => {
    send({ t: 'player:leave' }); save(seatKey(view.code), null); setView(null);
  }} />;
}

function Join({ code, setCode, error, online, onJoin }: {
  code: string; setCode: (c: string) => void; error: string | null; online: boolean;
  onJoin: (name: string, band: Band) => void;
}) {
  const [name, setName] = useState(store(LAST_NAME) ?? '');
  const [band, setBand] = useState<Band | null>(null);
  const ready = code.length === 4 && name.trim().length > 0 && band !== null && online;
  return (
    <form className="phone" onSubmit={(e) => { e.preventDefault(); if (ready && band) onJoin(name.trim(), band); }}>
      <h1 className="display">Join the game</h1>
      <label>Room code (it's on the TV)
        <input className="field code" value={code} inputMode="text" autoCapitalize="characters" autoComplete="off"
          maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))} />
      </label>
      <label>Your name
        <input className="field" value={name} maxLength={NAME_MAX} autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
      </label>
      <div>
        <label as-label="true">How old are you?</label>
        <div className="bands" role="group" aria-label="How old are you?" style={{ marginTop: 8 }}>
          {BANDS.map((b) => (
            <button type="button" key={b.id} className="press band-btn" aria-pressed={band === b.id} onClick={() => setBand(b.id)}>
              <BandIcon band={b.id} />
              <span className="label">{b.label}</span>
              <span className="ages">{b.ages}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="error" role="alert">{error ?? (online ? '' : 'Connecting…')}</div>
      <button className="press primary big-btn" type="submit" disabled={!ready}>Join</button>
    </form>
  );
}

function AvatarPick({ view, onPick, onSkip }: { view: PlayerView; onPick: (a: number) => void; onSkip: () => void }) {
  return (
    <div className="phone">
      <h1 className="display">Pick your blob</h1>
      <div className="avatars">
        {Array.from({ length: AVATAR_COUNT }, (_, a) => (
          <button key={a} className="press avatar-btn" aria-pressed={view.you.avatar === a} aria-label={`Blob ${a + 1}`}
            onClick={() => onPick(a)} style={{ background: 'var(--stage)' }}>
            <Blob avatar={a} color={view.you.color ?? PLAYER_COLORS[0]} />
          </button>
        ))}
      </div>
      <button className="press big-btn" onClick={onSkip}>Skip</button>
    </div>
  );
}

function Waiting({ view, send, online, onLeave }: {
  view: PlayerView; send: ReturnType<typeof useSocket>['send']; online: boolean; onLeave: () => void;
}) {
  const [sheet, setSheet] = useState(false);
  return (
    <div className="phone" style={{ background: `color-mix(in srgb, ${view.you.color} 14%, var(--ink))` }}>
      {!online && <div className="status-dot">reconnecting…</div>}
      <div className="waiting">
        <Blob avatar={view.you.avatar} color={view.you.color} />
        <div className="display" style={{ fontSize: 34 }}>{view.you.name}</div>
        {view.phase === 'lobby' && view.setup && view.setup.step !== 'options' ? (
          <ReadyButton ready={view.setup.ready.includes(view.you.id)} countdown={view.setup.step === 'countdown'}
            onReady={(r) => send({ t: 'player:ready', ready: r })} />
        ) : <div className="look display">{view.phase === 'lobby' && view.setup ? 'The TV is setting up a game' : 'Look at the TV'}</div>}
        <div className="muted">{view.playerCount} in room {view.code}</div>
      </div>
      {view.you.isAdmin && (
        <>
          <button className="press big-btn" onClick={() => setSheet((s) => !s)}>{sheet ? 'Close grown-up controls' : 'Grown-up controls'}</button>
          {sheet && <AdminSheet view={view} onSpice={(s) => send({ t: 'admin:spice', spice: s })} onVoice={(v) => send({ t: 'admin:voice', voice: v })}
            onDrama={(d) => send({ t: 'admin:drama', drama: d })} onLength={(n) => send({ t: 'admin:length', length: n })} onBots={(add) => send({ t: 'admin:bots', add })} />}
        </>
      )}
      <button className="press" style={{ padding: 12 }} onClick={onLeave}>Leave the game</button>
    </div>
  );
}

function AdminSheet({ view, onSpice, onVoice, onDrama, onLength, onBots }: {
  view: PlayerView; onSpice: (s: Spice) => void; onVoice: (v: VoiceId) => void; onDrama: (d: Drama) => void; onLength: (n: GameLength) => void; onBots: (add: boolean) => void;
}) {
  return (
    <div className="sheet">
      <h2>Spice level</h2>
      <div className="spice-row">
        {SPICES.map((s) => (
          <button key={s} className="press" aria-pressed={view.spice.chosen === s} disabled={!spiceAllows(view.spice.cap, s)}
            onClick={() => onSpice(s)}>{SPICE_LABEL[s]}</button>
        ))}
      </div>
      <div className="muted">
        {view.spice.cap === 'filthy'
          ? 'Grown-ups only, so anything goes. Filthy means real swearing.'
          : `Capped at ${SPICE_LABEL[view.spice.cap]} because of the youngest player in the room.`}
      </div>
      <h2>Game length</h2>
      <div className="spice-row">
        {LENGTHS.map((n) => (
          <button key={n} className="press" aria-pressed={view.length === n} onClick={() => onLength(n)}>{LENGTH_LABEL[n]} · {LENGTH_QUESTIONS[n]}</button>
        ))}
      </div>
      <div className="muted">Questions in the next trivia game.</div>
      <h2>Drama</h2>
      <div className="spice-row">
        {DRAMAS.map((d) => (
          <button key={d} className="press" aria-pressed={view.drama === d} onClick={() => onDrama(d)}>{d === 'full' ? 'Full drama' : 'Quick'}</button>
        ))}
      </div>
      <div className="muted">For Snake Manor's big reveals. Quick cuts the long pauses short. Starts with the next game.</div>
      {view.phase === 'lobby' && (
        <>
          <h2>House bots</h2>
          <div className="spice-row">
            <button className="press" disabled={view.playerCount >= MAX_PLAYERS} onClick={() => onBots(true)}>Add a bot</button>
            <button className="press" onClick={() => onBots(false)}>Remove bots</button>
          </div>
          <div className="muted">Bots fill seats so you can try a game with fewer people (Snake Manor needs 5). They play by simple rules, not real tactics.</div>
        </>
      )}
    </div>
  );
}

/** Ready-up on the phone while the TV waits for everyone (owner, 2026-11-27). Tap again to un-ready. */
function ReadyButton({ ready, countdown, onReady }: { ready: boolean; countdown: boolean; onReady: (r: boolean) => void }) {
  return (
    <div className="ready-box">
      <button className={`press big-btn ready-btn${ready ? ' is-ready' : ''}`} onClick={() => onReady(!ready)}>
        {ready ? 'Ready ✓' : "I'm ready!"}
      </button>
      <div className="muted">{countdown ? 'Starting…' : ready ? 'Waiting for everyone else. Tap again if you need a sec.' : 'The game starts when everyone is ready.'}</div>
    </div>
  );
}
