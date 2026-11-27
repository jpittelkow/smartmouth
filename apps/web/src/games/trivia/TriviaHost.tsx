// Trivia on the TV (design guide §6 TV, ADR 0009). Drawn inside the 1920×1080 stage. The remote drives it:
// OK moves past a reveal, left/right/OK play a Little's turn, and Back opens the menu (handled in Host.tsx).
import { useEffect, useRef, useState } from 'react';
import type { ClientMsg, HostGameView, PublicSeat } from '@smartmouth/protocol';
import { BANDS, SPICE_LABEL } from '@smartmouth/protocol';
import type { TriviaHostView, TPublicQuestion } from '@smartmouth/game-trivia';
import { Blob, PictureCard, SlotShape, Tick } from '../../ui/art.tsx';
import { serverNow } from '../../socket.ts';
import { SaltyStrip } from '../../host/SaltyStrip.tsx';
import { sayClip } from '../../host/voice.ts';

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


  return (
    <>
      <div className="tv-top">
        <div className="round-chip display">Round {Math.min(g.round, g.rounds)} of {g.rounds}</div>
        <div className="spice-chip">Spice <b>{SPICE_LABEL[view.spice.effective]}</b></div>
        <div className="join-chip">Join: <b>{view.joinUrl.replace(/^https?:\/\//, '').replace(/\/play\?code=.*$/, '')}</b> · <b>{view.code}</b></div>
      </div>

      <div className="tv-game">
        {g.stage === 'intro' && <Intro round={g.round} rounds={g.rounds} />}
        {(g.stage === 'question' || g.stage === 'reveal') && g.question && <QuestionBoard g={g} q={g.question} />}
        {(g.stage === 'turn' || g.stage === 'turnReveal') && g.turn && <Turn g={g} who={seat(g.turn.playerId)} send={send} answerClips={view.reads.turn?.answers ?? []} />}
        {g.stage === 'final' && g.final && <Final g={g} seat={seat} />}
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

function Intro({ round, rounds }: { round: number; rounds: number }) {
  return (
    <div className="tv-intro">
      <div className="display big">Trivia</div>
      <div className="display">{round === 1 ? `${rounds} rounds. Phones out.` : `Round ${round}`}</div>
    </div>
  );
}

function Countdown({ deadline }: { deadline: number }) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - serverNow()));
  const total = useRef(Math.max(1, deadline - serverNow()));
  useEffect(() => {
    total.current = Math.max(1, deadline - serverNow());
    const id = setInterval(() => setLeft(Math.max(0, deadline - serverNow())), 200);
    return () => clearInterval(id);
  }, [deadline]);
  const frac = left / total.current;
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className={`timer${left < 5000 ? ' late' : ''}`} aria-label={`${Math.ceil(left / 1000)} seconds left`}>
      <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r={r} className="track" /><circle cx="60" cy="60" r={r} className="fill"
        strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 60 60)" /></svg>
      <span className="display">{Math.ceil(left / 1000)}</span>
    </div>
  );
}

function QuestionBoard({ g, q }: { g: TriviaHostView; q: TPublicQuestion }) {
  return (
    <div className="board">
      <div className="board-head">
        <span className="cat-chip">{q.category}</span>
        {g.splitBands && <span className="split-chip">Everyone's got their own question on their phone</span>}
        {g.stage === 'question' && g.deadline && <Countdown deadline={g.deadline} />}
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
