// Salty's voice (ADR 0013, 0014). The server picks what he says, so the spice limit is a server rule: a line is
// used only at or below the room's effective spice. Audio files are made ahead of time by tools/voice/voice.mjs
// into DATA_DIR/media/voice (served, with salted unguessable names) and listed in DATA_DIR/voice/manifest.json
// (not served: it maps questions to their recordings). Without them Salty is captions only.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SPICES, VOICES, isSpice, spiceAllows, spiceRank, type Spice, type VoiceId } from '@smartmouth/protocol';

/**
 * A moment Salty has lines for: the platform's own ('lobby', 'join'), trivia's ('intro', 'question', 'allRight',
 * 'allWrong', 'mixed', 'turn', 'littleRight', 'littleWrong', 'final') and each other game's, which carry the game's
 * prefix ('sm-…' for Snake Manor).
 */
export type Moment = string;

/** `stage` is set on Drunk lines only (1 Buzzed, 2 Tipsy, 3 Hammered, 4 Gone: docs/design/drunk-salty-script.md). */
export interface Line { id: string; moment: Moment; spice: Spice; text: string; stage?: number }

/** What the TV says and shows now. `clips` play in order; `key` changes when there's something new to say. */
export interface SaltyCue { key: string; caption: string | null; clips: string[]; drunk?: number }

/** Audio for a question: the prompt read aloud, each answer (picture questions), and the follow-up line. */
export interface QuestionReads { prompt: string | null; answers: Array<string | null>; explain: string | null }

interface Reads { prompt?: string; answers?: Array<string | null>; explain?: string }

interface Manifest {
  voice: string;
  model: string;
  lines: Record<string, string>;
  /** The words each line's recording says. A clip plays only when they match the line's current text, so a rewrite
   * that reuses an id never plays the old joke under the new caption (found in the 2026-11-27 TV test). */
  lineText?: Record<string, string>;
  /** `nice` holds the warm reading, used at Mild; the top level is the snarky one (or the only one, for Littles). */
  questions: Record<string, Reads & { nice?: Reads }>;
}

// Strong words are bleeped in captions at every level (the audio keeps them, Filthy only: ADR 0014).
const BLEEP = /\b(fuck\w*|shit\w*|bastards?|bitch\w*|assholes?|dicks?|piss\w*)\b/gi;

/** Caption text: delivery tags and {sound} markers dropped, strong words bleeped as four stars (length never gives the word away). */
export function caption(text: string): string {
  return text.replace(/\[[^\]]+\]\s*/g, '').replace(/\{[^}]+\}\s*/g, '').replace(BLEEP, '★★★★').replace(/\s{2,}/g, ' ').trim();
}

export class VoiceBank {
  lines: Line[];
  manifestFile: string;
  private manifests = new Map<string, { m: Manifest | null; mtime: number; checked: number }>();

  /** DATA_DIR/media: where the clips are, to measure them. */
  mediaDir: string | null;
  private lengths = new Map<string, number>();

  constructor(linesFile: string, manifestFile: string, mediaDir: string | null = null) {
    this.mediaDir = mediaDir;
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
   * and avoiding the lines in `recent`. At Drunk, `stage` (1-4) chooses among the drunk lines. With `voiced`, lines that have a recording come first, so a newly written line
   * isn't shown silently while the bank is still recording it (2026-11-27).
   */
  pick(
    moment: Moment, spice: Spice, recent: ReadonlySet<string>, rand: () => number = Math.random, voiced?: (l: Line) => boolean,
    stage = 1,
  ): Line | null {
    let allowed = this.lines.filter((l) => l.moment === moment && spiceAllows(spice, l.spice));
    if (voiced) { const rec = allowed.filter(voiced); if (rec.length) allowed = rec; }
    const choose = (level: Line[]) => {
      const fresh = level.filter((l) => !recent.has(l.id));
      const pool = fresh.length ? fresh : level;
      return pool.length ? pool[Math.floor(rand() * pool.length)] ?? null : null;
    };
    // Drunk: the line for this stage, or the nearest earlier stage (never a drunker one: she doesn't sober up and
    // slur ahead); with no drunk line for the moment at all, a Filthy one.
    if (spice === 'drunk') {
      for (let st = stage; st >= 1; st--) {
        const line = choose(allowed.filter((l) => l.spice === 'drunk' && (l.stage ?? 1) === st));
        if (line) return line;
      }
    }
    for (let r = spiceRank(spice === 'drunk' ? 'filthy' : spice); r >= 0; r--) {
      const line = choose(allowed.filter((l) => l.spice === SPICES[r]));
      if (line) return line;
    }
    return null;
  }

  /**
   * How long clips run, in ms, estimated from file size: our mp3s are 128 kbit/s (16 bytes a ms), Gemini's wav is
   * 24 kHz 16-bit mono (48 bytes a ms). A missing file counts as 0.
   */
  clipsMs(urls: readonly string[]): number {
    if (!this.mediaDir) return 0;
    let total = 0;
    for (const url of urls) {
      let ms = this.lengths.get(url);
      if (ms === undefined) {
        ms = 0;
        try {
          const size = statSync(join(this.mediaDir, url.replace(/^\/media\//, ''))).size;
          ms = url.endsWith('.wav') ? Math.max(0, size - 44) / 48 : size / 16;
        } catch { /* not recorded */ }
        this.lengths.set(url, ms);
      }
      total += ms;
    }
    return Math.round(total);
  }

  /** The recording of a line, only if it says `text` (manifests made before lineText existed play nothing). */
  lineAudio(id: string, now: number, voice?: VoiceId, text?: string): string | null {
    const m = this.current(now, voice);
    if (!m || (text !== undefined && m.lineText?.[id] !== text)) return null;
    return this.url(m.lines[id]);
  }

  /** At Mild a question is read nicely when there's a nice reading; above it, snarkily. */
  reads(questionId: number, now: number, voice?: VoiceId, spice: Spice = 'spicy'): QuestionReads {
    const entry = this.current(now, voice)?.questions[String(questionId)];
    const q = spice === 'mild' && entry?.nice ? entry.nice : entry;
    return { prompt: this.url(q?.prompt), answers: (q?.answers ?? []).map((f) => this.url(f)), explain: this.url(q?.explain) };
  }
}
