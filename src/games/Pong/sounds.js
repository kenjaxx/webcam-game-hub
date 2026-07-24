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

export function playPaddleHitSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(300, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.06);

  gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.08);
}

export function playWallBounceSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(500, ctx.currentTime);

  gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.05);
}

export function playScoreSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(700, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1050, ctx.currentTime + 0.12);

  gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.18);
}

export function playMissSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(180, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);

  gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.3);
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