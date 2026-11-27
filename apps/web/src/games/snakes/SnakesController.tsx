// Snake Manor on the phone (ADR 0022, 0023, design guide §8). Every secret on this screen is the player's own.
// Two rules keep a glance from the next seat useless: the role shows only while a thumb holds it, and the night
// screen is one component for every role, so its layout can't differ.
import { useEffect, useRef, useState } from 'react';
import type { ClientMsg, PlayerGameView, PublicSeat } from '@smartmouth/protocol';
import { TEXT_MAX } from '@smartmouth/protocol';
import type { NightScreen, SnakesPlayerView } from '@smartmouth/game-snakes';
import { Arms, Mark, clock, useLeft } from './arms.tsx';
import './fonts.ts';
import './snakes.css';

type Send = (m: ClientMsg) => void;
type Seat = (id: string) => PublicSeat | undefined;

export function SnakesController({ view, send }: { view: PlayerGameView; send: Send }) {
  const g = view.game as SnakesPlayerView;
  const seat: Seat = (id) => view.players.find((p) => p.id === id);
  const act = (intent: unknown) => send({ t: 'game:intent', intent });
  const me = g.me;
  const night = g.stage === 'night';
  const [drawer, setDrawer] = useState(false);

  return (
    <div className={`sm-phone${night ? ' night' : ''}${me?.status === 'ghost' ? ' ghost' : ''}`}
      style={night ? undefined : { ['--tint' as string]: tintOf(view.you.color) }}>
      <Header view={view} g={g} onHold={() => setDrawer((d) => !d)} />
      {!night && <TimeBar deadline={g.deadline} />}
      {night && <TimeBar deadline={g.deadline} dim />}

      {!view.paused && !g.spectator && me && <Guide g={g} seat={seat} />}
      <main className="sm-ph-main">
        {view.paused && <Message big="Paused" say="A grown-up paused the game. Every clock has stopped; nobody loses a second." />}
        {!view.paused && g.spectator && <Message big="Watching" say="You joined after the game began. Watch the TV, and join the next one." />}
        {!view.paused && !g.spectator && me && <Body g={g} view={view} seat={seat} act={act} />}
      </main>

      {drawer && me && <Drawer g={g} seat={seat} act={act} onClose={() => setDrawer(false)} admin={view.you.isAdmin ? { paused: view.paused, send } : null} />}
      {/* No admin bar at night: every phone must look the same (ADR 0023). */}
      {view.you.isAdmin && (!night || view.paused) && <Admin g={g} send={send} paused={view.paused} />}
    </div>
  );
}

const tintOf = (color: string) => color;

function Header({ view, g, onHold }: { view: PlayerGameView; g: SnakesPlayerView; onHold: () => void }) {
  const hold = useHold(onHold, 900);
  return (
    <header className="sm-me">
      <span className="hold-arms" {...hold} aria-label="Hold for more">
        <Arms color={view.you.color} size={30} faded={g.me?.status !== 'alive' && !!g.me} />
      </span>
      <b>{view.you.name}</b>
      <span className="where">{stageLabel(g)}</span>
    </header>
  );
}

/**
 * What to do on this screen, and what happens next, in plain words. At night it says the same thing to everyone
 * (ADR 0023): the words can't hint at a role.
 */
