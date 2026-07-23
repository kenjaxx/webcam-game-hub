export const GRID_ROWS = 3;
export const GRID_COLS = 3;
export const HOLE_RADIUS = 50;
export const GAME_DURATION = 30;

export const DIFFICULTY_SETTINGS = {
  easy: { spawnRate: 1500, label: 'Easy' },
  medium: { spawnRate: 1000, label: 'Medium' },
  hard: { spawnRate: 650, label: 'Hard' },
};

export function getHolePositions(canvasWidth, canvasHeight) {
  const positions = [];
  const paddingX = canvasWidth / (GRID_COLS + 1);
  const paddingY = canvasHeight / (GRID_ROWS + 1);

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      positions.push({
        id: row * GRID_COLS + col,
        x: paddingX * (col + 1),
        y: paddingY * (row + 1),
      });
    }
  }
  return positions;
}

export function getRandomHoleIndex(totalHoles, excludeIndex = null) {
  let index;
  do {
    index = Math.floor(Math.random() * totalHoles);
  } while (index === excludeIndex && totalHoles > 1);
  return index;
}

export function isWithinHole(pointX, pointY, holeX, holeY, radius = HOLE_RADIUS) {
  const distance = Math.hypot(pointX - holeX, pointY - holeY);
  return distance < radius;
}

// Combo multiplier: every 3 consecutive hits increases multiplier by 1 (caps at 5x)
export function getComboMultiplier(streak) {
  return Math.min(1 + Math.floor(streak / 3), 5);
}

// 15% chance a spawned mole is a rare golden mole (worth more points)
export function isGoldenMole() {
  return Math.random() < 0.15;
}