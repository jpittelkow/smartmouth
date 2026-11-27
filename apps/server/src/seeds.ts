// Loads the hand-written seed questions (content/seed/*.json) into the library at start-up (ADR 0010).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateQuestion, type QuestionInput } from '@smartmouth/protocol';
import type { Db } from './db.ts';
import { importSeeds } from './questions.ts';

/** Seed files list answers as plain strings for brevity; the library stores {text, image}. */
export function readSeeds(dir: string): { seeds: Array<{ key: string; question: QuestionInput }>; problems: string[] } {
  const seeds: Array<{ key: string; question: QuestionInput }> = [];
  const problems: string[] = [];
  let files: string[] = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort(); } catch { return { seeds, problems: [`no seed folder at ${dir}`] }; }
  const keys = new Set<string>();
  for (const f of files) {
    const doc = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { questions?: Array<Record<string, unknown>> };
    for (const raw of doc.questions ?? []) {
      const key = typeof raw.key === 'string' ? raw.key : '';
      if (!key || keys.has(key)) { problems.push(`${f}: missing or repeated key "${key}"`); continue; }
      keys.add(key);
      const v = validateQuestion({ source: 'seed', ...raw });
      if (v.ok) seeds.push({ key, question: v.value });
      else problems.push(`${f} ${key}: ${Object.values(v.errors).join(' ')}`);
    }
  }
  return { seeds, problems };
}

export function loadSeeds(db: Db, dir: string, now: number): { added: number; problems: string[] } {
  const { seeds, problems } = readSeeds(dir);
  return { added: importSeeds(db, seeds, now), problems };
}