export function phoneGuide(g: SnakesPlayerView, seat: Seat, left: number): { title: string; body: string } {
  const me = g.me;
  const ghost = me?.status === 'ghost';
  const m = g.mission;
  const secs = (ms: number) => `${Math.max(0, Math.ceil(ms / 1000))} s`;
  switch (g.stage) {
    case 'deal': return { title: 'Your secret role', body: 'Hold the card below to see it. Keep it to yourself. The first mission starts in a moment.' };
    case 'mission':
      if (m?.step === 'tally') return { title: 'Look at the TV', body: 'The count for that question: the total only, never who.' };
      if (m?.question) return { title: ghost ? 'Answer (you still count, Ghost)' : 'Answer the question', body: `Tap your answer. Right answers add crowns to the pot. ${secs(left)} left.` };
      return { title: 'Watch the TV', body: 'Not your turn. Someone else is answering.' };
    case 'missionReveal': return { title: 'Look at the TV', body: 'Did the mission hit its target? Next: the Round Table.' };
    case 'debate': return { title: 'Talk it out loud', body: `Argue at the table: who sank the mission? Who is lying? The vote opens in ${secs(left)}.` };
    case 'vote':
      if (!g.vote?.canVote) return { title: 'No vote this time', body: ghost ? 'Ghosts watch the vote.' : 'A Dagger silenced you for this vote. Argue anyway.' };
      return { title: g.vote.mine ? 'Vote sealed' : 'Vote now', body: g.vote.mine ? 'Your letter is on the table. Watch them open on the TV.' : `Pick who should be shown the door, then seal it. It stays secret until the letters open. ${secs(left)} left.` };
    case 'voteReveal': return { title: 'Watch the TV', body: 'The letters open one at a time.' };
    case 'banish': return { title: 'Watch the TV', body: 'Who leaves, and what they really were.' };
    case 'night': return ghost
      ? { title: 'Night', body: 'Ghosts bet on who the Snakes are. Bets are revealed at the end.' }
      : { title: 'Night', body: `Write in the box, pick a name below, then Lock. Every phone looks like this. ${secs(left)} left.` };
    case 'breakfast': return { title: 'Morning', body: 'Look at the TV: who made it through the night?' };
    case 'endVote': return { title: 'End it, or banish again?', body: 'The game ends only if every one of you picks End.' };
    case 'unmask': return { title: 'The unmasking', body: 'Watch the TV: who was who.' };
    case 'final': return { title: g.final?.won ? 'You won' : 'Game over', body: 'Watch the TV for the full story.' };
    default: return { title: '', body: '' };
  }
}

function Guide({ g, seat }: { g: SnakesPlayerView; seat: Seat }) {
  const { left } = useLeft(g.deadline);
  const { title, body } = phoneGuide(g, seat, left);
  if (!title) return null;
  return <div className="sm-guide"><b>{title}</b><span>{body}</span></div>;
}

const stageLabel = (g: SnakesPlayerView) => ({
  deal: 'Your role', mission: 'Mission', missionReveal: 'Mission', debate: 'Round Table', vote: 'Round Table',
  voteReveal: 'Round Table', banish: 'Round Table', night: 'Night', breakfast: 'Breakfast', endVote: 'The last table',
  unmask: 'Unmasking', final: 'The end',
}[g.stage]);

function TimeBar({ deadline, dim = false }: { deadline: number | null; dim?: boolean }) {
  const { share } = useLeft(deadline);
  return <div className={`sm-bar${dim ? ' dim' : ''}`}><i style={{ width: `${deadline ? share * 100 : 0}%` }} /></div>;
}

