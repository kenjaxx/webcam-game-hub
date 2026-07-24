import { playTone, playGameOverSound, playCountdownBeep, setMuted, getMuted } from '../../hooks/useSound';

export { playGameOverSound, playCountdownBeep, setMuted, getMuted };

export function playScoreSound() {
  playTone({ type: 'sine', startFreq: 700, endFreq: 1000, duration: 0.15, gain: 0.25 });
}

export function playCollisionSound() {
  playTone({ type: 'sawtooth', startFreq: 150, endFreq: 40, duration: 0.3, gain: 0.3 });
}