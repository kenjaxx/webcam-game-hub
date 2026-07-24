import { useRef, useState } from 'react';
import ArcadeScreen from '../../components/ArcadeScreen';
import GameHUD from '../../components/GameHUD';
import HandTrackedCanvas from '../../components/HandTrackedCanvas';
import { useCountdown } from '../../hooks/useCountdown';
import { useFullscreen } from '../../hooks/useFullscreen';
import { THEME, drawArcadeBackground } from '../../shared/theme';
import Leaderboard from '../../components/Leaderboard';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { logSession } from '../../hooks/useSessionStats';
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
import { playScoreSound, playCollisionSound, playGameOverSound, setMuted, getMuted } from './sounds';
import { getHighScore, saveHighScoreIfBetter } from './storage';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 360;

export default function FlappyBird({ onExit }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [isFullscreen, toggleFullscreen] = useFullscreen(wrapperRef);
  const [countdown, setCountdown] = useCountdown();

  const [difficulty, setDifficulty] = useState(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [muted, setMutedState] = useState(getMuted());
  const { topScores, loading, submitScore } = useLeaderboard('flappybird');

  const birdY = useRef(CANVAS_HEIGHT / 2);
  const birdVelocity = useRef(0);
  const pipes = useRef([]);
  const particles = useRef([]);
  const screenShake = useRef(0);
  const gameActiveRef = useRef(false);
  const scoreRef = useRef(0);
  const hasCollidedRef = useRef(false);
  const roundStartTimeRef = useRef(0);

  const gameActive = difficulty && countdown === null && !gameOver;
  gameActiveRef.current = gameActive;

  function startNewRound(chosenDifficulty) {
    birdY.current = CANVAS_HEIGHT / 2;
    birdVelocity.current = 0;
    pipes.current = [createPipe(CANVAS_WIDTH, CANVAS_HEIGHT, DIFFICULTY_SETTINGS[chosenDifficulty].gapSize)];
    particles.current = [];
    screenShake.current = 0;
    scoreRef.current = 0;
    hasCollidedRef.current = false;
    roundStartTimeRef.current = Date.now();
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
    if (hasCollidedRef.current) return;
    hasCollidedRef.current = true;
    playCollisionSound();
    spawnParticles(BIRD_X, birdY.current, 'rgba(255, 200, 50, ALPHA)');
    screenShake.current = 10;

    setTimeout(() => {
      playGameOverSound();
      setGameOver(true);
      const isNew = saveHighScoreIfBetter(difficulty, scoreRef.current);
      setIsNewHighScore(isNew);
      endGameStatsLog(roundStartTimeRef.current);
    }, 300);
  }

  function endGameStatsLog(roundStartTime) {
    logSession('flappybird', {
      score: scoreRef.current,
      difficulty,
      accuracy: null,
      durationSec: Math.round((Date.now() - roundStartTime) / 1000),
    });
  }

  function draw(handData, deltaMs) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    setHandDetected(!!handData);

    const dt = Math.min(deltaMs / 16.67, 3);
    const now = Date.now();

    if (gameActiveRef.current && !hasCollidedRef.current) {
      if (handData) {
        const targetY = handData.y * CANVAS_HEIGHT;
        birdY.current += (targetY - birdY.current) * 0.25;
        birdVelocity.current = 0;
      } else {
        birdVelocity.current += GRAVITY * dt;
        birdY.current += birdVelocity.current * dt;
      }

      const speed = DIFFICULTY_SETTINGS[difficulty].speed * dt;

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

      const lastPipe = pipes.current[pipes.current.length - 1];
      if (!lastPipe || CANVAS_WIDTH - lastPipe.x >= PIPE_SPAWN_DISTANCE) {
        pipes.current.push(createPipe(CANVAS_WIDTH, CANVAS_HEIGHT, DIFFICULTY_SETTINGS[difficulty].gapSize));
      }

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

    ctx.save();
    if (screenShake.current > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake.current;
      const shakeY = (Math.random() - 0.5) * screenShake.current;
      ctx.translate(shakeX, shakeY);
      screenShake.current = Math.max(0, screenShake.current - 0.6);
    }

    drawArcadeBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

    pipes.current.forEach((pipe) => {
      const gapTop = pipe.gapY - pipe.gapSize / 2;
      const gapBottom = pipe.gapY + pipe.gapSize / 2;

      ctx.fillStyle = THEME.accent;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, gapTop);
      ctx.fillRect(pipe.x, gapBottom, PIPE_WIDTH, CANVAS_HEIGHT - gapBottom);

      ctx.fillStyle = THEME.accentBright;
      ctx.fillRect(pipe.x - 4, gapTop - 15, PIPE_WIDTH + 8, 15);
      ctx.fillRect(pipe.x - 4, gapBottom, PIPE_WIDTH + 8, 15);
    });

    particles.current = particles.current.filter((p) => {
      const age = now - p.startTime;
      if (age > 600) return false;
      const progress = age / 600;
      const px = p.x + p.vx * age * 0.05;
      const py = p.y + p.vy * age * 0.05;
      ctx.fillStyle = p.color.replace('ALPHA', 1 - progress);
      ctx.fillRect(px - 3, py - 3, 6, 6);
      return true;
    });

    if (!hasCollidedRef.current) {
      ctx.beginPath();
      ctx.arc(BIRD_X, birdY.current, BIRD_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = THEME.gold;
      ctx.fill();
      ctx.strokeStyle = '#160f24';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(BIRD_X + 6, birdY.current - 5, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#160f24';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(BIRD_X + BIRD_RADIUS - 2, birdY.current);
      ctx.lineTo(BIRD_X + BIRD_RADIUS + 8, birdY.current - 3);
      ctx.lineTo(BIRD_X + BIRD_RADIUS + 8, birdY.current + 3);
      ctx.closePath();
      ctx.fillStyle = THEME.danger;
      ctx.fill();
    }

    if (countdown !== null) {
      ctx.fillStyle = 'rgba(7,5,13,0.7)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = THEME.text;
      ctx.font = `bold 60px ${THEME.fontHeading}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(countdown === 0 ? 'GO!' : countdown, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }

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

  if (!difficulty) {
    return (
      <ArcadeScreen eyebrow="Select Difficulty" title="Flappy Bird 🐦">
        <p className="stat-line--muted">Move your hand up/down to control the bird's height. Keep your hand in frame!</p>
        <div className="difficulty-grid">
          {Object.entries(DIFFICULTY_SETTINGS).map(([key, setting]) => (
            <button key={key} className="difficulty-card" onClick={() => startNewRound(key)}>
              <span className="difficulty-card__label">{setting.label}</span>
              <span className="difficulty-card__best">Best {getHighScore(key)}</span>
            </button>
          ))}
        </div>
        <div className="ghost-btn-row">
          <button className="ghost-btn" onClick={onExit}>← Back to Menu</button>
        </div>
      </ArcadeScreen>
    );
  }

  if (gameOver) {
    return (
      <ArcadeScreen eyebrow="Round Over" title="Game Over!">
        {isNewHighScore && <p className="high-score-banner">🎉 New High Score!</p>}
        <p className="stat-line">Pipes Cleared: {score}</p>
        <p className="stat-line--muted">
          Difficulty: {DIFFICULTY_SETTINGS[difficulty].label} · High Score: {getHighScore(difficulty)}
        </p>
        <div className="ghost-btn-row">
          <button className="ghost-btn" onClick={() => startNewRound(difficulty)}>Play Again</button>
          <button className="ghost-btn" onClick={() => setDifficulty(null)}>Change Difficulty</button>
          <button className="ghost-btn" onClick={onExit}>Back to Menu</button>
          <Leaderboard
            topScores={topScores}
            loading={loading}
            isNewHighScore={isNewHighScore}
            onSubmit={(name) => submitScore(name, score, difficulty)}
          />
        </div>
      </ArcadeScreen>
    );
  }

  return (
    <div ref={wrapperRef} className={`game-wrapper${isFullscreen ? ' game-wrapper--fullscreen' : ''}`}>
      <GameHUD
        title="Flappy Bird 🐦"
        isFullscreen={isFullscreen}
        muted={muted}
        onToggleMute={toggleMute}
        onToggleFullscreen={toggleFullscreen}
        stats={`Score: ${score} | Difficulty: ${DIFFICULTY_SETTINGS[difficulty].label}`}
        warning={!handDetected ? "Hand not detected — bird is falling! Move your hand into frame." : null}
      />

      <HandTrackedCanvas
        canvasRef={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        isFullscreen={isFullscreen}
        onFrame={draw}
      />

      <button className="ghost-btn" onClick={onExit} style={{ marginTop: '1rem' }}>Quit Game</button>
    </div>
  );
}