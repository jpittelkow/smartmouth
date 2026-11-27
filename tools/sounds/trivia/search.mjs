// Searches Freesound (CC0 only) for trivia's sound cues and writes the top candidates to a JSON file. Nothing is
// downloaded here: the owner approves the list first (design guide 4.1).
import { writeFileSync } from 'node:fs';

const CUES = [
  { id: 'join', label: 'Player joins', q: 'pop bubble cartoon', max: 1.5 },
  { id: 'start', label: 'Game starts', q: 'game show start jingle sting', max: 4 },
  { id: 'round', label: 'Round change (transition)', q: 'whoosh transition swoosh', max: 1.5 },
  { id: 'lock', label: 'Someone locks in an answer', q: 'click button pop ui', max: 0.6 },
  { id: 'tick', label: 'Countdown tick (last 5 seconds)', q: 'clock tick single', max: 0.6 },
  { id: 'timeup', label: "Time's up", q: 'game show buzzer time up', max: 1.5 },
  { id: 'reveal', label: 'Answer reveal', q: 'reveal drum hit sting', max: 2 },
  { id: 'right', label: 'Correct answer', q: 'correct answer ding chime', max: 1.8 },
  { id: 'allwrong', label: 'Nobody got it', q: 'sad trombone wah wah fail', max: 3 },
  { id: 'applause', label: 'Everyone got it', q: 'applause small crowd clapping', max: 4 },
  { id: 'slide', label: 'Leaderboard rows slide', q: 'swoosh slide whoosh short', max: 1.2 },
  { id: 'count', label: 'Scores count up', q: 'coin score counter points', max: 1.5 },
  { id: 'sparkle', label: "A Little's turn starts", q: 'magic sparkle twinkle chime', max: 2 },
  { id: 'yay', label: 'A Little gets it right', q: 'party horn celebration toy', max: 2 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const attr = (block, name) => (new RegExp(`data-${name}="([^"]*)"`).exec(block) || [])[1] ?? '';
const out = [];
for (const [n, c] of CUES.entries()) {
  if (n) await sleep(7500);
  const url = `https://freesound.org/search/?q=${encodeURIComponent(c.q)}&f=${encodeURIComponent('license:"Creative Commons 0"')}&s=${encodeURIComponent('Rating highest first')}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) { console.error(c.id, r.status); out.push({ ...c, candidates: [], error: r.status }); continue; }
  const html = await r.text();
  const blocks = html.split('class="bw-player"').slice(1);
  const found = blocks.map((b) => {
    const rating = Number((/Average rating of ([\d.]+)/.exec(b) || [])[1] || 0);
    return {
      id: attr(b, 'sound-id'), author: attr(b, 'username'), title: attr(b, 'title').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&'),
      seconds: Number(attr(b, 'duration')), downloads: Number(attr(b, 'num-downloads')), rating,
      preview: attr(b, 'mp3').replace('-lq.mp3', '-hq.mp3'),
      page: `https://freesound.org/people/${attr(b, 'username')}/sounds/${attr(b, 'sound-id')}/`,
    };
  }).filter((x) => x.id && x.preview);
  // Prefer short enough clips (we trim anyway, but not from minutes), then rating and popularity.
  const fit = found.filter((x) => x.seconds <= Math.max(c.max * 4, 6) && !/\bai\b|voice|vocal|speech|song/i.test(x.title));
  fit.sort((a, b) => (b.rating - a.rating) || (b.downloads - a.downloads));
  out.push({ ...c, candidates: fit.slice(0, 3) });
  console.log(c.id, fit.slice(0, 3).map((x) => `${x.title} (${x.author}, ${x.seconds.toFixed(1)}s, ${x.rating})`).join(' | '));
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
