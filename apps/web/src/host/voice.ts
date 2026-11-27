// Plays Salty on the TV (ADR 0013): one cue at a time, its clips in order; a new cue cuts the old one off.
// The TV app's WebView allows sound without a tap; a desktop browser needs one click or key first, so the page
// shows a hint until then.
import { useEffect, useSyncExternalStore } from 'react';
import type { SaltyCue } from '@smartmouth/protocol';

type State = { talking: boolean; blocked: boolean };
let state: State = { talking: false, blocked: false };
const listeners = new Set<() => void>();
const set = (s: Partial<State>) => { state = { ...state, ...s }; for (const l of listeners) l(); };

const audio = typeof Audio !== 'undefined' ? new Audio() : null;
let queue: string[] = [];
let lastKey = '';
let gen = 0;

function next(myGen: number) {
  if (!audio || myGen !== gen) return;
  const src = queue.shift();
  if (!src) { set({ talking: false }); return; }
  audio.src = src;
  audio.play().then(() => set({ talking: true, blocked: false })).catch((e: unknown) => {
    // Autoplay blocked: wait for a click or key, then carry on from this clip.
    if (e instanceof DOMException && e.name === 'NotAllowedError') { queue.unshift(src); set({ talking: false, blocked: true }); }
    else next(myGen);
  });
}

if (audio) {
  audio.addEventListener('ended', () => next(gen));
  audio.addEventListener('error', () => next(gen));
  const unlock = () => { if (state.blocked) { set({ blocked: false }); next(gen); } };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
}

/** Say a new cue (ignored if it's the one already said). */
export function say(cue: SaltyCue | null) {
  if (!cue || cue.key === lastKey) return;
  lastKey = cue.key;
  gen++;
  audio?.pause();
  queue = [...cue.clips];
  next(gen);
}

/** A one-off clip (a Little's answer as the remote moves): plays after whatever Salty is saying. */
export function sayClip(src: string | null | undefined) {
  if (!src || !audio) return;
  if (state.talking || queue.length) { queue.push(src); return; }
  gen++;
  queue = [src];
  next(gen);
}

export function useSalty(cue: SaltyCue | null): State {
  useEffect(() => { say(cue); }, [cue?.key]);
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}
