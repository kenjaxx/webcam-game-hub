import { useEffect, useRef, useState } from 'react';
import WebcamFeed from '../../components/WebcamFeed';
import {
  FRUIT_RADIUS,
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
  playCountdownBeep,
  setMuted,
} from './sounds';
import { getHighScore, saveHighScoreIfBetter } from './storage';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 360;

export default function FruitNinja({ onExit }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);

  const [difficulty, setDifficulty] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [gameOver, setGameOver] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fruits = useRef([]);
  const particles = useRef([]);
  const trail = useRef([]); // recent fingertip positions, for drawing the "blade" trail
  const lastFrameTime = useRef(null);
  const lastSpawnTime = useRef(0);
  const prevCursor = useRef(null); // previous frame's cursor position, for swipe speed calc
  const streak = useRef(0);
  const screenShake = useRef(0);
  const screenFlashRed = useRef(0);
  const gameActiveRef = useRef(false);
  const scoreRef = useRef(0);
  const livesRef = useRef(STARTING_LIVES);
  const hasEndedRef = useRef(false);

  const gameActive = difficulty && countdown === null && !gameOver;
  gameActiveRef.current = gameActive;

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

  function startNewRound(chosenDifficulty) {
    fruits.current = [];
    particles.current = [];
    trail.current = [];
    lastFrameTime.current = null;
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

  function endGame() {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    playGameOverSound();
    setGameOver(true);
    const isNew = saveHighScoreIfBetter(difficulty, scoreRef.current);
    setIsNewHighScore(isNew);
  }

  function draw(handData) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    setHandDetected(!!handData);

    const now = Date.now();
    const dt = lastFrameTime.current ? Math.min((now - lastFrameTime.current) / 16.67, 3) : 1;
    lastFrameTime.current = now;

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

      // Add to trail for the visual "blade" line
      trail.current.push({ x: cursorX, y: cursorY, time: now });
    } else {
      prevCursor.current = null;
    }

    // Trim trail to last 200ms
    trail.current = trail.current.filter((p) => now - p.time < 200);

    // --- UPDATE (only during active gameplay) ---
    if (gameActiveRef.current && !hasEndedRef.current) {
      const settings = DIFFICULTY_SETTINGS[difficulty];

      // Spawn fruit on interval
      if (now - lastSpawnTime.current > settings.spawnRate) {
        fruits.current.push(createFruit(CANVAS_WIDTH, CANVAS_HEIGHT, settings));
        lastSpawnTime.current = now;
      }

      // Update physics for each fruit
      fruits.current.forEach((fruit) => updateFruitPhysics(fruit, dt));

      // Check slicing: fast swipe motion overlapping a fruit
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
              spawnParticles(fruit.x, fruit.y, fruit.color.replace(/^#/, '').match(/.{2}/g)
                ? `rgba(${parseInt(fruit.color.slice(1,3),16)},${parseInt(fruit.color.slice(3,5),16)},${parseInt(fruit.color.slice(5,7),16)},ALPHA)`
                : 'rgba(200,50,50,ALPHA)');
            }
          }
        });
      }

      // Remove fruits that are off-screen (fell past bottom) - counts as a miss if not sliced/bomb
      const beforeCount = fruits.current.length;
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

      // Clean up sliced fruits shortly after slicing (let particle burst play out)
      fruits.current = fruits.current.filter((fruit) => !fruit.sliced || now - fruit.spawnTime < 50000);
      fruits.current = fruits.current.filter((fruit) => !fruit.sliced);
    }

    // --- DRAW ---
    ctx.save();

    if (screenShake.current > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake.current;
      const shakeY = (Math.random() - 0.5) * screenShake.current;
      ctx.translate(shakeX, shakeY);
      screenShake.current = Math.max(0, screenShake.current - 0.8);
    }

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Fruits
    fruits.current.forEach((fruit) => {
      ctx.font = '40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fruit.emoji, fruit.x, fruit.y);
    });

    // Particles
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

    // Blade trail (fading line following recent cursor positions)
    if (trail.current.length > 1) {
      ctx.beginPath();
      trail.current.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Red flash on bomb hit
    if (screenFlashRed.current > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${screenFlashRed.current})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      screenFlashRed.current = Math.max(0, screenFlashRed.current - 0.04);
    }

    // Cursor dot
    if (cursorX !== null && gameActiveRef.current) {
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
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
        <h2>Fruit Ninja 🍉</h2>
        <p>Swipe your hand fast across fruit to slice them. Avoid the 💣 bombs!</p>
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
        <p>Final Score: {score}</p>
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
        <h2 style={{ color: isFullscreen ? 'white' : 'inherit' }}>Fruit Ninja 🍉</h2>
        <button onClick={toggleMute} style={{ fontSize: '1.2rem' }}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button onClick={toggleFullscreen} style={{ fontSize: '1.2rem' }}>
          {isFullscreen ? '⤓' : '⤢'}
        </button>
      </div>
      <p style={{ color: isFullscreen ? 'white' : 'inherit' }}>
        Score: {score} | Lives: {'❤️'.repeat(lives)}{'🖤'.repeat(STARTING_LIVES - lives)} | Difficulty: {DIFFICULTY_SETTINGS[difficulty].label}
      </p>

      {!handDetected && (
        <p style={{ color: 'red', fontWeight: 'bold' }}>
          ✋ Hand not detected — move your hand into frame, with good lighting
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