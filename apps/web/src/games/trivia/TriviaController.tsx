// Trivia on a phone (design guide §6 Phone). The question lives on the TV unless yours is different; the phone is
// for tapping. A Little's phone becomes kid mode on their turn: pictures only (ADR 0009).
import { useEffect, useState } from 'react';
import type { ClientMsg, PlayerGameView } from '@smartmouth/protocol';
import type { TriviaPlayerView } from '@smartmouth/game-trivia';
import { PictureCard, SLOTS, SlotShape, Tick } from '../../ui/art.tsx';
import { serverNow } from '../../socket.ts';

export function TriviaController({ view, send }: { view: PlayerGameView; send: (m: ClientMsg) => void }) {
  const g = view.game as TriviaPlayerView;
  const answer = (choice: number) => send({ t: 'game:intent', intent: { type: 'answer', choice } });
  const turnName = g.turn ? view.players.find((p) => p.id === g.turn?.playerId)?.name ?? 'the little one' : '';

  let body: React.ReactNode;
  if (g.stage === 'intro') {
    body = <Center big={`Round ${g.round} of ${g.rounds}`} small="Look at the TV" />;
  } else if (g.stage === 'question') {
    if (!g.question) body = <Center big="Watch the TV" small={view.you.band === 'little' ? 'Your turn is coming!' : 'Sit this one out.'} />;
    else if (g.picked !== null) body = <Locked slot={g.picked} text={g.question.answers[g.picked]?.text ?? ''} />;
    else body = (
      <div className="ctl-q">
        {g.deadline && <TimeBar deadline={g.deadline} />}
        {g.showPrompt ? <div className="ctl-prompt">{g.question.prompt}</div> : <div className="ctl-look">The question is on the TV</div>}
        <div className="ctl-answers">
          {g.question.answers.map((a, i) => (
            <button key={i} className="press ctl-answer" onClick={() => answer(i)}>
              <SlotShape slot={i} size={40} /><span>{a.text}</span>
            </button>
          ))}
        </div>
      </div>
    );
  } else if (g.stage === 'reveal') {
    body = g.result ? <Result right={g.result.right} gained={g.result.gained} correctText={g.result.correctText} score={g.score} rank={g.rank} />
      : <Center big="Look at the TV" small={`You have ${g.score} points`} />;
  } else if ((g.stage === 'turn' || g.stage === 'turnReveal') && g.turn) {
    const t = g.turn;
    if (t.isMe) {
      body = g.stage === 'turn' ? (
        <div className="kid-mode">
          {t.question.answers.map((a, i) => (
            <button key={i} className="press kid-pic" onClick={() => answer(i)} aria-label={a.text}>
              <PictureCard text={a.text} image={a.image} index={i} />
            </button>
          ))}
        </div>
      ) : (
        <Center big={t.picked === t.correct ? 'Yay!' : 'So close!'} small={t.picked === t.correct ? 'You got it!' : 'Look at the TV'} star={t.picked === t.correct} />
      );
    } else if (g.stage === 'turn') {
      body = t.picked !== null ? <Center big="Locked in" small={`Rooting for ${turnName}`} /> : (
        <div className="ctl-q">
          <div className="ctl-prompt">It's {turnName}'s turn. Think you know? Guess too for a helper bonus.</div>
          <div className="ctl-answers">
            {t.question.answers.map((a, i) => (
              <button key={i} className="press ctl-answer" onClick={() => answer(i)}><SlotShape slot={i} size={40} /><span>{a.text}</span></button>
            ))}
          </div>
        </div>
      );
    } else {
      body = g.result ? <Result right gained={g.result.gained} correctText={g.result.correctText} score={g.score} rank={g.rank} helper />
        : <Center big="Look at the TV" small={`You have ${g.score} points`} />;
    }
  } else if (g.stage === 'standings') {
    const place = g.rank === 1 ? '1st' : g.rank === 2 ? '2nd' : g.rank === 3 ? '3rd' : `${g.rank}th`;
    body = <Center big={g.rank === 1 ? "You're in the lead!" : `You're in ${place}`} small={`${g.score} points · look at the TV`} star={g.rank === 1} />;
  } else if (g.stage === 'final' && g.final) {
    body = g.final.superstar
      ? <Center big="Superstar!" small={`${g.score} points`} star />
      : <Center big={g.final.rank === 1 ? 'You win!' : `#${g.final.rank} of ${g.final.of}`} small={`${g.score} points`} star={g.final.rank === 1} />;
  } else {
    body = <Center big="Look at the TV" small="" />;
  }

  const kidMode = g.turn?.isMe && g.stage === 'turn';
  return (
    <div className={`phone game${kidMode ? ' kid' : ''}`} style={{ background: `color-mix(in srgb, ${view.you.color} 20%, var(--ink))` }}>
      {!kidMode && (
        <div className="ctl-top"><span>{view.you.name}</span><span className="display">{g.score}</span></div>
      )}
      {body}
      {view.you.isAdmin && !kidMode && (
        <div className="ctl-admin">
          {g.stage !== 'final' && g.stage !== 'question' && <button className="press" onClick={() => send({ t: 'admin:next' })}>Next</button>}
          {g.stage === 'question' && <button className="press" onClick={() => send({ t: 'admin:next' })}>Reveal now</button>}
          <button className="press" onClick={() => send({ t: 'admin:end' })}>{g.stage === 'final' ? 'Back to the lobby' : 'End game'}</button>
        </div>
      )}
    </div>
  );
}

function Center({ big, small, star }: { big: string; small: string; star?: boolean }) {
  return (
    <div className="waiting">
      {star && <svg viewBox="0 0 100 100" width="140" height="140" aria-hidden="true"><path d="M50 6 L62 37 L95 38 L69 58 L79 91 L50 72 L21 91 L31 58 L5 38 L38 37 Z" fill="var(--spot)" stroke="var(--ink)" strokeWidth="5" strokeLinejoin="round" /></svg>}
      <div className="look display">{big}</div>
      {small && <div className="muted">{small}</div>}
    </div>
  );
}

function Locked({ slot, text }: { slot: number; text: string }) {
  const color = SLOTS[slot % SLOTS.length]?.color ?? 'var(--spot)';
  return (
    <div className="locked" style={{ background: color }}>
      <Tick size={96} />
      <div className="display">Locked in</div>
      <div>{text}</div>
    </div>
  );
}

function Result({ right, gained, correctText, score, rank, helper }: {
  right: boolean; gained: number; correctText: string; score: number; rank: number; helper?: boolean;
}) {
  return (
    <div className={`result ${right ? 'right' : 'wrong'}`}>
      <div className="display big">{right ? (helper ? 'Nice help!' : 'Right!') : 'Nope'}</div>
      {gained > 0 && <div className="display">+{gained}</div>}
      {!right && <div>It was <b>{correctText}</b></div>}
      <div className="muted">{score} points · #{rank}</div>
    </div>
  );
}

function TimeBar({ deadline }: { deadline: number }) {
  const [frac, setFrac] = useState(1);
  useEffect(() => {
    const total = Math.max(1, deadline - serverNow());
    const id = setInterval(() => setFrac(Math.max(0, (deadline - serverNow()) / total)), 200);
    return () => clearInterval(id);
  }, [deadline]);
  return <div className="timebar"><span style={{ width: `${frac * 100}%`, background: frac < 0.25 ? 'var(--hot)' : 'var(--spot)' }} /></div>;
}
