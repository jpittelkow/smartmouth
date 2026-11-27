// Salty's caption strip on the TV: the grin talks while his audio plays (design guide §5.5, §7 captions).
import type { SaltyCue } from '@smartmouth/protocol';
import { HOST_NAME } from '@smartmouth/protocol';
import { Grin } from '../ui/art.tsx';
import { useSalty } from './voice.ts';

export function SaltyStrip({ cue }: { cue: SaltyCue | null }) {
  const { talking, blocked } = useSalty(cue);
  return (
    <div className={`caption${talking ? ' talking' : ''}`} role="status">
      <Grin talking={talking} />
      <span>
        <span className="who">{HOST_NAME}:</span> {cue?.caption ?? '…'}
        {blocked && <span className="sound-hint"> Press any key or click to hear {HOST_NAME}.</span>}
      </span>
    </div>
  );
}