/** Press and hold: calls `fn` once the hold has lasted `ms`. */
function useHold(fn: () => void, ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  return {
    onPointerDown: () => { stop(); timer.current = setTimeout(() => { fn(); stop(); }, ms); },
    onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

function Message({ big, say }: { big: string; say: string }) {
  return <div className="sm-msg"><div className="big">{big}</div><p>{say}</p></div>;
}

function Body({ g, view, seat, act }: { g: SnakesPlayerView; view: PlayerGameView; seat: Seat; act: (i: unknown) => void }) {
  const me = g.me!;
  if (g.final) {
    return (
      <div className="sm-msg">
        <div className="kicker">{g.final.winner === 'snake' ? 'The Snakes win' : 'The Guests win'}</div>
        <div className="big">{g.final.won ? 'You won' : 'Not this time'}</div>
        <p>{g.final.points > 0 ? `+${g.final.points.toLocaleString()} points to your night` : 'Watch the TV for who was who.'}</p>
      </div>
    );
  }
  if (me.status === 'banished') return <Message big={cap(g.words.banished)} say="You’re out of the game. Watch the TV and enjoy the chaos." />;
  if (me.status === 'left') return <Message big="Gone" say="You left the manor." />;

  if (g.stage === 'deal') return <RoleCard g={g} seat={seat} open />;
  if (g.stage === 'mission' && g.mission) return <MissionPhone g={g} act={act} />;
  if (g.stage === 'missionReveal') {
    return <Message big="Look at the TV" say={g.mission?.result?.shield ? 'You earned a shield. Nobody can murder you tonight. Tell anyone, or don’t.' : 'The count is on the TV.'} />;
  }
  if (g.stage === 'vote' && g.vote) return <VotePhone g={g} seat={seat} act={act} />;
  if (g.stage === 'night' && g.night) return <NightPhone night={g.night} seat={seat} act={act} youName={view.you.name} />;
  if (g.stage === 'night' && g.bet) return <BetPhone bet={g.bet} seat={seat} act={act} />;
  if (g.stage === 'endVote' && g.endVote) {
    if (!g.endVote.canVote) return <Message big="Ghost" say="The living decide this one." />;
    return (
      <div className="sm-stack">
        <p className="kicker">Every one of you must say End</p>
        <button className={`sm-btn${g.endVote.mine === true ? ' sel' : ''}`} disabled={g.endVote.mine !== null} onClick={() => act({ type: 'endVote', end: true })}>End the game</button>
        <button className={`sm-btn${g.endVote.mine === false ? ' sel' : ''}`} disabled={g.endVote.mine !== null} onClick={() => act({ type: 'endVote', end: false })}>Banish again</button>
      </div>
    );
  }
  if (g.stage === 'debate') return <><Message big="Talk" say="Out loud. Accuse someone. Defend yourself." /><RoleCard g={g} seat={seat} /></>;
  if (me.status === 'ghost') return <Message big="Ghost" say={`You ${g.words.murdered}. You still answer in missions, and you bet on the Snakes at night.`} />;
  return <><Message big="Look at the TV" say="" /><RoleCard g={g} seat={seat} /></>;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The role card: face down until held (ADR 0023). On the deal it's the whole screen. */
function RoleCard({ g, seat, open = false }: { g: SnakesPlayerView; seat: Seat; open?: boolean }) {
  const [shown, setShown] = useState(false);
  const me = g.me!;
  const snake = me.role === 'snake';
  const press = {
    onPointerDown: () => setShown(true), onPointerUp: () => setShown(false), onPointerLeave: () => setShown(false),
    onPointerCancel: () => setShown(false), onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
  return (
    <div className={`sm-role${open ? ' open' : ''}`}>
      <div className={`vellum role-card${shown ? ' up' : ''}${shown && snake ? ' snake' : ''}`} {...press}>
        {shown ? (
          <>
            <span className="k">You are a</span>
            <span className="r">{snake ? 'Snake' : 'Guest'}</span>
            <p>{snake ? 'Stay hidden. Survive to the end and you take the whole pot.' : me.kid ? 'The youngest guests are always Guests. Find the Snakes!' : 'Find the Snakes before they find you. Win and you split the pot.'}</p>
            <span className="k">{snake ? 'Your fellow Snakes' : ' '}</span>
            <span className="kin">{snake ? (g.fellows.length ? g.fellows.map((id) => seat(id)?.name).join(', ') : 'none: you’re alone') : ' '}</span>
          </>
        ) : (
          <><span className="k">Your role</span><span className="r face">?</span><p>Hold to see it. Let go to hide it.</p><span className="k">&nbsp;</span><span className="kin">&nbsp;</span></>
        )}
      </div>
    </div>
  );
}

function MissionPhone({ g, act }: { g: SnakesPlayerView; act: (i: unknown) => void }) {
  const m = g.mission!;
  if (m.step === 'tally') return <Message big="Look at the TV" say="The count, never who." />;
  if (!m.question) return <Message big="Watch" say="Not your turn. Look at the TV." />;
  return (
    <div className="sm-stack">
      <p className="kicker">Look at the TV</p>
      {m.showPrompt && <p className="prompt">{m.question.prompt}</p>}
      {m.question.answers.map((a, i) => (
        <button key={i} className={`sm-btn ans${m.picked === i ? ' sel' : ''}`} disabled={m.picked !== null} onClick={() => act({ type: 'answer', choice: i })}>
          <Mark index={i} size={40} />{a.text}
        </button>
      ))}
      <p className="foot">{m.picked !== null ? 'Sealed. The TV shows the total, never who was right.' : ' '}</p>
    </div>
  );
}

function VotePhone({ g, seat, act }: { g: SnakesPlayerView; seat: Seat; act: (i: unknown) => void }) {
  const v = g.vote!;
  const [pick, setPick] = useState<string | null>(null);
  if (!v.canVote) return <Message big="Silenced" say={g.me?.status === 'alive' ? 'A Dagger took your vote this time. Argue anyway.' : 'The living vote.'} />;
  if (v.mine) return <Message big="Sealed" say={`You voted for ${seat(v.mine)?.name}. Watch the seals break on the TV.`} />;
  return (
    <div className="sm-stack">
      {v.note && <div className="sm-remind"><span className="k">Your note from last night</span><span className="note">“{v.note}”</span></div>}
      <p className="kicker">Seal your vote</p>
      <div className="names">
        {v.candidates.map((id) => (
          <button key={id} className={`nm-b${pick === id ? ' sel' : ''}`} onClick={() => setPick(id)}>
            <Arms color={seat(id)?.color} size={22} />{seat(id)?.name}
          </button>
        ))}
      </div>
      <button className="sm-btn primary" disabled={!pick} onClick={() => pick && act({ type: 'vote', target: pick })}>Seal it</button>
    </div>
  );
}

/** One night screen for every role (ADR 0023): same box, same grid, same chips, same button, same clock. */
function NightPhone({ night, seat, act, youName }: { night: NightScreen; seat: Seat; act: (i: unknown) => void; youName: string }) {
  const [text, setText] = useState('');
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { log.current?.scrollTo(0, log.current.scrollHeight); }, [night.box.messages.length]);
  const send = () => { if (text.trim()) { act({ type: 'say', text }); setText(''); } };
  const names = night.grid.kind === 'answer' ? [] : night.grid.candidates;
  const chips = [...names.map((id) => seat(id)?.name ?? ''), ...night.chips].filter(Boolean).slice(0, 12);
  const answer = night.grid.kind === 'answer';
  return (
    <div className="sm-night-ph">
      <div className="nbox">
        <span className="lbl">{night.box.prompt}</span>
        <div className="log" ref={log}>
          {night.box.kind === 'note' && night.box.note && <p className="note">“{night.box.note}”</p>}
          {night.box.messages.map((m, i) => <p key={i} className="msg"><b>{m.from === 'salty' ? 'SALTY' : (seat(m.from)?.name ?? '?').toUpperCase() === youName.toUpperCase() ? 'YOU' : (seat(m.from)?.name ?? '?').toUpperCase()}</b>{m.text}</p>)}
        </div>
        <div className="compose">
          <input className="nfield" value={text} maxLength={TEXT_MAX} placeholder={night.box.kind === 'note' ? 'Only you will see this.' : 'Write…'}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
          <button className="nsend" onClick={send} aria-label="Send">›</button>
        </div>
      </div>
      <div className="chips">{chips.map((c, i) => <button key={i} className="chip" onClick={() => setText((t) => (t ? `${t} ${c}` : c).slice(0, TEXT_MAX))}>{c}</button>)}</div>
      <span className="lbl">{gridLabel(night)}</span>
      <div className="names">
        {answer
          ? (['yes', 'no'] as const).map((x) => <button key={x} className="nm-b" disabled={night.locked} onClick={() => act({ type: 'offer', accept: x === 'yes' })}>{x === 'yes' ? 'Join them' : 'Refuse'}</button>)
          : night.grid.candidates.map((id) => (
            <button key={id} className={`nm-b${night.grid.picks.includes(id) ? ' sel' : ''}`} disabled={night.locked} onClick={() => act({ type: 'pick', target: id })}>
              <Arms color={seat(id)?.color} size={22} />{seat(id)?.name}
            </button>
          ))}
      </div>
      <button className="sm-btn primary dim" disabled={night.locked} onClick={() => act({ type: 'lock' })}>{night.locked ? 'Locked · waiting for the night to end' : 'Lock'}</button>
    </div>
  );
}

function gridLabel(n: NightScreen): string {
  switch (n.grid.kind) {
    case 'murder': return n.noMurder ? 'Who would vanish (not tonight)' : n.grid.max > 1 ? 'Who vanishes · pick two' : 'Who vanishes';
    case 'recruit': return 'Who to offer a place';
    case 'answer': return 'Your answer';
    case 'suspect': return 'Your suspect';
    default: return ' ';
  }
}

function BetPhone({ bet, seat, act }: { bet: NonNullable<SnakesPlayerView['bet']>; seat: Seat; act: (i: unknown) => void }) {
  return (
    <div className="sm-stack">
      <p className="kicker">Your Ghost Bet: who are the Snakes? Up to {bet.max}</p>
      <div className="names">
        {bet.candidates.map((id) => (
          <button key={id} className={`nm-b${bet.picks.includes(id) ? ' sel' : ''}`} onClick={() => act({ type: 'pick', target: id })}>
            <Arms color={seat(id)?.color} size={22} />{seat(id)?.name}
          </button>
        ))}
      </div>
      <p className="foot">Bets are revealed at the very end.</p>
    </div>
  );
}

/**
 * The hidden drawer (hold your coat of arms): a Snake's Overboard and Daggers. A Guest's drawer opens the same way
 * and says there's nothing in it, so the gesture itself gives nothing away.
 */
function Drawer({ g, seat, act, onClose, admin }: {
  g: SnakesPlayerView; seat: Seat; act: (i: unknown) => void; onClose: () => void; admin: { paused: boolean; send: Send } | null;
}) {
  const snake = g.me?.role === 'snake' && g.me.status === 'alive';
  const ob = g.mission?.overboard;
  const n = g.night;
  const [kind, setKind] = useState<'silence' | 'peek' | null>(null);
  return (
    <div className="sm-drawer" role="dialog">
      <button className="close" onClick={onClose} aria-label="Close">×</button>
      {!snake && <p>Nothing here. Just your coat of arms.</p>}
      {snake && g.stage === 'mission' && ob && (
        ob.available ? (
          <>
            <p className="lbl">Overboard: drop one teammate’s answer from this question</p>
            <div className="names">{ob.candidates.map((id) => <button key={id} className="nm-b" onClick={() => { act({ type: 'overboard', target: id }); onClose(); }}>{seat(id)?.name}</button>)}</div>
          </>
        ) : <p>The Overboard is used for this mission.</p>
      )}
      {snake && g.stage === 'night' && n && (
        n.daggers > 0 ? (
          <>
            <p className="lbl">You hold {n.daggers} Dagger{n.daggers > 1 ? 's' : ''}. One a night.</p>
            {!n.noMurder && <button className="sm-btn" onClick={() => { act({ type: 'dagger', kind: 'double', target: null }); onClose(); }}>Double murder tonight</button>}
            <button className="sm-btn" onClick={() => setKind('silence')}>Silence someone at the next table</button>
            <button className="sm-btn" onClick={() => setKind('peek')}>Peek: does someone hold a shield?</button>
            {kind && <div className="names">{g.players.filter((p) => p.status === 'alive' && p.id !== undefined).map((p) => (
              <button key={p.id} className="nm-b" onClick={() => { act({ type: 'dagger', kind, target: p.id }); onClose(); }}>{seat(p.id)?.name}</button>
            ))}</div>}
          </>
        ) : <p>No Daggers. Sink a mission to earn one.</p>
      )}
      {snake && g.stage !== 'mission' && g.stage !== 'night' && <p>Your tools wake up during missions and at night.</p>}
      {admin && g.stage === 'night' && (
        <>
          <p className="lbl">Grown-up controls (hidden at night so every phone looks the same)</p>
          <button className="sm-btn" onClick={() => { admin.send({ t: 'admin:pause', paused: !admin.paused }); onClose(); }}>{admin.paused ? 'Resume' : 'Pause the game'}</button>
          <EndButton send={admin.send} final={false} />
        </>
      )}
    </div>
  );
}

function Admin({ g, send, paused }: { g: SnakesPlayerView; send: Send; paused: boolean }) {
  return (
    <div className="sm-admin">
      {g.stage !== 'final' && <button onClick={() => send({ t: 'admin:pause', paused: !paused })}>{paused ? 'Resume' : 'Pause'}</button>}
      {g.stage !== 'final' && !paused && <button onClick={() => send({ t: 'admin:next' })}>{g.stage === 'debate' ? 'Start the vote' : 'Skip ahead'}</button>}
      <EndButton send={send} final={g.stage === 'final'} />
    </div>
  );
}

/** Ending a game asks once: a second tap within a few seconds confirms. */
function EndButton({ send, final }: { send: Send; final: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  if (final) return <button onClick={() => send({ t: 'admin:end' })}>Back to the lobby</button>;
  return <button className={armed ? 'danger' : ''} onClick={() => (armed ? send({ t: 'admin:end' }) : setArmed(true))}>{armed ? 'Tap again to end' : 'End game'}</button>;
}
