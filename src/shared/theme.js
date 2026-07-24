export const THEME = {
  bgGradientTop: '#1a1428',
  bgGradientBottom: '#0a0714',
  grid: 'rgba(180, 91, 255, 0.12)',
  accent: '#aa3bff',
  accentBright: '#c084fc',
  cyan: '#35e6ff',
  gold: '#ffbb3d',
  danger: '#ff6b6b',
  success: '#4dd0a5',
  text: '#f4f0ff',
  textMuted: '#a79fc2',
  fontHeading: "'Chakra Petch', system-ui, sans-serif",
};

// Draws the shared grid + gradient backdrop behind gameplay, matching the
// arcade homepage/menu look, so every game feels like part of one product.
export function drawArcadeBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, THEME.bgGradientTop);
  gradient.addColorStop(1, THEME.bgGradientBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = THEME.grid;
  ctx.lineWidth = 1;
  const step = 30;
  for (let x = 0; x <= width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}