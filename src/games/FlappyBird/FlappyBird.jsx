import { useEffect, useRef, useState } from 'react';
import WebcamFeed from '../../components/WebcamFeed';
import {
  BIRD_X,
  BIRD_RADIUS,
  PIPE_WIDTH,
  GRAVITY,
  PIPE_SPAWN_DISTANCE,
  DIFFICULTY_SETTINGS,
  createPipe,
  checkPipeCollision,
  checkBoundsCollision,
} from './logic';
import { playScoreSound, playCollisionSound, playGameOverSound, playCountdownBeep, setMuted } from './sounds';
import { getHighScore, saveHighScoreIfBetter } from './storage';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 360;

export default function FlappyBird({ onExit }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);

  const [difficulty, setDifficulty] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Game state kept in refs since it updates every frame (avoids excessive re-renders)
  const birdY = useRef(CANVAS_HEIGHT / 2);
  const birdVelocity = useRef(0);
  const pipes = useRef([]);
  const particles = useRef([]);
  const lastFrameTime = useRef(null);
  const screenShake = useRef(0);
  const gameActiveRef = useRef(false); // mirrors gameActive but readable inside draw() without stale closures
  const scoreRef = useRef(0);
  const hasCollidedRef = useRef(false);

  const gameActive = difficulty && countdown === null && !gameOver;
  gameActiveRef.current = gameActive;

  // Fullscreen tracking
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  // Countdown sequence
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      const timeout = setTimeout(() => setCountdown(null), 500);
      return () => clearTimeout(timeout);
    }

    playCountdownBeep();
    const timeout = setTimeout(() => setCountdown((prev) => prev - 1), 800);
    return () => clearTimeout(timeout);
  }, [countdown]);

  // Reset game state whenever a fresh round starts (difficulty just chosen)
  function startNewRound(chosenDifficulty) {
    birdY.current = CANVAS_HEIGHT / 2;
    birdVelocity.current = 0;
    pipes.current = [createPipe(CANVAS_WIDTH, CANVAS_HEIGHT, DIFFICULTY_SETTINGS[chosenDifficulty].gapSize)];
    particles.current = [];
    lastFrameTime.current = null;
    screenShake.current = 0;
    scoreRef.current = 0;
    hasCollidedRef.current = false;
    setScore(0);
    setGameOver(false);
    setIsNewHighScore(false);
    setDifficulty(chosenDifficulty);
    setCountdown(3);
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      particles.current.push({
        x,
        y,
        vx: Math.cos(angle) * (2 + Math.random() * 3),
        vy: Math.sin(angle) * (2 + Math.random() * 3),
        startTime: Date.now(),
        color,
      });
    }
  }

  function triggerGameOver() {
    if (hasCollidedRef.current) return; // prevent double-trigger in same frame
    hasCollidedRef.current = true;
    playCollisionSound();
    spawnParticles(BIRD_X, birdY.current, 'rgba(255, 200, 50, ALPHA)');
    screenShake.current = 10;

    setTimeout(() => {
      playGameOverSound();
      setGameOver(true);
      const isNew = saveHighScoreIfBetter(difficulty, scoreRef.current);
      setIsNewHighScore(isNew);
    }, 300);
  }

  function draw(handData) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    setHandDetected(!!handData);

    // Calculate delta time for frame-rate-independent movement
    const now = Date.now();
    const dt = lastFrameTime.current ? Math.min((now - lastFrameTime.current) / 16.67, 3) : 1;
    lastFrameTime.current = now;

    // --- UPDATE ---
    if (gameActiveRef.current && !hasCollidedRef.current) {
      if (handData) {
        // Direct control: bird follows hand height, with light smoothing for natural feel
        const targetY = handData.y * CANVAS_HEIGHT;
        birdY.current += (targetY - birdY.current) * 0.25;
        birdVelocity.current = 0;
      } else {
        // No hand detected - gravity takes over, bird falls
        birdVelocity.current += GRAVITY * dt;
        birdY.current += birdVelocity.current * dt;
      }

      const speed = DIFFICULTY_SETTINGS[difficulty].speed * dt;

      // Move pipes left, check scoring, remove off-screen pipes
      pipes.current.forEach((pipe) => {
        pipe.x -= speed;
        if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
          pipe.passed = true;
          scoreRef.current += 1;
          setScore(scoreRef.current);
          playScoreSound();
        }
      });
      pipes.current = pipes.current.filter((pipe) => pipe.x + PIPE_WIDTH > -20);

      // Spawn new pipe when the last one is far enough left
      const lastPipe = pipes.current[pipes.current.length - 1];
      if (!lastPipe || CANVAS_WIDTH - lastPipe.x >= PIPE_SPAWN_DISTANCE) {
        pipes.current.push(createPipe(CANVAS_WIDTH, CANVAS_HEIGHT, DIFFICULTY_SETTINGS[difficulty].gapSize));
      }

      // Collision checks
      if (checkBoundsCollision(birdY.current, CANVAS_HEIGHT)) {
        triggerGameOver();
      } else {
        for (const pipe of pipes.current) {
          if (checkPipeCollision(birdY.current, pipe, CANVAS_HEIGHT)) {
            triggerGameOver();
            break;
          }
        }
      }
    }

    // --- DRAW ---
    ctx.save();

    // Screen shake offset
    if (screenShake.current > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake.current;
      const shakeY = (Math.random() - 0.5) * screenShake.current;
      ctx.translate(shakeX, shakeY);
      screenShake.current = Math.max(0, screenShake.current - 0.6);
    }

    // Sky background
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Pipes
    pipes.current.forEach((pipe) => {
      const gapTop = pipe.gapY - pipe.gapSize / 2;
      const gapBottom = pipe.gapY + pipe.gapSize / 2;

      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, gapTop);
      ctx.fillRect(pipe.x, gapBottom, PIPE_WIDTH, CANVAS_HEIGHT - gapBottom);

      // Pipe caps for visual detail
      ctx.fillStyle = '#3d8b40';
      ctx.fillRect(pipe.x - 4, gapTop - 15, PIPE_WIDTH + 8, 15);
      ctx.fillRect(pipe.x - 4, gapBottom, PIPE_WIDTH + 8, 15);
    });

    // Particles
    particles.current = particles.current.filter((p) => {
      const age = Date.now() - p.startTime;
      if (age > 600) return false;
      const progress = age / 600;
      const px = p.x + p.vx * age * 0.05;
      const py = p.y + p.vy * age * 0.05;
      ctx.fillStyle = p.color.replace('ALPHA', 1 - progress);
      ctx.fillRect(px - 3, py - 3, 6, 6);
      return true;
    });

    // Bird (hide once collided/exploded)
    if (!hasCollidedRef.current || gameActiveRef.current === false) {
      if (!hasCollidedRef.current) {
        ctx.beginPath();
        ctx.arc(BIRD_X, birdY.current, BIRD_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#FFC107';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Simple eye + beak for character
        ctx.beginPath();
        ctx.arc(BIRD_X + 6, birdY.current - 5, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(BIRD_X + BIRD_RADIUS - 2, birdY.current);
        ctx.lineTo(BIRD_X + BIRD_RADIUS + 8, birdY.current - 3);
        ctx.lineTo(BIRD_X + BIRD_RADIUS + 8, birdY.current + 3);
        ctx.closePath();
        ctx.fillStyle = '#FF9800';
        ctx.fill();
      }
    }

    // Countdown overlay
    if (countdown !== null) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 60px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(countdown === 0 ? 'GO!' : countdown, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }

    // Hand cursor indicator (small, unobtrusive, shows where tracking sees your hand)
    if (handData && gameActiveRef.current) {
      const cursorY = handData.y * CANVAS_HEIGHT;
      ctx.beginPath();
      ctx.arc(30, cursorY, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
    }

    ctx.restore();
  }

  function toggleMute() {
    const newMuted = !muted;
    setMuted(newMuted);
    setMutedState(newMuted);
  }

  const wrapperStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: isFullscreen ? '100vh' : 'auto',
    background: isFullscreen ? '#1a1a1a' : 'transparent',
    padding: isFullscreen ? '1rem' : '0',
    boxSizing: 'border-box',
  };

  const canvasContainerStyle = {
    width: '100%',
    maxWidth: isFullscreen ? '900px' : '480px',
    aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
    margin: '0 auto',
  };

  // --- Screen 1: Difficulty Select ---
  if (!difficulty) {
    return (
      <div style={{ textAlign: 'center' }}>
        <h2>Flappy Bird 🐦</h2>
        <p>Move your hand up/down to control the bird's height. Keep your hand in frame!</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {Object.entries(DIFFICULTY_SETTINGS).map(([key, setting]) => (
            <button key={key} onClick={() => startNewRound(key)} style={{ padding: '0.75rem 1.5rem' }}>
              {setting.label}
              <div style={{ fontSize: '0.7rem', color: '#888' }}>Best: {getHighScore(key)}</div>
            </button>
          ))}
        </div>
        <button onClick={onExit} style={{ marginTop: '1.5rem' }}>← Back to Menu</button>
      </div>
    );
  }

  // --- Screen 2: Game Over ---
  if (gameOver) {
    return (
      <div style={{ textAlign: 'center' }}>
        <h2>Game Over!</h2>
        {isNewHighScore && (
          <p style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '1.2rem' }}>
            🎉 New High Score!
          </p>
        )}
        <p>Pipes Cleared: {score}</p>
        <p style={{ color: '#666' }}>
          Difficulty: {DIFFICULTY_SETTINGS[difficulty].label} | High Score: {getHighScore(difficulty)}
        </p>
        <button onClick={() => startNewRound(difficulty)}>Play Again</button>
        <button onClick={() => setDifficulty(null)} style={{ marginLeft: '0.5rem' }}>
          Change Difficulty
        </button>
        <button onClick={onExit} style={{ marginLeft: '0.5rem' }}>Back to Menu</button>
      </div>
    );
  }

  // --- Screen 3: Active Game ---
  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
        <h2 style={{ color: isFullscreen ? 'white' : 'inherit' }}>Flappy Bird 🐦</h2>
        <button onClick={toggleMute} style={{ fontSize: '1.2rem' }}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button onClick={toggleFullscreen} style={{ fontSize: '1.2rem' }}>
          {isFullscreen ? '⤓' : '⤢'}
        </button>
      </div>
      <p style={{ color: isFullscreen ? 'white' : 'inherit' }}>
        Score: {score} | Difficulty: {DIFFICULTY_SETTINGS[difficulty].label}
      </p>

      {!handDetected && (
        <p style={{ color: 'red', fontWeight: 'bold' }}>
          ✋ Hand not detected — bird is falling! Move your hand into frame.
        </p>
      )}

      <WebcamFeed>
        {(handData) => {
          draw(handData);
          return (
            <div style={canvasContainerStyle}>
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  border: '2px solid black',
                  borderRadius: '8px',
                }}
              />
            </div>
          );
        }}
      </WebcamFeed>

      <button onClick={onExit} style={{ marginTop: '1rem' }}>Quit Game</button>
    </div>
  );
}