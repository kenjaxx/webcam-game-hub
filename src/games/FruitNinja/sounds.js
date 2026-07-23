let audioContext = null;
let isMuted = false;

export function setMuted(muted) {
  isMuted = muted;
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

export function playSliceSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(900, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);

  gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.1);
}

export function playBombSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(200, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.5);

  gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.5);
}

export function playMissSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(180, ctx.currentTime);
  gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.2);
}

export function playGameOverSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  const notes = [400, 350, 300, 250];

  notes.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);

    gainNode.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.14);

    oscillator.start(ctx.currentTime + i * 0.15);
    oscillator.stop(ctx.currentTime + i * 0.15 + 0.14);
  });
}

export function playCountdownBeep() {
  if (isMuted) return;
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(600, ctx.currentTime);
  gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.1);
}