let audioContext = null;
let isMuted = false;

export function setMuted(muted) {
  isMuted = muted;
}

export function getMuted() {
  return isMuted;
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

// Plays a single tone with an exponential-decay envelope. Every game's sound
// effects are just different parameter presets on top of this one function.
export function playTone({ type = 'sine', startFreq, endFreq = startFreq, duration = 0.15, gain = 0.25, delay = 0 }) {
  if (isMuted) return;
  const ctx = getAudioContext();
  const startTime = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFreq, startTime);
  if (endFreq !== startFreq) {
    oscillator.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration * 0.7);
  }

  gainNode.gain.setValueAtTime(gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

// Shared across all four games.
export function playGameOverSound() {
  [400, 350, 300, 250].forEach((freq, i) => {
    playTone({ type: 'sine', startFreq: freq, duration: 0.14, gain: 0.2, delay: i * 0.15 });
  });
}

export function playCountdownBeep() {
  playTone({ type: 'sine', startFreq: 600, duration: 0.1, gain: 0.2 });
}