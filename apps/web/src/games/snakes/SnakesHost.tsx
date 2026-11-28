// Snake Manor on the TV (ADR 0022–0024, design guide §8). Only public facts ever reach this screen (ADR 0023):
// the server's host view carries no roles until their reveal, no votes until the letters are opened, no night picks.
//
// Every screen says three things: what to do now, what comes next, and where we are in the round (the "now" strip).
// Every moment's picture, sound and caption tell one story: votes are sealed letters, the reveal opens them.
import { useEffect, useRef, useState } from 'react';
import type { ClientMsg, HostGameView, PublicSeat } from '@smartmouth/protocol';
import { rules, type HistoryEvent, type SnakesHostView, type SPublicPlayer, type TalkLine } from '@smartmouth/game-snakes';
import { serverNow } from '../../socket.ts';
import { useSalty } from '../../host/voice.ts';
import { Arms, Candle, Mark, Seal, clock, useLeft } from './arms.tsx';
import { Drama } from './drama.tsx';
import { SFX, captionSound, useCues, useSoundCaption } from './sound.ts';
import { bedFor, duck, loadSounds, playBed, startLoop, stopLoop, stopMusic } from './music.ts';
import { BRIEFS, ROMAN, leadStage } from './briefs.ts';
import './fonts.ts';
import './snakes.css';

type Seat = (id: string) => PublicSeat | undefined;

