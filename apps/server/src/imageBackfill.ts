// Fills in pictures for live questions that have none (owner, 2026-11-27). Runs in its own container (a deploy restarts
// the app's) with the app's settings and data:
//   docker run -d --rm --name smartmouth-images --env-file /mnt/apps/appdata/smartmouth/.env -e DATA_DIR=/data \
//     -v /mnt/apps/appdata/smartmouth/data:/data -w /app smartmouth:latest node apps/server/src/imageBackfill.ts
// LIMIT caps how many questions (default all), IDS picks specific ones, MAX_USD stops the spend (default 3), BANDS=little
// limits by youngest age. Questions that already have a picture are skipped, so it resumes.
import { join } from 'node:path';
import { openDb } from './db.ts';
import { openRouterChat } from './ai.ts';
import { picturesFor } from './imagePlanner.ts';
import { getQuestion, listQuestions, updateQuestion } from './questions.ts';

const data = process.env.DATA_DIR || '/data';
const db = openDb(join(data, 'smartmouth.db'));
const chat = openRouterChat(process.env.OPENROUTER_API_KEY!);
const limit = Number(process.env.LIMIT || 1e9);
const maxUsd = Number(process.env.MAX_USD || 3);
const ids = (process.env.IDS || '').split(',').map(Number).filter(Boolean);
const bands = (process.env.BANDS || '').split(',').filter(Boolean);

let all = listQuestions(db, { status: 'live', limit: 1000, offset: 0 }, Date.now()).items;
if (ids.length) all = all.filter((q) => ids.includes(q.id));
if (bands.length) all = all.filter((q) => bands.includes(q.ageMin));
const todo = all.filter((q) => !q.image && !(q.revealImages?.length)).slice(0, limit);
console.log(`${todo.length} questions to picture`);
let spent = 0;
for (const q0 of todo) {
  if (spent > maxUsd) { console.log(`stopping at $${spent.toFixed(2)}`); break; }
  try {
    const r = await picturesFor(db, join(data, 'media'), chat, q0);
    spent += r.cost;
    const q = getQuestion(db, q0.id, Date.now());
    if (!q) continue;
    const { id, createdAt, updatedAt, stats, playsAs, needsCheck, seedKey, ...input } = q;
    updateQuestion(db, q0.id, { ...input, image: r.image, revealImages: r.revealImages, answers: r.answers }, Date.now());
    console.log(`#${q0.id} ${q0.prompt.slice(0, 60)}\n   ${r.log.join('\n   ')}`);
  } catch (e) {
    console.log(`#${q0.id} failed: ${e instanceof Error ? e.message : e}`);
  }
}
console.log(`done, spent $${spent.toFixed(3)}`);
db.close();
