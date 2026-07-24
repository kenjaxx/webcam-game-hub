import { playTone, playGameOverSound, playCountdownBeep, setMuted, getMuted } from '../../hooks/useSound';

export { playGameOverSound, playCountdownBeep, setMuted, getMuted };

export function playWhackSound() {
  playTone({ type: 'square', startFreq: 200, endFreq: 50, duration: 0.15, gain: 0.3 });
}