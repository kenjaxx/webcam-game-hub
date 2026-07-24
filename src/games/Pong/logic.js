export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 360;

export const PADDLE_WIDTH = 12;
export const PADDLE_HEIGHT = 80;
export const BALL_RADIUS = 8;

export const PLAYER_X = 24; // left edge of the player's paddle
export const AI_X = CANVAS_WIDTH - 24 - PADDLE_WIDTH; // left edge of the AI's paddle

export const STARTING_LIVES = 5;
export const MAX_BALL_SPEED = 11;

export const DIFFICULTY_SETTINGS = {
  easy: { ballSpeed: 4.2, aiSpeed: 3.0, aiReaction: 0.65, label: 'Easy' },
  medium: { ballSpeed: 5.2, aiSpeed: 4.1, aiReaction: 0.82, label: 'Medium' },
  hard: { ballSpeed: 6.2, aiSpeed: 5.3, aiReaction: 1.0, label: 'Hard' },
};

// Creates a fresh ball at center court, launched toward one side with a random angle.
// towardPlayer: true = serves toward the player (left), false = toward AI (right), null = random.
export function createBall(speed, towardPlayer = null) {
  const direction =
    towardPlayer === null ? (Math.random() < 0.5 ? -1 : 1) : towardPlayer ? -1 : 1;
  const angle = (Math.random() - 0.5) * (Math.PI / 4); // up to +/-45 degrees

  return {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    vx: Math.cos(angle) * speed * direction,
    vy: Math.sin(angle) * speed,
    speed,
  };
}

export function updateBallPhysics(ball, dt) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Bounce off top/bottom walls
  if (ball.y - BALL_RADIUS < 0) {
    ball.y = BALL_RADIUS;
    ball.vy = Math.abs(ball.vy);
    return 'wall';
  } else if (ball.y + BALL_RADIUS > CANVAS_HEIGHT) {
    ball.y = CANVAS_HEIGHT - BALL_RADIUS;
    ball.vy = -Math.abs(ball.vy);
    return 'wall';
  }
  return null;
}

// Swept collision check: rather than testing only the ball's post-move position (which lets
// a fast ball tunnel clean through a thin paddle within a single frame), this checks whether
// the ball's path THIS FRAME crossed the paddle's collision plane, and interpolates the exact
// y position at the moment of crossing to test against the paddle's height range.
export function checkPaddleCollision(ball, prevX, prevY, paddleY, paddleX, paddleIsLeft) {
  // The plane is where the ball's center would be when its edge just touches the paddle face.
  const plane = paddleIsLeft ? paddleX + PADDLE_WIDTH + BALL_RADIUS : paddleX - BALL_RADIUS;

  let crossed = false;
  let t = 0;

  if (paddleIsLeft) {
    // Ball moving left/toward player paddle: crossed if it started at/after the plane
    // and ended at/before it.
    if (ball.vx < 0 && prevX >= plane && ball.x <= plane) {
      crossed = true;
      t = prevX === ball.x ? 0 : (prevX - plane) / (prevX - ball.x);
    }
  } else {
    if (ball.vx > 0 && prevX <= plane && ball.x >= plane) {
      crossed = true;
      t = prevX === ball.x ? 0 : (plane - prevX) / (ball.x - prevX);
    }
  }

  if (!crossed) return false;

  // Interpolate where the ball actually was, vertically, at the moment it crossed the plane
  const yAtCross = prevY + (ball.y - prevY) * t;
  const withinY = yAtCross >= paddleY - PADDLE_HEIGHT / 2 && yAtCross <= paddleY + PADDLE_HEIGHT / 2;

  if (!withinY) return false;

  // Speed up slightly with every rally, capped so it never becomes unplayable
  ball.speed = Math.min(ball.speed * 1.045, MAX_BALL_SPEED);

  // Where the ball struck the paddle determines the new angle (edges = sharper angle)
  const relativeIntersect = (yAtCross - paddleY) / (PADDLE_HEIGHT / 2);
  const maxBounceAngle = Math.PI / 3; // 60 degrees
  const bounceAngle = relativeIntersect * maxBounceAngle;
  const dir = paddleIsLeft ? 1 : -1;

  ball.vx = Math.cos(bounceAngle) * ball.speed * dir;
  ball.vy = Math.sin(bounceAngle) * ball.speed;

  // Snap the ball to exactly the collision point so it can't have already visually passed through
  ball.x = plane;
  ball.y = yAtCross;

  return true;
}

// Moves the AI paddle toward the ball, capped by speed, with imperfect "reaction" accuracy
// so lower difficulties visibly miss more.
export function updateAIPaddle(aiPaddleY, ball, settings, dt) {
  const targetY = ball.y;
  const diff = targetY - aiPaddleY;
  const maxMove = settings.aiSpeed * settings.aiReaction * dt;
  const move = Math.max(-maxMove, Math.min(maxMove, diff));
  return clampPaddleY(aiPaddleY + move);
}

export function clampPaddleY(y) {
  return Math.max(PADDLE_HEIGHT / 2, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT / 2, y));
}