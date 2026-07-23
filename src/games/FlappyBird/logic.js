export const BIRD_X = 100; // bird's fixed horizontal position
export const BIRD_RADIUS = 18;
export const PIPE_WIDTH = 60;
export const GRAVITY = 0.4; // fall speed when hand not detected
export const PIPE_SPAWN_DISTANCE = 220; // horizontal gap between pipe spawns

export const DIFFICULTY_SETTINGS = {
  easy: { speed: 1.8, gapSize: 170, label: 'Easy' },
  medium: { speed: 2.5, gapSize: 140, label: 'Medium' },
  hard: { speed: 3.3, gapSize: 110, label: 'Hard' },
};

// Creates a new pipe with a random gap position
export function createPipe(canvasWidth, canvasHeight, gapSize) {
  const minGapY = gapSize / 2 + 30;
  const maxGapY = canvasHeight - gapSize / 2 - 30;
  const gapY = minGapY + Math.random() * (maxGapY - minGapY);

  return {
    x: canvasWidth,
    gapY,
    gapSize,
    passed: false,
    id: Math.random().toString(36).slice(2),
  };
}

// Checks collision between bird (circle) and a pipe (two rectangles: top + bottom)
export function checkPipeCollision(birdY, pipe, canvasHeight) {
  const birdLeft = BIRD_X - BIRD_RADIUS;
  const birdRight = BIRD_X + BIRD_RADIUS;
  const birdTop = birdY - BIRD_RADIUS;
  const birdBottom = birdY + BIRD_RADIUS;

  const pipeLeft = pipe.x;
  const pipeRight = pipe.x + PIPE_WIDTH;

  // No horizontal overlap - no collision possible
  if (birdRight < pipeLeft || birdLeft > pipeRight) return false;

  const gapTop = pipe.gapY - pipe.gapSize / 2;
  const gapBottom = pipe.gapY + pipe.gapSize / 2;

  // Collision if bird overlaps the top pipe or bottom pipe (i.e., not within the gap)
  const hitsTopPipe = birdTop < gapTop;
  const hitsBottomPipe = birdBottom > gapBottom;

  return hitsTopPipe || hitsBottomPipe;
}

export function checkBoundsCollision(birdY, canvasHeight) {
  return birdY - BIRD_RADIUS < 0 || birdY + BIRD_RADIUS > canvasHeight;
}