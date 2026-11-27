// Trivia on the TV (design guide §6 TV, ADR 0009). Drawn inside the 1920×1080 stage. The remote drives it:
// OK moves past a reveal, left/right/OK play a Little's turn, and Back opens the menu (handled in Host.tsx).
import { useEffect, useRef, useState } from 'react';
import type { ClientMsg, HostGameView, PublicSeat } from '@smartmouth/protocol';
import { BANDS, SPICE_LABEL } from '@smartmouth/protocol';
import type { TriviaHostView, TPublicQuestion } from '@smartmouth/game-trivia';
import { Blob, PictureCard, SlotShape, Tick } from '../../ui/art.tsx';
import { serverNow } from '../../socket.ts';
import { SaltyStrip } from '../../host/SaltyStrip.tsx';
import { sayClip, useSalty } from '../../host/voice.ts';
import { bang, bed, duck, fx, stopMusic } from './audio.ts';

/**
 * The round card starts this long before the leaderboard ends. It holds 2.5 s (owner, 2026-11-27), mostly over the end of
 * the leaderboard, so it covers the question appearing but only about the first second of its timer.
 */
const WIPE_LEAD_MS = 2100;
import { Confetti, RoundWipe, Sparkles, TitleCard } from './Transitions.tsx';
import { buzz, tick } from '../../host/sfx.ts';