/** Ticks a few times a second, for anything placed by time since a stage began. */
function useNow(ms = 200): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => { const id = setInterval(() => setNow(serverNow()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

/** A clock ticking out loud in its last ten seconds. */
function useTicking(deadline: number | null) {
  const { left } = useLeft(deadline);
  const last = useRef(-1);
  useEffect(() => {
    const s = Math.ceil(left / 1000);
    if (s > 0 && s <= 10 && s !== last.current) { last.current = s; SFX.tick(); }
  }, [left]);
}

const STAGE_TITLE: Record<SnakesHostView['stage'], string> = {
  deal: 'Snake Manor', briefing: 'How it works', mission: 'The Mission', missionReveal: 'The Mission', debate: 'The Round Table', vote: 'The Round Table',
  voteReveal: 'The Round Table', banish: 'The Round Table', night: 'Night', breakfast: 'Breakfast', endVote: 'The Last Table',
  unmask: 'The Unmasking', final: 'The End',
};

/** What to do now, and what comes next: the "now" strip on every screen. */
function guide(g: SnakesHostView): { now: string; next: string } {
  const alive = g.players.filter((p) => p.status === 'alive').length;
  switch (g.stage) {
    case 'deal': return { now: 'Look at your phone and hold the card to see your role. Tell no one.', next: 'Next: how the first mission works' };
    case 'briefing': return { now: `Listen to Salty: how ${g.brief ? BRIEFS[g.brief].title.replace(/^The /, 'the ') : 'this'} works.`, next: 'It starts when he’s done. Already know it? Press OK.' };
    case 'mission': return g.mission?.step === 'tally'
      ? { now: 'The count for that question. Only the total, never who.', next: `Next: question ${(g.mission.index ?? 0) + 2} of ${g.mission.count}` }
      : { now: 'Answer on your phone. Every right answer adds crowns to the pot.', next: `Hit ${g.mission?.target ?? '?'} right to bank the bonus. Miss it and the Snakes get a Dagger.` };
    case 'missionReveal': return { now: 'How the mission went.', next: 'Next: the Round Table, where you talk it out' };
    case 'debate': return { now: 'Talk it out loud. Who is lying? Use what the table knows.', next: 'Next: a secret vote on your phones' };
    case 'vote': return { now: g.vote?.revote ? 'A tie. Vote again on your phone, between the tied.' : 'Vote on your phone: who should be shown the door?', next: 'Each vote is a sealed letter. They open one by one.' };
    case 'voteReveal': return { now: 'Opening the letters, one at a time.', next: 'Next: who leaves, and what they were' };
    case 'banish': return { now: 'The table has spoken.', next: alive <= g.endSize + 1 ? 'Next: the endgame is close' : 'Next: night falls' };
    case 'night': return { now: 'Phones in hand. Say nothing.', next: 'Next: breakfast, and who is missing' };
    case 'breakfast': return { now: 'Morning. Who made it through the night?', next: alive <= g.endSize ? 'Next: the last table' : 'Next: another mission' };
    case 'endVote': return { now: 'End the game now, or banish one more? It only ends if everyone says End.', next: 'Vote on your phone' };
    case 'unmask': return { now: 'Who was who.', next: 'Next: who takes the pot' };
    default: return { now: 'Press OK for the lobby.', next: '' };
  }
}

const TRACK: Array<{ label: string; stages: SnakesHostView['stage'][] }> = [
  { label: 'Mission', stages: ['mission', 'missionReveal'] },
  { label: 'Round Table', stages: ['debate', 'vote', 'voteReveal', 'banish'] },
  { label: 'Night', stages: ['night'] },
  { label: 'Breakfast', stages: ['breakfast'] },
];

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

  // The music bed follows the stage; it fades out when the game ends.
  const bed = bedFor(g);
  useEffect(() => { void loadSounds().then(() => playBed(bed)); }, [bed]);
  useEffect(() => () => stopMusic(), []);

  const night = g.stage === 'night';
  const gd = guide(g);
  const inLoop = TRACK.some((t) => t.stages.includes(leadStage(g)));
  return (
    <div className={`sm-tv stage-${g.stage}`}>
      <Herald cue={view.salty} quiet={night} />
      {!night && (
        <div className="sm-top">
          <div className="sm-phase"><span className="n">{STAGE_TITLE[g.stage]}</span><span className="sub">{g.endVote || g.unmask || g.final ? 'The endgame' : `Round ${g.round}`}</span></div>
          <div className="sm-ledger">
            {g.mission && g.stage === 'mission' && <div><span className="k">Right</span><span className="v">{g.mission.right} <small>of {g.mission.asked}</small></span></div>}
            {g.mission && g.stage === 'mission' && <div><span className="k">Target</span><span className="v">{g.mission.target}</span></div>}
            <div><span className="k">Still at the table</span><span className="v">{g.players.filter((p) => p.status === 'alive').length}</span></div>
            <div><span className="k">The pot</span><span className="v gold">{g.pot.toLocaleString()} <small>crowns</small></span></div>
          </div>
        </div>
      )}
      <div className={`sm-now${night ? ' night' : ''}`}>
        <div className="say"><span className="now">{gd.now}</span>{gd.next && <span className="next">{gd.next}</span>}</div>
        {inLoop && !night && (
          <ol className="track" aria-label="Where we are in the round">
            {TRACK.map((t) => <li key={t.label} className={t.stages.includes(leadStage(g)) ? 'on' : ''}>{t.label}</li>)}
          </ol>
        )}
      </div>

      <div className="sm-main">
        {g.stage === 'deal' && <Deal g={g} />}
        {g.stage === 'briefing' && g.brief && <Briefing g={g} />}
        {g.stage === 'mission' && <Mission g={g} seat={seat} />}
        {g.stage === 'missionReveal' && <MissionReveal g={g} />}
        {g.stage === 'debate' && <Debate g={g} seat={seat} />}
        {g.stage === 'vote' && <Vote g={g} seat={seat} />}
        {g.stage === 'voteReveal' && <Letters g={g} seat={seat} />}
        {g.stage === 'banish' && g.banished && <Drama g={g} seat={seat} />}
        {night && <Night g={g} />}
        {g.stage === 'breakfast' && <Breakfast g={g} seat={seat} />}
        {g.stage === 'endVote' && <EndVote g={g} seat={seat} />}
        {g.stage === 'unmask' && <Unmask g={g} seat={seat} />}
        {g.stage === 'final' && <Final g={g} seat={seat} />}
      </div>

      {!night && <Court players={g.players} seat={seat} joinUrl={view.joinUrl} code={view.code} hideRoleOf={g.stage === 'banish' || g.stage === 'voteReveal' ? g.banished?.id ?? null : null} />}
    </div>
  );
}

const formatName = (f: string) => (f === 'chain' ? 'The chain: one at a time, a run of right answers pays more' : f === 'pairs' ? 'Pairs: a pair scores only when both are right' : 'Everyone answers their own question');

/**
 * Salty on the TV: his seal pulses while he talks. No caption text (owner, 2026-11-27: his words take too much room);
 * the seal sits in the top bar's corner, out of the layout, and stays mounted so his audio never restarts.
 */
function Herald({ cue, quiet }: { cue: HostGameView['salty']; quiet: boolean }) {
  const { talking, blocked } = useSalty(cue);
  useEffect(() => { duck(talking); }, [talking]);
  const sound = useSoundCaption();
  return (
    <div className={`sm-herald${quiet ? ' quiet' : ''}`} aria-label={talking ? 'The Lord of the Manor is talking' : 'The Lord of the Manor'}>
      <Seal talking={talking} />
      {(blocked || sound) && <span className="hint">{blocked ? 'Press any key or click to hear him.' : sound}</span>}
    </div>
  );
}

/** `hideRoleOf`: the player being banished right now; their role waits for the reveal (ADR 0024). */
function Court({ players, seat, joinUrl, code, hideRoleOf }: { players: SPublicPlayer[]; seat: Seat; joinUrl: string; code: string; hideRoleOf: string | null }) {
  return (
    <div className="sm-court-row">
      <div className="sm-court">
        {players.map((p) => {
          const s = seat(p.id);
          const out = p.status !== 'alive' && p.id !== hideRoleOf;
          return (
            <div key={p.id} className={`knight${out ? ' gone' : ''}${s?.connected === false ? ' away' : ''}`}>
              <Arms color={s?.color} size={52} faded={out} />
              <span className="nm">{s?.name ?? '?'}</span>
              {out && <span className="tag">{p.status === 'ghost' ? 'Ghost' : p.status === 'left' ? 'left' : p.role === 'snake' ? 'Snake' : 'Guest'}</span>}
            </div>
          );
        })}
      </div>
      <div className="sm-join">Join to watch<br />{joinUrl.replace(/^https?:\/\//, '').replace(/\/play\?code=.*$/, '')} · {code}</div>
    </div>
  );
}

/** The deal: everyone checks their role. The rules card before it already explained the game (owner, 2026-11-27). */
function Deal({ g }: { g: SnakesHostView }) {
  const n = rules.snakeCount(g.players.length);
  useCues(`deal:${g.stageStart}`, () => [{ at: g.stageStart + 150, run: () => { SFX.cards(); captionSound('[cards being dealt]'); } }]);
  return (
    <div className="sm-deal">
      <div className="vellum deal-card">
        <p className="kicker">Your secret role</p>
        <h2>Look at your phone</h2>
        <p>Hold the card to see it. Tell no one.</p>
        <p className="count">{n === 1 ? 'One of you is a Snake.' : `${n} of you are Snakes.`}{g.players.some((p) => p.kid) ? ' The youngest guests are always Guests.' : ''}</p>
      </div>
    </div>
  );
}

/** A rules card (ADR 0025): no clock runs while Salty explains; the steps come in one at a time as he talks. */
function Briefing({ g }: { g: SnakesHostView }) {
  const b = BRIEFS[g.brief!];
  useCues(`brief:${g.stageStart}`, () => [{ at: g.stageStart + 150, run: () => { SFX.unfold(); captionSound('[a page unfolds]'); } }]);
  return (
    <div className="sm-brief">
      <div className="vellum brief-card" key={g.brief}>
        <p className="kicker">How it works</p>
        <h2>{b.title}</h2>
        <ol>{b.steps.map((t, i) => <li key={i} style={{ animationDelay: `${0.6 + i * 1.6}s` }}><span className="n">{ROMAN[i]}</span><span>{t}</span></li>)}</ol>
        <p className="stakes" style={{ animationDelay: '5.4s' }}>{b.stakes}</p>
        {b.fine && <ul className="fine" style={{ animationDelay: '6.6s' }}>{b.fine.map((t) => <li key={t}>{t}</li>)}</ul>}
        <p className="note" style={{ animationDelay: b.fine ? '7.8s' : '6.6s' }}>{b.note}</p>
      </div>
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
        {m.overboardSaid && <p className="sm-alarm">One answer went overboard. Someone sank it on purpose.</p>}
      </div>
    );
  }
  const q = m.question;
  const long = (q?.prompt.length ?? 0) > 70 || (q?.answers.some((a) => a.text.length > 26) ?? false);
  return (
    <div className="sm-mission">
      <div className={`vellum q-card${long ? ' long' : ''}`}>
        <div className="turn">{m.format === 'chain' && m.turn ? `${seat(m.turn)?.name}’s turn · ` : ''}{formatName(m.format)}</div>
        <div className="q">{q?.prompt}</div>
        <div className="answers">
          {q?.answers.map((a, i) => <div key={i} className="ans"><span className="rn">{['I', 'II', 'III', 'IV'][i]}</span><Mark index={i} size={52} /><span>{a.text}</span></div>)}
        </div>
        <div className="split">{m.answering > 1 ? `Everyone has their own question on their phone · ${m.locked} of ${m.answering} answered` : `${m.locked ? 'Answered' : 'Waiting for the answer'}`}</div>
      </div>
      <Candle deadline={m.deadline} />
    </div>
  );
}

/** A dagger and a shield, drawn: what the Snakes earned, and what someone got in secret. */
function DaggerIcon() {
  return <svg viewBox="0 0 40 120" width="56" height="168" aria-hidden="true"><path d="M20 4 L26 70 L14 70 Z" fill="#cfd3d6" stroke="#8a8f94" strokeWidth="2" /><rect x="6" y="70" width="28" height="7" rx="2" fill="#8a7034" /><rect x="16" y="77" width="8" height="26" fill="#5a3b22" /><circle cx="20" cy="108" r="6" fill="#8a7034" /></svg>;
}
function ShieldIcon() {
  return <svg viewBox="0 0 100 112" width="96" height="108" aria-hidden="true"><path d="M4 4H96V55C96 84 50 108 50 108C50 108 4 84 4 55Z" fill="#2c251e" stroke="#c9a24a" strokeWidth="5" /><path d="M50 18V94M22 46H78" stroke="#c9a24a" strokeWidth="6" /></svg>;
}

function MissionReveal({ g }: { g: SnakesHostView }) {
  const r = g.mission?.result;
  const now = useNow(250);
  const t = now - g.stageStart;
  useCues(`mreveal:${g.stageStart}`, () => [
    { at: g.stageStart, run: () => { if (r?.hit) { SFX.fanfare(); captionSound('[a trumpet fanfare]'); } else { SFX.crackedFanfare(); captionSound('[a cracked, off-key fanfare]'); } } },
    ...(r?.dagger ? [{ at: g.stageStart + 2200, run: () => { SFX.dagger(); captionSound('[a blade is drawn]'); } }] : []),
    ...(r?.shieldGiven ? [{ at: g.stageStart + (r.dagger ? 4200 : 2200), run: () => { SFX.shield(); captionSound('[a shield clangs]'); } }] : []),
  ]);
  if (!r) return <div className="sm-center"><p className="sm-lede">The mission passes.</p></div>;
  const shieldAt = r.dagger ? 4200 : 2200;
  return (
    <div className="sm-center">
      <h2 className={`sm-verdict ${r.hit ? 'hit' : 'miss'}`}>{r.hit ? 'Target hit' : 'Target missed'}</h2>
      <p className="sm-lede">+{r.gained.toLocaleString()} crowns to the pot</p>
      <div className="prizes">
        {r.dagger && t >= 2200 && <div className="prize dagger"><DaggerIcon /><span>The Snakes earned a Dagger.<small>They can use it at night.</small></span></div>}
        {r.shieldGiven && t >= shieldAt && <div className="prize shield"><ShieldIcon /><span>A shield was given in secret.<small>Someone is safe tonight. Anyone can claim it.</small></span></div>}
      </div>
    </div>
  );
}

/** What the table knows: the public record, newest first, to argue about. */
function Record({ history, seat }: { history: HistoryEvent[]; seat: Seat }) {
  const name = (id: string) => seat(id)?.name ?? '?';
  const lines: string[] = [];
  for (const h of [...history].reverse()) {
    if (h.kind === 'mission') lines.push(`Mission ${h.round}: ${h.right} of ${h.asked} right, target ${h.hit ? 'hit' : 'missed'}${h.overboard ? ', one answer sunk' : ''}.`);
    if (h.kind === 'votes') {
      const byTarget = new Map<string, string[]>();
      for (const v of h.votes) byTarget.set(v.to, [...(byTarget.get(v.to) ?? []), name(v.from)]);
      lines.push(`Round ${h.round} votes: ${[...byTarget.entries()].map(([to, from]) => `${name(to)} ← ${from.join(', ')}`).join(' · ')}.`);
    }
    if (h.kind === 'banished') lines.push(`${name(h.id)} was shown the door: a ${h.role === 'snake' ? 'Snake' : 'Guest'}.`);
    if (h.kind === 'morning') lines.push(h.murdered.length ? `Night ${h.round}: ${h.murdered.map(name).join(' and ')} vanished.` : h.saved ? `Night ${h.round}: a shield saved someone.` : `Night ${h.round}: nobody vanished.`);
    if (h.kind === 'left') lines.push(`${name(h.id)} left the manor: a ${h.role === 'snake' ? 'Snake' : 'Guest'}.`);
  }
  return (
    <div className="record">
      <h3>What the table knows</h3>
      {lines.length ? <ul>{lines.slice(0, 6).map((l, i) => <li key={i}>{l}</li>)}</ul> : <p>Nothing yet. Who answered fast? Who went quiet?</p>}
    </div>
  );
}

function Debate({ g, seat }: { g: SnakesHostView; seat: Seat }) {
  const { left } = useLeft(g.deadline);
  return (
    <div className="sm-debate">
      <div className="clock-side"><div className="sm-clock">{clock(left)}</div><p className="sm-note">until the vote</p></div>
      <div className="sm-debate-side">
        <Record history={g.history} seat={seat} />
        <TableTalk talk={g.talk} seat={seat} />
      </div>
    </div>
  );
}

/** What players said at the table this round, typed on a phone or a bot's line: the newest few, newest last. */
function TableTalk({ talk, seat, max = 4 }: { talk: TalkLine[]; seat: Seat; max?: number }) {
  if (!talk.length) return null;
  return (
    <div className="talk" aria-live="polite">
      <h3>At the table</h3>
      <ul>
        {talk.slice(-max).map((t, i) => (
          <li key={`${talk.length - max + i}`}><Arms color={seat(t.from)?.color} size={30} /><b>{seat(t.from)?.name ?? '?'}</b><span>“{t.text}”</span></li>
        ))}
      </ul>
    </div>
  );
}

/** A sealed letter: each vote cast lands on the table as one. */
function Letter({ name, from, open, fresh }: { name?: string; from?: string; open: boolean; fresh?: boolean }) {
  return (
    <div className={`letter${open ? ' open' : ''}${fresh ? ' fresh' : ''}`}>
      <div className="paper"><span className="to">{open ? name : ''}</span></div>
      <div className="flap" />
      <div className="wax"><span className="half l" /><span className="half r" /></div>
      <span className="from">{open ? `from ${from}` : ' '}</span>
    </div>
  );
}

function Vote({ g, seat }: { g: SnakesHostView; seat: Seat }) {
  const v = g.vote;
  const { left } = useLeft(g.deadline);
  useTicking(g.deadline);
  const sealed = v?.sealed ?? 0;
  const prev = useRef(sealed);
  useEffect(() => { if (sealed > prev.current) { SFX.letterIn(); captionSound('[a sealed letter lands on the table]'); } prev.current = sealed; }, [sealed]);
  return (
    <div className="sm-center">
      <div className="letters">
        {Array.from({ length: v?.voters ?? 0 }, (_, i) => i < sealed ? <Letter key={i} open={false} fresh={i === sealed - 1} /> : <div key={i} className="letter empty" />)}
      </div>
      <p className="sm-lede">{sealed} of {v?.voters ?? 0} letters sealed · {clock(left)}</p>
      {v?.revote && <p className="sm-note">Between {v.candidates.map((id) => seat(id)?.name).join(' and ')}</p>}
      <TableTalk talk={g.talk} seat={seat} max={2} />
    </div>
  );
}

/** When each letter opens: one every `per`, and a longer silence before the last (the one that may decide it). */
function openTimes(g: SnakesHostView, n: number): number[] {
  const share = g.drama === 'quick' ? rules.QUICK_SHARE : 1;
  const per = rules.REVEAL_PER_VOTE_MS * share;
  const lastWait = Math.min(3000, rules.REVEAL_TAIL_MS * 0.75) * share;
  return Array.from({ length: n }, (_, i) => g.stageStart + (i < n - 1 || n === 1 ? i * per : (n - 2) * per + per + lastWait));
}

/** The reveal: each letter's wax seal cracks, the flap opens, the letter unfolds to show the name. */
function Letters({ g, seat }: { g: SnakesHostView; seat: Seat }) {
  const now = useNow();
  const reveal = g.vote?.reveal ?? [];
  const times = openTimes(g, reveal.length);
  const shown = times.filter((t) => t <= now).length;
  useCues(`letters:${g.stageStart}`, () => times.flatMap((at, i) => [
    { at, run: () => { SFX.envelope(); captionSound(i === times.length - 1 && i > 0 ? '[the last letter is torn open]' : '[a letter is torn open]'); } },
    { at: at + 600, run: () => SFX.unfold() },
  ]));
  if (reveal.length === 0) return <div className="sm-center"><p className="sm-lede">No letters. The table couldn’t decide, so nobody leaves.</p></div>;
  const tally = new Map<string, number>();
  for (const r of reveal.slice(0, shown)) tally.set(r.to, (tally.get(r.to) ?? 0) + 1);
  const top = Math.max(1, ...tally.values());
  return (
    <div className="sm-table">
      <div className="letters open">
        {reveal.map((r, i) => <Letter key={i} open={i < shown} fresh={i === shown - 1} name={seat(r.to)?.name} from={seat(r.from)?.name} />)}
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
  useTicking(g.deadline);
  useCues(`night:${g.stageStart}`, () => [
    { at: g.stageStart, run: () => { SFX.bell(); SFX.bell(2.2); SFX.bell(4.4); captionSound('[three bell tolls]'); } },
    { at: g.stageStart + 5000, run: () => { if (!startLoop('wind', 0.3)) SFX.droneOn('night'); captionSound('[wind around the manor]'); } },
  ]);
  useEffect(() => () => stopLoop('wind'), []);
  return (
    <div className="sm-night">
      <div className="moon" />
      <h2 className="sm-title">Night falls</h2>
      <div className="sm-clock night">{clock(left)}</div>
      {g.night?.noMurder && g.night.number === 1 && <p className="sm-note">The first night is a welcome dinner. Nobody vanishes. Probably.</p>}
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
    { at: chairAt, run: () => { if (all.length) { SFX.gasp(); captionSound('[the staff gasp]'); } else { SFX.chime(); captionSound('[a small bell: everyone is here]'); } } },
  ]);
  if (now < chairAt) return <div className="sm-center"><h2 className="sm-title small">Good morning.</h2></div>;
  return (
    <div className="sm-breakfast">
      <div className="obits">
        {dead.length > 0 ? dead.map((id) => (
          <div key={id} className="vellum obit">
            <Arms color={seat(id)?.color} size={96} faded />
            <span className="nm">{seat(id)?.name}</span>
            <span className="how">{g.words.murdered}</span>
            <span className="then">Now a Ghost · still plays missions</span>
          </div>
        )) : <div className="vellum obit"><span className="nm">Everyone is here</span><span className="how">{b?.saved ? 'a shield held' : 'a quiet night'}</span></div>}
      </div>
      <div className="omen">
        <h2 className="sm-title small">{dead.length ? (dead.length > 1 ? 'Two chairs are empty.' : 'One chair is empty.') : b?.saved ? 'Someone was spared.' : 'Nobody vanished.'}</h2>
        {b?.saltyRecruited && <div className="hint"><span className="k">In the night</span><p>The manor never sleeps without a Snake.</p></div>}
        {(b?.sameSuspect ?? 0) >= 2 && <div className="hint"><span className="k">Overheard at night</span><p>{b?.sameSuspect} of you wrote down the same name.</p></div>}
      </div>
    </div>
  );
}

function EndVote({ g, seat }: { g: SnakesHostView; seat: Seat }) {
  const { left } = useLeft(g.deadline);
  useTicking(g.deadline);
  const sealed = g.endVote?.sealed ?? 0;
  const prev = useRef(sealed);
  useEffect(() => { if (sealed > prev.current) { SFX.knock(); captionSound('[a knock at the door]'); } prev.current = sealed; }, [sealed]);
  return (
    <div className="sm-center">
      <h2 className="sm-title small">End it, or banish again?</h2>
      <div className="letters">{Array.from({ length: g.endVote?.voters ?? 0 }, (_, i) => i < sealed ? <Letter key={i} open={false} /> : <div key={i} className="letter empty" />)}</div>
      <p className="sm-lede">{sealed} of {g.endVote?.voters ?? 0} have decided · {clock(left)}</p>
      <TableTalk talk={g.talk} seat={seat} max={2} />
    </div>
  );
}

/** The unmasking: a mask lifts off each survivor's arms. */
function Unmask({ g, seat }: { g: SnakesHostView; seat: Seat }) {
  const u = g.unmask;
  useCues(`unmask:${u?.shown.length ?? 0}`, () => (u?.shown.length
    ? [{ at: serverNow(), run: () => { SFX.whoosh(); SFX.bell(0.4); captionSound('[a mask comes off]'); } }]
    : [{ at: serverNow(), run: () => { SFX.droneOn(); captionSound('[the drone rises]'); } }]));
  const alive = g.players.filter((p) => p.status === 'alive');
  const shown = new Map((u?.shown ?? []).map((x) => [x.id, x.role]));
  return (
    <div className="sm-unmask">
      {alive.map((p) => {
        const role = shown.get(p.id);
        return (
          <div key={p.id} className={`mask-card${role ? ` lifted ${role}` : ''}`}>
            <div className="face"><Arms color={seat(p.id)?.color} size={100} /><svg className="mask" viewBox="0 0 120 70" aria-hidden="true"><path d="M6 14 C40 0 80 0 114 14 C112 50 84 66 60 50 C36 66 8 50 6 14 Z" fill="#1f1a15" stroke="#c9a24a" strokeWidth="3" /><ellipse cx="38" cy="28" rx="13" ry="8" fill="#000" /><ellipse cx="82" cy="28" rx="13" ry="8" fill="#000" /></svg></div>
            <span className="nm">{seat(p.id)?.name}</span>
            <span className="role">{role ? (role === 'snake' ? 'Snake' : 'Guest') : '?'}</span>
          </div>
        );
      })}
    </div>
  );
}

function Final({ g, seat }: { g: SnakesHostView; seat: Seat }) {
  const f = g.final;
  useCues(`final:${g.stageStart}`, () => [{ at: g.stageStart, run: () => {
    SFX.droneOff();
    if (f?.winner === 'guest') { SFX.fanfare(); captionSound('[a trumpet fanfare]'); } else { SFX.finale(); captionSound('[a sinister choir]'); }
  } }]);
  if (!f) return null;
  return (
    <div className="sm-center">
      <h1 className={`sm-title ${f.winner}`}>{f.winner === 'snake' ? 'The Snakes win' : 'The Guests win'}</h1>
      <p className="sm-lede">{f.winners.map((id) => seat(id)?.name).join(', ') || 'Nobody'} {f.winners.length === 1 ? 'takes' : 'split'} {f.pot.toLocaleString()} crowns.</p>
      <p className="sm-note">The Snakes were {f.roles.filter((r) => r.role === 'snake').map((r) => seat(r.id)?.name).join(', ')}.</p>
    </div>
  );
}
