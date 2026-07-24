import { playTone, playGameOverSound, playCountdownBeep, setMuted, getMuted } from '../../hooks/useSound';

export { playGameOverSound, playCountdownBeep, setMuted, getMuted };

export function playSliceSound() {
  playTone({ type: 'triangle', startFreq: 900, endFreq: 300, duration: 0.1, gain: 0.25 });
}

export function playBombSound() {
  playTone({ type: 'sawtooth', startFreq: 200, endFreq: 20, duration: 0.5, gain: 0.4 });
}

export function playMissSound() {
  playTone({ type: 'sine', startFreq: 180, duration: 0.2, gain: 0.2 });
}