export function TriviaHost({ view, send }: { view: HostGameView; send: (m: ClientMsg) => void }) {
  const g = view.game as TriviaHostView;
  const seat = (id: string) => view.players.find((p) => p.id === id);

  // OK on the remote: past an intro or reveal; back to the lobby from the final scores.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || g.stage === 'turn' || g.stage === 'question') return;
      send(g.stage === 'final' ? { t: 'admin:end' } : { t: 'admin:next' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [g.stage, send]);


  // Sound for each stage (the owner's picks): a bed under thinking, the leaderboard and the final; a sting as each
  // stage starts. Music ducks under Salty.
  const { talking } = useSalty(view.salty);
  /** The drum roll that just played had its own crash built in. */
  const rolled = useRef(false);
  useEffect(() => { duck(talking); }, [talking]);
  useEffect(() => () => stopMusic(), []);
  useEffect(() => {
    switch (g.stage) {
      case 'intro': bed(null); fx('start'); break;
      case 'question': bed('think'); break;
      // The drum roll builds while the answer is still hidden; the result lands with the reveal.
      // One generated roll-and-crash (four takes, rotating: owner, 2026-11-27) whose crash lands as the answer shows;
      // without one, the picked drum roll here and the separate bang at the reveal.
      case 'suspense': bed(null); rolled.current = fx('rollcrash', 0, 0.85); if (!rolled.current) fx('reveal', 0, 0.85); break;
      case 'reveal': {
        if (!rolled.current) bang();
        rolled.current = false;
        const graded = g.players.filter((p) => p.right !== null);
        const right = graded.filter((p) => p.right).length;
        if (graded.length && right === graded.length) { fx('right'); fx('applause', 0.2, 0.55); }
        else if (graded.length && right === 0) fx('allwrong');
        else fx('right');
        break;
      }
      case 'turn': fx('sparkle'); break;
      case 'turnReveal': if (g.turn && g.turn.picked === g.turn.correct) fx('yay', 0.3); break;
      case 'standings': bed('leaderboard'); fx('slide', 0.45, 0.6); fx('count', 0.6, 0.5); break;
      case 'final': bed('winner'); break;
    }
  }, [g.stage, g.round]);
  // The round card: due when the leaderboard is about to end (or at once, if a grown-up skipped it).
  const wipeRound = g.stage === 'standings' ? g.round + 1 : g.round;
  const [wipeSoon, setWipeSoon] = useState(false);
  useEffect(() => {
    setWipeSoon(false);
    if (g.stage !== 'standings' || !g.standingsEnd) return;
    const t = setTimeout(() => setWipeSoon(true), Math.max(0, g.standingsEnd - serverNow() - WIPE_LEAD_MS));
    return () => clearTimeout(t);
  }, [g.stage, g.standingsEnd]);
  // The whoosh rides the card in, whichever stage it starts in.
  const whooshed = useRef(0);
  useEffect(() => {
    const showing = (g.stage === 'standings' && wipeSoon) || (g.stage === 'question' && g.round > 1);
    if (showing && whooshed.current !== wipeRound) { whooshed.current = wipeRound; fx('round'); }
  }, [g.stage, wipeSoon, wipeRound, g.round]);

  // A click on the TV each time someone locks in.
  const locked = g.players.filter((p) => p.locked).length;
  const lastLocked = useRef(0);
  useEffect(() => {
    if (locked > lastLocked.current) fx('lock', 0, 0.5);
    lastLocked.current = locked;
  }, [locked]);

  return (
    <>
      <div className="tv-top">
        <div className="round-chip display">Round {Math.min(g.round, g.rounds)} of {g.rounds}</div>
        <div className="spice-chip">Spice <b>{SPICE_LABEL[view.spice.effective]}</b></div>
        <div className="join-chip">Join: <b>{view.joinUrl.replace(/^https?:\/\//, '').replace(/\/play\?code=.*$/, '')}</b> · <b>{view.code}</b></div>
      </div>

      <div className="tv-game">
        {g.stage === 'intro' && (g.round === 1 ? <TitleCard rounds={g.rounds} /> : <Intro round={g.round} rounds={g.rounds} />)}
        {(g.stage === 'question' || g.stage === 'suspense' || g.stage === 'reveal') && g.question && <QuestionBoard g={g} q={g.question} />}
        {(g.stage === 'turn' || g.stage === 'turnReveal') && g.turn && <Turn g={g} who={seat(g.turn.playerId)} send={send} answerClips={view.reads.turn?.answers ?? []} />}
        {g.stage === 'standings' && g.standings && <Standings g={g} seat={seat} />}
        {g.stage === 'final' && g.final && <Final g={g} seat={seat} />}
        {/* Transitions over the game area (owner, 2026-11-27). */}
        {/* The round card sweeps in over the end of the leaderboard and off over the new question (same key across
            both stages, so its animation runs straight through). */}
        {((g.stage === 'standings' && wipeSoon) || (g.stage === 'question' && g.round > 1)) && (
          <RoundWipe key={`wipe-${wipeRound}`} round={wipeRound} rounds={g.rounds} category={g.stage === 'question' ? g.question?.category ?? null : g.nextCategory} />
        )}
        {g.stage === 'reveal' && <div key={`bang-${g.round}`} className="bang-flash" aria-hidden="true" />}
        {g.stage === 'reveal' && allRight(g) && <Confetti seed={`right-${g.round}`} />}
        {g.stage === 'turn' && <Sparkles seed={`turn-${g.round}`} />}
        {g.stage === 'turnReveal' && g.turn && g.turn.picked === g.turn.correct && <Confetti seed={`little-${g.round}`} count={50} />}
        {g.stage === 'final' && <Confetti seed="final" count={110} />}
      </div>

      <SaltyStrip cue={view.salty} />

      <div className={`tiles compact${view.players.length > 6 ? ' two-rows' : ''}`}>
        {view.players.map((p) => {
          const st = g.players.find((x) => x.id === p.id);
          return (
            <div key={p.id} className={`tile${p.connected ? '' : ' away'}${st?.right === true ? ' right' : st?.right === false ? ' wrong' : ''}`}>
              {st?.locked && <span className="tile-badge"><Tick size={40} /></span>}
              <Blob avatar={p.avatar} color={p.color} />
              <div className="name">{p.name}</div>
              <div className="band">
                {st?.gained ? <b className="gain">+{st.gained}</b> : null} {st?.score ?? 0}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Everyone who answered got it right. */
function allRight(g: TriviaHostView): boolean {
  const graded = g.players.filter((p) => p.right !== null);
  return graded.length > 0 && graded.every((p) => p.right);
}

function Intro({ round, rounds }: { round: number; rounds: number }) {
  return (
    <div className="tv-intro">
      <div className="display big">Trivia</div>
      <div className="display">{round === 1 ? `${rounds} rounds. Phones out.` : `Round ${round}`}</div>
    </div>
  );
}

function Countdown({ deadline, opensAt }: { deadline: number; opensAt: number }) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - Math.max(serverNow(), opensAt)));
  const total = useRef(Math.max(1, deadline - Math.max(serverNow(), opensAt)));
  useEffect(() => {
    total.current = Math.max(1, deadline - Math.max(serverNow(), opensAt));
    const id = setInterval(() => setLeft(Math.max(0, deadline - Math.max(serverNow(), opensAt))), 200);
    return () => clearInterval(id);
  }, [deadline]);
  const secs = Math.ceil(left / 1000);
  // The last five seconds tick and pulse; zero buzzes (owner, 2026-11-27). A deadline already under 5 s when the
  // board appears (a reconnect) still ticks from where it is.
  const lastSec = useRef<number | null>(null);
  useEffect(() => {
    if (lastSec.current === secs) return;
    const first = lastSec.current === null;
    lastSec.current = secs;
    if (first && secs > 5) return;
    if (secs >= 1 && secs <= 5) { if (!fx('tick', 0, secs <= 1 ? 0.9 : 0.7)) tick(secs); }
    else if (secs === 0 && !first) { if (!fx('timeup')) buzz(); }
  }, [secs]);
  const frac = left / total.current;
  const r = 52;
  const c = 2 * Math.PI * r;
  const late = secs <= 5;
  return (
    <div className={`timer${late ? ' late' : ''}`} aria-label={`${secs} seconds left`}>
      {/* Re-keyed every second in the last five, so the pulse replays on each tick. */}
      <div key={late ? secs : 'calm'} className={`timer-face${late && secs > 0 ? ' pulse' : ''}`}>
        <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r={r} className="track" /><circle cx="60" cy="60" r={r} className="fill"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 60 60)" /></svg>
        <span className="display">{secs}</span>
      </div>
    </div>
  );
}

function QuestionBoard({ g, q }: { g: TriviaHostView; q: TPublicQuestion }) {
  return (
    <div className={`board${g.stage === 'suspense' ? ' suspense' : ''}`}>
      <div className="board-head">
        <span className="cat-chip">{q.category}</span>
        {g.splitBands && <span className="split-chip">Everyone's got their own question on their phone</span>}
        {g.stage === 'question' && g.deadline && <Countdown deadline={g.deadline} opensAt={g.opensAt ?? 0} />}
      </div>
      <div className="q-text display">{q.prompt}</div>
      <div className={`answers n${q.answers.length}`}>
        {q.answers.map((a, i) => (
          <div key={i} className={`answer${g.correct === null ? '' : i === g.correct ? ' correct' : ' dim'}`}>
            <SlotShape slot={i} size={64} />
            <span>{a.text}</span>
            {g.correct === i && <Tick size={56} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function Turn({ g, who, send, answerClips }: {
  g: TriviaHostView; who: PublicSeat | undefined; send: (m: ClientMsg) => void; answerClips: Array<string | null>;
}) {
  const t = g.turn!;
  const [focus, setFocus] = useState(0);
  const n = t.question.answers.length;
  useEffect(() => setFocus(0), [t.question.prompt]);
  // Salty reads each picture's name as the remote lands on it (ADR 0009).
  const moved = useRef(false);
  useEffect(() => {
    if (g.stage !== 'turn') return;
    if (moved.current) sayClip(answerClips[focus]);
    moved.current = true;
  }, [focus, g.stage]);
  useEffect(() => {
    if (g.stage !== 'turn') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setFocus((f) => (f + n - 1) % n);
      else if (e.key === 'ArrowRight') setFocus((f) => (f + 1) % n);
      else if (e.key === 'Enter') send({ t: 'game:intent', intent: { type: 'answerFor', playerId: t.playerId, choice: focus } });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [g.stage, n, focus, t.playerId, send]);

  const band = BANDS.find((b) => b.id === who?.band)?.label ?? '';
  return (
    <div className="turn">
      <div className="turn-banner" style={{ background: who?.color }}>
        {who && <Blob avatar={who.avatar} color={who.color} />}
        <span className="display">{who?.name ?? 'Little'}'s turn!</span>
        <span className="turn-band">{band}</span>
      </div>
      <div className="q-text display small">{t.question.prompt}</div>
      <div className="pics">
        {t.question.answers.map((a, i) => {
          const state = t.correct === null ? (g.stage === 'turn' && i === focus ? ' focused' : '') : i === t.correct ? ' correct' : ' dim';
          return (
            <button key={i} className={`pic${state}`} tabIndex={-1} onClick={() => send({ t: 'game:intent', intent: { type: 'answerFor', playerId: t.playerId, choice: i } })}>
              <PictureCard text={a.text} image={a.image} index={i} />
              <span className="pic-label">{a.text}</span>
            </button>
          );
        })}
      </div>
      <div className="turn-help">
        {g.stage === 'turn' ? `Left and right on the remote, OK to pick. Or tap on a phone.${t.helpers ? ` ${t.helpers} helper${t.helpers === 1 ? '' : 's'} locked in.` : ''}` : ''}
      </div>
    </div>
  );
}

/**
 * The leaderboard between rounds (owner, 2026-11-27). Rows start in last round's order, then slide to where they stand
 * now while each score counts up, so the room sees who moved.
 */
function Standings({ g, seat }: { g: TriviaHostView; seat: (id: string) => PublicSeat | undefined }) {
  const rows = g.standings!;
  const before = [...rows].sort((a, b) => a.prevRank - b.prevRank || (b.score - b.gained) - (a.score - a.gained)).map((r) => r.id);
  const [settled, setSettled] = useState(false);
  const [t, setT] = useState(0);
  useEffect(() => {
    setSettled(false); setT(0);
    const go = setTimeout(() => setSettled(true), 450);
    const start = performance.now() + 450;
    let raf = 0;
    const step = (now: number) => { const k = Math.min(1, Math.max(0, (now - start) / 1100)); setT(k); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => { clearTimeout(go); cancelAnimationFrame(raf); };
  }, [g.round]);
  const many = rows.length > 6;
  const rowH = many ? 58 : 92;
  const gap = many ? 8 : 14;
  return (
    <div className={`standings${many ? ' many' : ''}`}>
      <div className="standings-head">
        <div className="display big">Leaderboard</div>
        <div className="sub">After round {g.round} of {g.rounds} · up next: round {g.round + 1}</div>
      </div>
      <div className="standings-list" style={{ height: rows.length * (rowH + gap) - gap }}>
        {rows.map((r, i) => {
          const p = seat(r.id);
          const at = settled ? i : before.indexOf(r.id);
          const shown = Math.round(r.score - r.gained * (1 - t));
          const moved = r.prevRank - r.rank;
          return (
            <div key={r.id} className={`st-row${r.rank === 1 ? ' first' : ''}`} style={{ height: rowH, transform: `translateY(${at * (rowH + gap)}px)` }}>
              <span className="rank display">{r.rank}</span>
              {p && <Blob avatar={p.avatar} color={p.color} />}
              <span className="name">{p?.name ?? 'Gone home'}</span>
              {settled && moved !== 0 && <span className={`move ${moved > 0 ? 'up' : 'down'}`}>{moved > 0 ? '▲' : '▼'} {Math.abs(moved)}</span>}
              {r.gained > 0 && <span className="gain display">+{r.gained}</span>}
              <span className="pts display">{shown}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Final({ g, seat }: { g: TriviaHostView; seat: (id: string) => PublicSeat | undefined }) {
  const stars = g.final!.filter((r) => r.superstar);
  return (
    <div className="final">
      <div className="final-list">
        {g.final!.map((r) => {
          const p = seat(r.id);
          return (
            <div key={r.id} className={`final-row${r.rank === 1 ? ' first' : ''}`}>
              <span className="rank display">{r.rank}</span>
              {p && <Blob avatar={p.avatar} color={p.color} />}
              <span className="name">{p?.name ?? 'Gone home'}</span>
              {r.superstar && <span className="star-badge">Superstar</span>}
              <span className="pts display">{r.score}</span>
            </div>
          );
        })}
      </div>
      {stars.length > 0 && (
        <div className="superstars">
          <div className="display">Superstar{stars.length > 1 ? 's' : ''}!</div>
          {stars.map((s) => <div key={s.id}>{seat(s.id)?.name}</div>)}
        </div>
      )}
      <div className="final-help">Press OK for the lobby</div>
    </div>
  );
}
