// Salty's voice (ADR 0013, 0014). The server picks what he says, so the spice limit is a server rule: a line is
// used only at or below the room's effective spice. Audio files are made ahead of time by tools/voice/voice.mjs
// into DATA_DIR/media/voice (served, with salted unguessable names) and listed in DATA_DIR/voice/manifest.json
// (not served: it maps questions to their recordings). Without them Salty is captions only.
import { readFileSync, statSync } from 'node:fs';
import { SPICES, VOICES, isSpice, spiceAllows, spiceRank, type Spice, type VoiceId } from '@smartmouth/protocol';

/**
 * A moment Salty has lines for: the platform's own ('lobby', 'join'), trivia's ('intro', 'question', 'allRight',
 * 'allWrong', 'mixed', 'turn', 'littleRight', 'littleWrong', 'final') and each other game's, which carry the game's
 * prefix ('sm-…' for Snake Manor).
 */
export type Moment = string;

export interface Line { id: string; moment: Moment; spice: Spice; text: string }

/** What the TV says and shows now. `clips` play in order; `key` changes when there's something new to say. */
export interface SaltyCue { key: string; caption: string | null; clips: string[] }

/** Audio for a question: the prompt read aloud, each answer (picture questions), and the follow-up line. */
export interface QuestionReads { prompt: string | null; answers: Array<string | null>; explain: string | null }

interface Reads { prompt?: string; answers?: Array<string | null>; explain?: string }

interface Manifest {
  voice: string;
  model: string;
  lines: Record<string, string>;
  /** `nice` holds the warm reading, used at Mild; the top level is the snarky one (or the only one, for Littles). */
  questions: Record<string, Reads & { nice?: Reads }>;
}

// Strong words are bleeped in captions at every level (the audio keeps them, Filthy only: ADR 0014).
const BLEEP = /\b(fuck\w*|shit\w*|bastards?|bitch\w*|assholes?|dicks?|piss\w*)\b/gi;

/** Caption text: delivery tags dropped, strong words bleeped as four stars (length never gives the word away). */
export function caption(text: string): string {
  return text.replace(/\[[^\]]+\]\s*/g, '').replace(BLEEP, '★★★★').replace(/\s{2,}/g, ' ').trim();
}

export class VoiceBank {
  lines: Line[];
  manifestFile: string;
  private manifests = new Map<string, { m: Manifest | null; mtime: number; checked: number }>();

  constructor(linesFile: string, manifestFile: string) {
    const doc = JSON.parse(readFileSync(linesFile, 'utf8')) as { lines: Line[] };
    this.lines = doc.lines.filter((l) => isSpice(l.spice) && typeof l.text === 'string');
    this.manifestFile = manifestFile;
  }

  /** Each voice's recordings are listed in manifest-<voice>.json beside `manifestFile`. */
  fileFor(voice: VoiceId): string {
    return this.manifestFile.replace(/\.json$/, `-${voice}.json`);
  }

  /** A manifest is re-read when the generator rewrites it (checked at most every 10 s). */
  private load(file: string, now: number): Manifest | null {
    const c = this.manifests.get(file) ?? { m: null, mtime: 0, checked: -Infinity };
    if (now - c.checked >= 10_000) {
      c.checked = now;
      try {
        const mtime = statSync(file).mtimeMs;
        if (mtime !== c.mtime) { c.m = JSON.parse(readFileSync(file, 'utf8')) as Manifest; c.mtime = mtime; }
      } catch {
        c.m = null; c.mtime = 0;
      }
      this.manifests.set(file, c);
    }
    return c.m;
  }

  /** The room's voice; if it has no recordings yet, the other voice, then the old single manifest. */
  private current(now: number, voice: VoiceId = 'male'): Manifest | null {
    for (const v of [voice, ...VOICES.filter((x) => x !== voice)]) {
      const m = this.load(this.fileFor(v), now);
      if (m) return m;
    }
    return this.load(this.manifestFile, now);
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

  lineAudio(id: string, now: number, voice?: VoiceId): string | null {
    return this.url(this.current(now, voice)?.lines[id]);
  }

  /** At Mild a question is read nicely when there's a nice reading; above it, snarkily. */
  reads(questionId: number, now: number, voice?: VoiceId, spice: Spice = 'spicy'): QuestionReads {
    const entry = this.current(now, voice)?.questions[String(questionId)];
    const q = spice === 'mild' && entry?.nice ? entry.nice : entry;
    return { prompt: this.url(q?.prompt), answers: (q?.answers ?? []).map((f) => this.url(f)), explain: this.url(q?.explain) };
  }
}
