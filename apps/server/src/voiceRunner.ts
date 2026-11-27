// Records Salty reading newly published questions, in every room voice, one run at a time (tools/voice/voice.mjs
// bank keeps the files it already has, so a run only makes what's new). SALTY_VOICES says which voices:
//   SALTY_VOICES=male=elevenlabs/eleven-v4:harry,female=elevenlabs/eleven-v4:jessica
import { spawn } from 'node:child_process';

export class VoiceRunner {
  private running = false;
  private again = false;
  lastRun: { at: number; ok: boolean; output: string } | null = null;

  private tool: string;
  private voices: Array<{ slot: string; voice: string }>;
  private maxUsd: number;
  constructor(tool: string, voices: Array<{ slot: string; voice: string }>, maxUsd = 1) {
    this.tool = tool; this.voices = voices; this.maxUsd = maxUsd;
  }

  static parse(spec: string | undefined): Array<{ slot: string; voice: string }> {
    return (spec ?? '').split(',').map((x) => x.trim()).filter(Boolean).flatMap((x) => {
      const i = x.indexOf('=');
      const slot = x.slice(0, i), voice = x.slice(i + 1);
      return i > 0 && (slot === 'male' || slot === 'female') && voice.includes(':') ? [{ slot, voice }] : [];
    });
  }

  get enabled(): boolean { return this.voices.length > 0; }
  get busy(): boolean { return this.running; }

  /** Asks for a run; if one is going, another follows it. */
  request(): void {
    if (!this.enabled) return;
    if (this.running) { this.again = true; return; }
    void this.loop();
  }

  private async loop(): Promise<void> {
    this.running = true;
    try {
      do {
        this.again = false;
        for (const v of this.voices) await this.runOne(v);
      } while (this.again);
    } finally {
      this.running = false;
    }
  }

  private runOne(v: { slot: string; voice: string }): Promise<void> {
    return new Promise((done) => {
      const child = spawn(process.execPath, [this.tool, 'bank'], {
        env: { ...process.env, SLOT: v.slot, VOICE: v.voice, MAX_USD: String(this.maxUsd) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      const keep = (b: Buffer) => { out = (out + b.toString()).slice(-2000); };
      child.stdout.on('data', keep);
      child.stderr.on('data', keep);
      child.on('close', (code) => {
        this.lastRun = { at: Date.now(), ok: code === 0, output: out.trim().split('\n').slice(-3).join('\n') };
        console.log(`voice ${v.slot}: ${this.lastRun.output.split('\n').pop()}`);
        done();
      });
      child.on('error', () => done());
    });
  }
}
