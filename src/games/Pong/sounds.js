import { playTone, playGameOverSound, playCountdownBeep, setMuted, getMuted } from '../../hooks/useSound';

export { playGameOverSound, playCountdownBeep, setMuted, getMuted };

export function playPaddleHitSound() {
  playTone({ type: 'square', startFreq: 300, endFreq: 500, duration: 0.08, gain: 0.2 });
}

export function playWallBounceSound() {
  playTone({ type: 'sine', startFreq: 500, duration: 0.05, gain: 0.12 });
}

export function playScoreSound() {
  playTone({ type: 'sine', startFreq: 700, endFreq: 1050, duration: 0.18, gain: 0.25 });
}

export function playMissSound() {
  playTone({ type: 'sawtooth', startFreq: 180, endFreq: 50, duration: 0.3, gain: 0.3 });
}