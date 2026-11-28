// Salty on the TV: her mark talks while her audio plays. No caption text (owner, 2026-11-27: "we don't need the words
// she's saying"; it gives the screen a whole row back). She sits in the top bar, so the layout has no Salty row.
import type { SaltyCue } from '@smartmouth/protocol';
import { HOST_NAME } from '@smartmouth/protocol';
import { Grin } from '../ui/art.tsx';
import { useSalty } from './voice.ts';

export function SaltyBadge({ cue }: { cue: SaltyCue | null }) {
  const { talking, blocked } = useSalty(cue);
  return (
    <div className={`salty-badge${talking ? ' talking' : ''}`} aria-label={talking ? `${HOST_NAME} is talking` : HOST_NAME}>
      <Grin talking={talking} />
      {blocked && <span className="sound-hint">Press any key or click to hear {HOST_NAME}.</span>}
    </div>
  );
}
