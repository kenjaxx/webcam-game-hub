import { useRef, useState } from 'react';
import ArcadeScreen from '../../components/ArcadeScreen';
import GameHUD from '../../components/GameHUD';
import HandTrackedCanvas from '../../components/HandTrackedCanvas';
import { useCountdown } from '../../hooks/useCountdown';
import { useFullscreen } from '../../hooks/useFullscreen';
import { THEME, drawArcadeBackground } from '../../shared/theme';
import Leaderboard from '../../components/Leaderboard';
import { logSession } from '../../hooks/useSessionStats';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import {
  STARTING_LIVES,
  SWIPE_SPEED_THRESHOLD,
  DIFFICULTY_SETTINGS,
  createFruit,
  updateFruitPhysics,
  isPointNearFruit,
  getComboMultiplier,
} from './logic';
import {
  playSliceSound,
  playBombSound,
  playMissSound,
  playGameOverSound,
  setMuted,
  getMuted,
} from './sounds';
import { getHighScore, saveHighScoreIfBetter } from './storage';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 360;

// fruit.color is always a well-formed "#rrggbb" string from logic.js, so this
// no longer needs the unreachable fallback branch the old code had.
function hexToRgbaTemplate(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ALPHA)`;
}

export default function FruitNinja({ onExit }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [isFullscreen, toggleFullscreen] = useFullscreen(wrapperRef);
  const [countdown, setCountdown] = useCountdown();
  const { topScores, loading, submitScore } = useLeaderboard('fruitninja');

  const [difficulty, setDifficulty] = useState(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [gameOver, setGameOver] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [muted, setMutedState] = useState(getMuted());
  const openPalmHeldSince = useRef(null);
const [isPaused, setIsPaused] = useState(false);

  const fruits = useRef([]);
  const particles = useRef([]);
  const trail = useRef([]);
  const lastSpawnTime = useRef(0);
  const prevCursor = useRef(null);
  const streak = useRef(0);
  const screenShake = useRef(0);
  const screenFlashRed = useRef(0);
  const gameActiveRef = useRef(false);
  const scoreRef = useRef(0);
  const livesRef = useRef(STARTING_LIVES);
  const hasEndedRef = useRef(false);

  const gameActive = difficulty && countdown === null && !gameOver;
  gameActiveRef.current = gameActive;

  function startNewRound(chosenDifficulty) {
    fruits.current = [];
    particles.current = [];
    trail.current = [];
    lastSpawnTime.current = 0;
    prevCursor.current = null;
    streak.current = 0;
    screenShake.current = 0;
    screenFlashRed.current = 0;
    scoreRef.current = 0;
    livesRef.current = STARTING_LIVES;
    hasEndedRef.current = false;
    setScore(0);
    setLives(STARTING_LIVES);
    setGameOver(false);
    setIsNewHighScore(false);
    setDifficulty(chosenDifficulty);
    setCountdown(3);
  }

  function spawnParticles(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
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

  if (handData?.gesture === 'open_palm' && gameActiveRef.current) {
  if (!openPalmHeldSince.current) openPalmHeldSince.current = now;
  if (now - openPalmHeldSince.current > 800) {
    setIsPaused((p) => !p);
    openPalmHeldSince.current = null;
  }
} else {
  openPalmHeldSince.current = null;
}

  function endGame() {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    playGameOverSound();
    setGameOver(true);
    const isNew = saveHighScoreIfBetter(difficulty, scoreRef.current);
    setIsNewHighScore(isNew);
  }



  function endGameStatsLog(roundStartTime) {
  const totalAttempts = attemptsRef.current;
  const hits = hitsRef.current;

  logSession('whackamole', {
    score: scoreRef.current,
    difficulty,
    accuracy: totalAttempts > 0 ? hits / totalAttempts : 0,
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

    let cursorX = null;
    let cursorY = null;
    let swipeSpeed = 0;

    if (handData) {
      cursorX = (1 - handData.x) * CANVAS_WIDTH;
      cursorY = handData.y * CANVAS_HEIGHT;

      if (prevCursor.current) {
        swipeSpeed = Math.hypot(cursorX - prevCursor.current.x, cursorY - prevCursor.current.y);
      }
      prevCursor.current = { x: cursorX, y: cursorY };
      trail.current.push({ x: cursorX, y: cursorY, time: now });
    } else {
      prevCursor.current = null;
    }

    trail.current = trail.current.filter((p) => now - p.time < 200);

    if (gameActiveRef.current && !hasEndedRef.current) {
      const settings = DIFFICULTY_SETTINGS[difficulty];

      if (now - lastSpawnTime.current > settings.spawnRate) {
        fruits.current.push(createFruit(CANVAS_WIDTH, CANVAS_HEIGHT, settings));
        lastSpawnTime.current = now;
      }

      fruits.current.forEach((fruit) => updateFruitPhysics(fruit, dt));

      if (cursorX !== null && swipeSpeed > SWIPE_SPEED_THRESHOLD) {
        fruits.current.forEach((fruit) => {
          if (!fruit.sliced && isPointNearFruit(cursorX, cursorY, fruit)) {
            fruit.sliced = true;

            if (fruit.isBomb) {
              playBombSound();
              spawnParticles(fruit.x, fruit.y, 'rgba(80,80,80,ALPHA)', 20);
              screenShake.current = 15;
              screenFlashRed.current = 0.5;
              livesRef.current = 0;
              setLives(0);
              endGame();
            } else {
              const newStreak = streak.current + 1;
              streak.current = newStreak;
              const multiplier = getComboMultiplier(newStreak);
              const points = 1 * multiplier;
              scoreRef.current += points;
              setScore(scoreRef.current);
              playSliceSound();
              spawnParticles(fruit.x, fruit.y, hexToRgbaTemplate(fruit.color));
            }
          }
        });
      }

      fruits.current = fruits.current.filter((fruit) => {
        const offScreen = fruit.y - fruit.radius > CANVAS_HEIGHT + 20;
        if (offScreen && !fruit.sliced && !fruit.isBomb) {
          livesRef.current = Math.max(0, livesRef.current - 1);
          setLives(livesRef.current);
          streak.current = 0;
          playMissSound();
          if (livesRef.current <= 0) {
            endGame();
          }
        }
        return !offScreen;
      });

      // Sliced fruit is removed immediately - the particle burst plays out
      // independently, so there's no need to keep the fruit itself around.
      fruits.current = fruits.current.filter((fruit) => !fruit.sliced);
    }

    ctx.save();
    if (screenShake.current > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake.current;
      const shakeY = (Math.random() - 0.5) * screenShake.current;
      ctx.translate(shakeX, shakeY);
      screenShake.current = Math.max(0, screenShake.current - 0.8);
    }

    drawArcadeBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

    fruits.current.forEach((fruit) => {
      ctx.font = '40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fruit.emoji, fruit.x, fruit.y);
    });

    particles.current = particles.current.filter((p) => {
      const age = now - p.startTime;
      if (age > 500) return false;
      const progress = age / 500;
      const px = p.x + p.vx * age * 0.05;
      const py = p.y + p.vy * age * 0.05;
      ctx.fillStyle = p.color.replace('ALPHA', 1 - progress);
      ctx.fillRect(px - 3, py - 3, 6, 6);
      return true;
    });

    if (trail.current.length > 1) {
      ctx.beginPath();
      trail.current.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = THEME.cyan;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    if (screenFlashRed.current > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${screenFlashRed.current})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      screenFlashRed.current = Math.max(0, screenFlashRed.current - 0.04);
    }

    if (cursorX !== null && gameActiveRef.current) {
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
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

    ctx.restore();
  }

  function toggleMute() {
    const newMuted = !muted;
    setMuted(newMuted);
    setMutedState(newMuted);
  }

  if (!difficulty) {
    return (
      <ArcadeScreen eyebrow="Select Difficulty" title="Fruit Ninja 🍉">
        <p className="stat-line--muted">Swipe your hand fast across fruit to slice them. Avoid the 💣 bombs!</p>
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

  if (gameOver) {
    return (
      <ArcadeScreen eyebrow="Round Over" title="Game Over!">
        {isNewHighScore && <p className="high-score-banner">🎉 New High Score!</p>}
        <p className="stat-line">Final Score: {score}</p>
        <p className="stat-line--muted">
          Difficulty: {DIFFICULTY_SETTINGS[difficulty].label} · High Score: {getHighScore(difficulty)}
        </p>
        <div className="ghost-btn-row">
          <button className="ghost-btn" onClick={() => startNewRound(difficulty)}>Play Again</button>
          <button className="ghost-btn" onClick={() => setDifficulty(null)}>Change Difficulty</button>
          <button className="ghost-btn" onClick={onExit}>Back to Menu</button>
        </div>
      </ArcadeScreen>
    );
  }

  return (
    <div ref={wrapperRef} className={`game-wrapper${isFullscreen ? ' game-wrapper--fullscreen' : ''}`}>
      <GameHUD
        title="Fruit Ninja 🍉"
        isFullscreen={isFullscreen}
        muted={muted}
        onToggleMute={toggleMute}
        onToggleFullscreen={toggleFullscreen}
        stats={`Score: ${score} | Lives: ${'❤️'.repeat(lives)}${'🖤'.repeat(STARTING_LIVES - lives)} | Difficulty: ${DIFFICULTY_SETTINGS[difficulty].label}`}
        warning={!handDetected ? 'Hand not detected — move your hand into frame, with good lighting' : null}
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