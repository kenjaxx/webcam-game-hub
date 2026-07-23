export const FRUIT_RADIUS = 28;
export const GRAVITY = 0.25;
export const STARTING_LIVES = 3;
export const SWIPE_SPEED_THRESHOLD = 8; // min px/frame movement to count as a "slice" motion
export const BOMB_CHANCE = 0.12;

export const DIFFICULTY_SETTINGS = {
  easy: { spawnRate: 1400, launchSpeedMin: 9, launchSpeedMax: 12, label: 'Easy' },
  medium: { spawnRate: 1000, launchSpeedMin: 11, launchSpeedMax: 14, label: 'Medium' },
  hard: { spawnRate: 700, launchSpeedMin: 13, launchSpeedMax: 16, label: 'Hard' },
};

const FRUIT_TYPES = [
  { emoji: '🍎', color: '#e53935' },
  { emoji: '🍊', color: '#fb8c00' },
  { emoji: '🍉', color: '#43a047' },
  { emoji: '🍇', color: '#8e24aa' },
  { emoji: '🍋', color: '#fdd835' },
  { emoji: '🍓', color: '#e91e63' },
];

// Spawns a fruit (or bomb) from the bottom of the screen with an upward arc trajectory
export function createFruit(canvasWidth, canvasHeight, difficultySettings) {
  const isBomb = Math.random() < BOMB_CHANCE;
  const x = canvasWidth * 0.15 + Math.random() * canvasWidth * 0.7;
  const launchSpeed =
    difficultySettings.launchSpeedMin +
    Math.random() * (difficultySettings.launchSpeedMax - difficultySettings.launchSpeedMin);

  // Aim roughly toward the upper-middle area so fruit arcs nicely into view
  const vx = (canvasWidth / 2 - x) / 40 + (Math.random() - 0.5) * 2;
  const vy = -launchSpeed;

  const fruitType = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];

  return {
    id: Math.random().toString(36).slice(2),
    x,
    y: canvasHeight + FRUIT_RADIUS,
    vx,
    vy,
    radius: FRUIT_RADIUS,
    isBomb,
    emoji: isBomb ? '💣' : fruitType.emoji,
    color: isBomb ? '#333' : fruitType.color,
    sliced: false,
    spawnTime: Date.now(),
  };
}

export function updateFruitPhysics(fruit, dt) {
  fruit.x += fruit.vx * dt;
  fruit.y += fruit.vy * dt;
  fruit.vy += GRAVITY * dt;
}

// Distance-based check: did the swipe trail pass close enough to the fruit's center?
export function isPointNearFruit(pointX, pointY, fruit) {
  const distance = Math.hypot(pointX - fruit.x, pointY - fruit.y);
  return distance < fruit.radius + 10; // small forgiveness margin
}

export function getComboMultiplier(streak) {
  return Math.min(1 + Math.floor(streak / 4), 4);
}