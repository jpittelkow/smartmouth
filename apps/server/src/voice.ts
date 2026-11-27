// Salty's voice (ADR 0013, 0014). The server picks what he says, so the spice limit is a server rule: a line is
// used only at or below the room's effective spice. Audio files are made ahead of time by tools/voice/bank.mjs
// into DATA_DIR/media/voice, listed in its manifest.json; without them Salty is captions only.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SPICES, isSpice, spiceAllows, spiceRank, type Spice } from '@smartmouth/protocol';

export type Moment = 'lobby' | 'join' | 'intro' | 'question' | 'allRight' | 'allWrong' | 'mixed' | 'turn'
  | 'littleRight' | 'littleWrong' | 'final';

export interface Line { id: string; moment: Moment; spice: Spice; text: string }

/** What the TV says and shows now. `clips` play in order; `key` changes when there's something new to say. */
export interface SaltyCue { key: string; caption: string | null; clips: string[] }

/** Audio for a question: the prompt read aloud, each answer (picture questions), and the follow-up line. */
export interface QuestionReads { prompt: string | null; answers: Array<string | null>; explain: string | null }

interface Manifest {
  voice: string;
  model: string;
  lines: Record<string, string>;
  questions: Record<string, { prompt?: string; answers?: Array<string | null>; explain?: string }>;
}

// Strong words are bleeped in captions at every level (the audio keeps them, Filthy only: ADR 0014).
const BLEEP = /\b(fuck\w*|shit\w*|bastards?|bitch\w*|assholes?|dicks?|piss\w*)\b/gi;

/** Caption text: delivery tags dropped, strong words bleeped as four stars (length never gives the word away). */
export function caption(text: string): string {
  return text.replace(/\[[^\]]+\]\s*/g, '').replace(BLEEP, '★★★★').replace(/\s{2,}/g, ' ').trim();
}

export class VoiceBank {
  lines: Line[];
  mediaDir: string;
  private manifest: Manifest | null = null;
  private manifestMtime = 0;
  private lastCheck = 0;

  constructor(linesFile: string, mediaDir: string) {
    const doc = JSON.parse(readFileSync(linesFile, 'utf8')) as { lines: Line[] };
    this.lines = doc.lines.filter((l) => isSpice(l.spice) && typeof l.text === 'string');
    this.mediaDir = mediaDir;
  }

  /** The manifest is re-read when the generator rewrites it (checked at most every 10 s). */
  private current(now: number): Manifest | null {
    if (now - this.lastCheck < 10_000) return this.manifest;
    this.lastCheck = now;
    const file = join(this.mediaDir, 'voice', 'manifest.json');
    try {
      const m = statSync(file).mtimeMs;
      if (m !== this.manifestMtime) {
        this.manifest = JSON.parse(readFileSync(file, 'utf8')) as Manifest;
        this.manifestMtime = m;
      }
    } catch {
      this.manifest = null;
    }
    return this.manifest;
  }

  private url(file: string | null | undefined): string | null {
    return file ? `/media/voice/${file}` : null;
  }

  /**
   * Picks a line for a moment: never above `spice`, preferring the room's exact level, then the next level down,
   * and avoiding the lines in `recent`.
   */
  pick(moment: Moment, spice: Spice, recent: ReadonlySet<string>, rand: () => number = Math.random): Line | null {
    const allowed = this.lines.filter((l) => l.moment === moment && spiceAllows(spice, l.spice));
    for (let r = spiceRank(spice); r >= 0; r--) {
      const level = allowed.filter((l) => l.spice === SPICES[r]);
      const fresh = level.filter((l) => !recent.has(l.id));
      const pool = fresh.length ? fresh : level;
      if (pool.length) return pool[Math.floor(rand() * pool.length)] ?? null;
    }
    return null;
  }

  lineAudio(id: string, now: number): string | null {
    return this.url(this.current(now)?.lines[id]);
  }

  reads(questionId: number, now: number): QuestionReads {
    const q = this.current(now)?.questions[String(questionId)];
    return { prompt: this.url(q?.prompt), answers: (q?.answers ?? []).map((f) => this.url(f)), explain: this.url(q?.explain) };
  }
}
