// Snake Manor on the TV (ADR 0022–0024, design guide §8). Only public facts ever reach this screen (ADR 0023):
// the server's host view carries no roles until their reveal, no votes until the seals break, no night picks.
import { useEffect, useState } from 'react';
import type { ClientMsg, HostGameView, PublicSeat } from '@smartmouth/protocol';
import { rules, type SnakesHostView, type SPublicPlayer } from '@smartmouth/game-snakes';
import { serverNow } from '../../socket.ts';
import { useSalty } from '../../host/voice.ts';
import { Arms, Candle, Mark, Seal, clock, useLeft } from './arms.tsx';
import { Drama } from './drama.tsx';
import { SFX, captionSound, useCues, useSoundCaption } from './sound.ts';
import './fonts.ts';
import './snakes.css';

type Seat = (id: string) => PublicSeat | undefined;

/** Ticks a few times a second, for anything placed by time since a stage began. */
function useNow(ms = 200): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => { const id = setInterval(() => setNow(serverNow()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

const STAGE_TITLE: Record<SnakesHostView['stage'], string> = {
  deal: 'The Manor', mission: 'The Mission', missionReveal: 'The Mission', debate: 'The Round Table', vote: 'The Round Table',
  voteReveal: 'The Round Table', banish: 'The Round Table', night: 'Night', breakfast: 'Breakfast', endVote: 'The Last Table',
  unmask: 'The Unmasking', final: 'The End',
};

export function SnakesHost({ view, send }: { view: HostGameView; send: (m: ClientMsg) => void }) {
  const g = view.game as SnakesHostView;
  const seat: Seat = (id) => view.players.find((p) => p.id === id);

  // OK on the remote moves past a reveal; from the end it goes back to the lobby.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (g.stage === 'final') send({ t: 'admin:end' });
      else if (!['vote', 'night', 'mission', 'endVote'].includes(g.stage)) send({ t: 'admin:next' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [g.stage, send]);

  const night = g.stage === 'night';
  return (
    <div className={`sm-tv stage-${g.stage}`}>
      {!night && (
        <div className="sm-top">
          <div className="sm-phase"><span className="n">{STAGE_TITLE[g.stage]}</span><span className="sub">{subtitle(g)}</span></div>
          <div className="sm-ledger">
            {g.mission && g.stage === 'mission' && <div><span className="k">Right</span><span className="v">{g.mission.right} <small>of {g.mission.asked}</small></span></div>}
            {g.mission && g.stage === 'mission' && <div><span className="k">Target</span><span className="v">{g.mission.target}</span></div>}
            <div><span className="k">Still at the table</span><span className="v">{g.players.filter((p) => p.status === 'alive').length}</span></div>
            <div><span className="k">The pot</span><span className="v gold">{g.pot.toLocaleString()} <small>crowns</small></span></div>
          </div>
        </div>
      )}

      <div className="sm-main">
        {g.stage === 'deal' && <Deal g={g} />}
        {g.stage === 'mission' && <Mission g={g} seat={seat} />}
        {g.stage === 'missionReveal' && <MissionReveal g={g} />}
        {g.stage === 'debate' && <Debate g={g} />}
        {g.stage === 'vote' && <Vote g={g} seat={seat} />}
        {g.stage === 'voteReveal' && <Seals g={g} seat={seat} />}
        {g.stage === 'banish' && g.banished && <Drama g={g} seat={seat} />}
        {night && <Night g={g} />}
        {g.stage === 'breakfast' && <Breakfast g={g} seat={seat} />}
        {g.stage === 'endVote' && <EndVote g={g} />}
        {g.stage === 'unmask' && <Unmask g={g} seat={seat} />}
        {g.stage === 'final' && <Final g={g} seat={seat} />}
      </div>

      <Herald cue={view.salty} quiet={night} />
      {!night && <Court players={g.players} seat={seat} joinUrl={view.joinUrl} code={view.code} hideRoleOf={g.stage === 'banish' || g.stage === 'voteReveal' ? g.banished?.id ?? null : null} />}
    </div>
  );
}

function subtitle(g: SnakesHostView): string {
  switch (g.stage) {
    case 'deal': return 'Check your phone. Tell no one.';
    case 'mission': return g.mission ? `${formatName(g.mission.format)} · question ${g.mission.index + 1} of ${g.mission.count}` : 'Nothing to ask tonight';
    case 'missionReveal': return 'The count';
    case 'debate': return 'Accuse. Defend. Be dramatic.';
    case 'vote': return g.vote?.revote ? 'A tie. Vote again, between the tied.' : 'Seal your vote on your phone';
    case 'voteReveal': return 'The seals, one at a time';
    case 'banish': return 'The table has spoken';
    case 'breakfast': return `Morning ${g.round - 1 > 0 ? g.round - 1 : 1}`;
    case 'endVote': return `${g.players.filter((p) => p.status === 'alive').length} remain. End it, or banish again?`;
    case 'unmask': return 'Who was who';
    default: return '';
  }
}

const formatName = (f: string) => (f === 'chain' ? 'The chain' : f === 'pairs' ? 'Pairs' : 'Everyone answers');

/** Salty's strip: his seal pulses while he talks; a line in timed parts shows each part's caption at its time. */
function Herald({ cue, quiet }: { cue: HostGameView['salty']; quiet: boolean }) {
  const { talking, blocked } = useSalty(cue);
  const now = useNow(250);
  const sound = useSoundCaption();
  const part = cue?.parts?.filter((p) => p.at <= now).at(-1);
  const text = cue?.parts ? (part?.caption ?? '…') : (cue?.caption ?? '…');
  return (
    <div className={`sm-herald${quiet ? ' quiet' : ''}`} role="status">
      <Seal talking={talking} />
      <div className="scroll">
        <span className="who">The Lord of the Manor</span>
        {text}
        {blocked && <span className="hint"> Press any key or click to hear him.</span>}
        <span className="sm-sound">{sound}</span>
      </div>
    </div>
  );
}

/** `hideRoleOf`: the player being banished right now; their role waits for the reveal (ADR 0024). */
function Court({ players, seat, joinUrl, code, hideRoleOf }: { players: SPublicPlayer[]; seat: Seat; joinUrl: string; code: string; hideRoleOf: string | null }) {
  return (
    <div className="sm-court">
      {players.map((p) => {
        const s = seat(p.id);
        const out = p.status !== 'alive' && p.id !== hideRoleOf;
        return (
          <div key={p.id} className={`knight${out ? ' gone' : ''}${s?.connected === false ? ' away' : ''}`}>
            <Arms color={s?.color} size={58} faded={out} />
            <span className="nm">{s?.name ?? '?'}</span>
            {out && <span className="tag">{p.status === 'ghost' ? 'Ghost' : p.status === 'left' ? 'left' : p.role === 'snake' ? 'Snake' : 'Guest'}</span>}
          </div>
        );
      })}
      <div className="sm-join">Join to watch: {joinUrl.replace(/^https?:\/\//, '').replace(/\/play\?code=.*$/, '')} · {code}</div>
    </div>
  );
}

function Deal({ g }: { g: SnakesHostView }) {
  const n = rules.snakeCount(g.players.length);
  return (
    <div className="sm-center">
      <h1 className="sm-title">Snake Manor</h1>
      <p className="sm-lede">{n === 1 ? 'One of you is a Snake.' : `${n} of you are Snakes.`} Hold your phone close.</p>
      {g.players.some((p) => p.kid) && <p className="sm-note">The youngest guests are always Guests. Salty insisted.</p>}
    </div>
  );
}

function Mission({ g, seat }: { g: SnakesHostView; seat: Seat }) {
  const m = g.mission;
  if (!m) return <div className="sm-center"><p className="sm-lede">No questions for these ages tonight. The pot stays as it is.</p></div>;
  if (m.step === 'tally') {
    return (
      <div className="sm-center">
        <div className="sm-big-number">{m.right} <small>right of {m.asked}</small></div>
        <p className="sm-lede">Target: {m.target}{m.format === 'chain' && m.streak > 1 ? ` · a run of ${m.streak}` : ''}</p>
        {m.overboardSaid && <p className="sm-alarm">One answer went overboard.</p>}
      </div>
    );
  }
  return (
    <div className="sm-mission">
      <div className="vellum q-card">
        {m.format === 'chain' && m.turn && <div className="turn">{seat(m.turn)?.name}’s turn</div>}
        {m.format === 'pairs' && <div className="turn">Pairs score only when both are right</div>}
        <div className="q">{m.question?.prompt}</div>
        <div className="answers">
          {m.question?.answers.map((a, i) => <div key={i} className="ans"><span className="rn">{['I', 'II', 'III', 'IV'][i]}</span><Mark index={i} size={60} />{a.text}</div>)}
        </div>
        {m.answering > 1 && <div className="split">Everyone has their own question · {m.locked} of {m.answering} sealed</div>}
      </div>
      <Candle deadline={m.deadline} />
    </div>
  );
}

function MissionReveal({ g }: { g: SnakesHostView }) {
  const r = g.mission?.result;
  useCues(`mreveal:${g.stageStart}`, () => [{ at: g.stageStart, run: () => {
    if (r?.hit) { SFX.flourish(); captionSound('[a harpsichord flourish]'); } else { SFX.crackedFanfare(); captionSound('[a cracked, off-key fanfare]'); }
  } }]);
  if (!r) return <div className="sm-center"><p className="sm-lede">The mission passes.</p></div>;
  return (
    <div className="sm-center">
      <h2 className={`sm-verdict ${r.hit ? 'hit' : 'miss'}`}>{r.hit ? 'Target hit' : 'Target missed'}</h2>
      <p className="sm-lede">+{r.gained.toLocaleString()} crowns to the pot</p>
      {r.dagger && <p className="sm-alarm">The Snakes have earned a Dagger.</p>}
      {r.shieldGiven && <p className="sm-note">A shield was given in secret. Someone is safe tonight. Anyone can claim it.</p>}
    </div>
  );
}

function Debate({ g }: { g: SnakesHostView }) {
  const { left } = useLeft(g.deadline);
  return (
    <div className="sm-center">
      <div className="sm-clock">{clock(left)}</div>
      <p className="sm-lede">Out loud, in the room. Then seal your vote on your phone.</p>
    </div>
  );
}

function Vote({ g, seat }: { g: SnakesHostView; seat: Seat }) {
  const v = g.vote;
  const { left } = useLeft(g.deadline);
  return (
    <div className="sm-center">
      <div className="sm-seals">
        {Array.from({ length: v?.voters ?? 0 }, (_, i) => <span key={i} className={`wax${i < (v?.sealed ?? 0) ? '' : ' pending'}`}>{i < (v?.sealed ?? 0) ? '' : '?'}</span>)}
      </div>
      <p className="sm-lede">{v?.sealed ?? 0} of {v?.voters ?? 0} sealed · {clock(left)}</p>
      {v?.revote && <p className="sm-note">Between {v.candidates.map((id) => seat(id)?.name).join(' and ')}</p>}
    </div>
  );
}

/** When each seal breaks: one every `per`, and a longer silence before the last (the one that may decide it). */
function sealTimes(g: SnakesHostView, n: number): number[] {
  const share = g.drama === 'quick' ? rules.QUICK_SHARE : 1;
  const per = rules.REVEAL_PER_VOTE_MS * share;
  const lastWait = Math.min(3000, rules.REVEAL_TAIL_MS * 0.75) * share;
  return Array.from({ length: n }, (_, i) => g.stageStart + (i < n - 1 || n === 1 ? i * per : (n - 2) * per + per + lastWait));
}

function Seals({ g, seat }: { g: SnakesHostView; seat: Seat }) {
  const now = useNow();
  const reveal = g.vote?.reveal ?? [];
  const times = sealTimes(g, reveal.length);
  const shown = times.filter((t) => t <= now).length;
  useCues(`seals:${g.stageStart}`, () => times.map((at, i) => ({ at, run: () => { SFX.quill(); SFX.thud(); captionSound(i === times.length - 1 && i > 0 ? '[the last seal breaks]' : '[a seal breaks]'); } })));
  if (reveal.length === 0) return <div className="sm-center"><p className="sm-lede">No votes. The table couldn’t decide.</p></div>;
  const tally = new Map<string, number>();
  for (const r of reveal.slice(0, shown)) tally.set(r.to, (tally.get(r.to) ?? 0) + 1);
  const top = Math.max(1, ...tally.values());
  return (
    <div className="sm-table">
      <div className="sm-seals open">
        {reveal.map((r, i) => (
          <div key={i} className={`vote${i < shown ? '' : ' pending'}${i === shown - 1 ? ' new' : ''}`}>
            <span className="wax">{i < shown ? seat(r.to)?.name : '?'}</span>
            <span className="from">{i < shown ? `from ${seat(r.from)?.name}` : 'unopened'}</span>
          </div>
        ))}
      </div>
      <div className="tally">
        <h3>The count</h3>
        {[...tally.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => (
          <div key={id} className="row">
            <Arms color={seat(id)?.color} size={52} />
            <span className="nm">{seat(id)?.name}</span>
            <span className="bar"><i style={{ width: `${(n / top) * 100}%` }} /></span>
            <span className="num">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Night({ g }: { g: SnakesHostView }) {
  const { left } = useLeft(g.deadline);
  useCues(`night:${g.stageStart}`, () => [
    { at: g.stageStart, run: () => { SFX.bell(); SFX.bell(2.2); SFX.bell(4.4); captionSound('[three bell tolls]'); } },
    { at: g.stageStart + 5000, run: () => { SFX.droneOn(); captionSound('[wind around the manor]'); } },
  ]);
  return (
    <div className="sm-night">
      <div className="moon" />
      <h2 className="sm-title">Night falls</h2>
      <div className="sm-clock night">{clock(left)}</div>
      <p className="sm-lede">Phones in hand. Say nothing. Look at no one.</p>
      {g.night?.noMurder && g.night.number === 1 && <p className="sm-note">The first night is a welcome dinner. Nobody dies. Probably.</p>}
      <div className="windows" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={`win${i === 2 ? ' lit' : ''}`} />)}</div>
    </div>
  );
}

function Breakfast({ g, seat }: { g: SnakesHostView; seat: Seat }) {
  const b = g.breakfast;
  const now = useNow();
  const chairAt = g.stageStart + 2500 * (g.drama === 'quick' ? rules.QUICK_SHARE : 1);
  const all = b?.murdered ?? [];
  // Birdsong over the morning first; the empty chair comes a beat later, with the staff's gasp.
  const dead = now >= chairAt ? all : [];
  useCues(`breakfast:${g.stageStart}`, () => [
    { at: g.stageStart, run: () => { SFX.birds(); captionSound('[birdsong]'); } },
    { at: chairAt, run: () => { if (all.length) { SFX.gasp(); captionSound('[the staff gasp]'); } else { SFX.chime(); captionSound('[a soft chime]'); } } },
  ]);
  if (now < chairAt) return <div className="sm-center"><h2 className="sm-title small">Good morning.</h2></div>;
  return (
    <div className="sm-breakfast">
      {dead.length > 0 ? dead.map((id) => (
        <div key={id} className="vellum obit">
          <Arms color={seat(id)?.color} size={110} faded />
          <span className="nm">{seat(id)?.name}</span>
          <span className="how">{g.words.murdered}</span>
          <span className="then">Now a Ghost · still playing</span>
        </div>
      )) : <div className="vellum obit"><span className="nm">Everyone woke up</span><span className="how">{b?.saved ? 'a shield held' : 'a quiet night'}</span></div>}
      <div className="omen">
        <h2 className="sm-title small">{dead.length ? (dead.length > 1 ? 'Two chairs are empty.' : 'One chair is empty.') : b?.saved ? 'Someone was spared.' : 'Nobody died.'}</h2>
        {b?.saltyRecruited && <div className="hint"><span className="k">In the night</span><p>The manor never sleeps without a Snake.</p></div>}
        {(b?.sameSuspect ?? 0) >= 2 && <div className="hint"><span className="k">Overheard at night</span><p>{b?.sameSuspect} of you wrote down the same name.</p></div>}
      </div>
    </div>
  );
}

function EndVote({ g }: { g: SnakesHostView }) {
  const { left } = useLeft(g.deadline);
  return (
    <div className="sm-center">
      <h2 className="sm-title small">End it, or banish again?</h2>
      <p className="sm-lede">It only ends if every one of you says End. {g.endVote?.sealed ?? 0} of {g.endVote?.voters ?? 0} sealed · {clock(left)}</p>
    </div>
  );
}

function Unmask({ g, seat }: { g: SnakesHostView; seat: Seat }) {
  const u = g.unmask;
  useCues(`unmask:${u?.shown.length ?? 0}`, () => (u?.shown.length ? [{ at: serverNow(), run: () => { SFX.bell(); captionSound('[a bell]'); } }] : [{ at: serverNow(), run: () => { SFX.droneOn(); captionSound('[the drone rises]'); } }]));
  return (
    <div className="sm-unmask">
      {u?.shown.map((x) => (
        <div key={x.id} className={`mask ${x.role}`}>
          <Arms color={seat(x.id)?.color} size={110} />
          <span className="nm">{seat(x.id)?.name}</span>
          <span className="role">{x.role === 'snake' ? 'Snake' : 'Guest'}</span>
        </div>
      ))}
      {Array.from({ length: (u?.total ?? 0) - (u?.shown.length ?? 0) }, (_, i) => <div key={`h${i}`} className="mask hidden"><span className="role">?</span></div>)}
    </div>
  );
}

function Final({ g, seat }: { g: SnakesHostView; seat: Seat }) {
  const f = g.final;
  useCues(`final:${g.stageStart}`, () => [{ at: g.stageStart, run: () => { SFX.droneOff(); SFX.finale(); captionSound('[a choir and brass]'); } }]);
  if (!f) return null;
  return (
    <div className="sm-center">
      <h1 className={`sm-title ${f.winner}`}>{f.winner === 'snake' ? 'The Snakes win' : 'The Guests win'}</h1>
      <p className="sm-lede">{f.winners.map((id) => seat(id)?.name).join(', ') || 'Nobody'} {f.winners.length === 1 ? 'takes' : 'split'} {f.pot.toLocaleString()} crowns.</p>
      <p className="sm-note">The Snakes were {f.roles.filter((r) => r.role === 'snake').map((r) => seat(r.id)?.name).join(', ')}. Press OK for the lobby.</p>
    </div>
  );
}
