import { useEffect, useRef, useState } from 'react';
import WebcamFeed from '../../components/WebcamFeed';
import {
  getHolePositions,
  getRandomHoleIndex,
  isWithinHole,
  getComboMultiplier,
  isGoldenMole,
  GAME_DURATION,
  DIFFICULTY_SETTINGS,
} from './logic';
import { playWhackSound, playGameOverSound, playCountdownBeep, setMuted } from './sounds';
import { getHighScore, saveHighScoreIfBetter } from './storage';

// Internal drawing resolution - stays fixed regardless of display size
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 360;

export default function WhackAMole({ onExit }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null); // used for fullscreen target
  const [difficulty, setDifficulty] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [activeMole, setActiveMole] = useState(null);
  const [moleIsGolden, setMoleIsGolden] = useState(false);
  const [moleSpawnTime, setMoleSpawnTime] = useState(0); // for pop-in animation
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [gameOver, setGameOver] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastWhackTime = useRef(0);
  const lastPinchState = useRef(false);
  const hitAnimations = useRef([]);
  const particles = useRef([]);
  const screenFlash = useRef(0); // opacity for golden mole flash effect

  const holes = getHolePositions(CANVAS_WIDTH, CANVAS_HEIGHT);
  const gameActive = difficulty && countdown === null && !gameOver;

  // Track fullscreen state changes (e.g., user presses Esc)
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

  // Mole spawn loop
  useEffect(() => {
    if (!gameActive) return;

    const spawnRate = DIFFICULTY_SETTINGS[difficulty].spawnRate;
    const spawnInterval = setInterval(() => {
      setActiveMole((prev) => getRandomHoleIndex(holes.length, prev));
      setMoleIsGolden(isGoldenMole());
      setMoleSpawnTime(Date.now());
    }, spawnRate);

    return () => clearInterval(spawnInterval);
  }, [gameActive, difficulty, holes.length]);

  // Countdown timer + high score save on game end
  useEffect(() => {
    if (!gameActive) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameOver(true);
          playGameOverSound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameActive]);

  // When game ends, check/save high score
  useEffect(() => {
    if (gameOver && difficulty) {
      const isNew = saveHighScoreIfBetter(difficulty, score);
      setIsNewHighScore(isNew);
    }
  }, [gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      particles.current.push({
        x,
        y,
        vx: Math.cos(angle) * (2 + Math.random() * 2),
        vy: Math.sin(angle) * (2 + Math.random() * 2),
        startTime: Date.now(),
        color,
      });
    }
  }

  function draw(handData) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    setHandDetected(!!handData);

    // Draw holes + mole with pop-in scale animation
    holes.forEach((hole, index) => {
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, 45, 0, Math.PI * 2);
      ctx.fillStyle = '#4a2c17';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(hole.x, hole.y, 38, 0, Math.PI * 2);
      ctx.fillStyle = index === activeMole ? (moleIsGolden ? '#c9a227' : '#6b4226') : '#2e1a0f';
      ctx.fill();

      if (index === activeMole && gameActive) {
        // Pop-in animation: mole scales up from 0 to full size over 150ms
        const age = Date.now() - moleSpawnTime;
        const scale = Math.min(age / 150, 1);
        const easedScale = 1 - Math.pow(1 - scale, 3); // ease-out cubic

        ctx.save();
        ctx.translate(hole.x, hole.y);
        ctx.scale(easedScale, easedScale);
        ctx.font = '36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(moleIsGolden ? '✨🐹' : '🐹', 0, 0);
        ctx.restore();
      }
    });

    // Particles
    particles.current = particles.current.filter((p) => {
      const age = Date.now() - p.startTime;
      if (age > 500) return false;
      const progress = age / 500;
      const px = p.x + p.vx * age * 0.05;
      const py = p.y + p.vy * age * 0.05;
      ctx.fillStyle = p.color.replace('ALPHA', 1 - progress);
      ctx.fillRect(px - 3, py - 3, 6, 6);
      return true;
    });

    // Hit/miss floating text
    hitAnimations.current = hitAnimations.current.filter((anim) => {
      const age = Date.now() - anim.startTime;
      if (age > 600) return false;
      const progress = age / 600;
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = anim.color.replace('ALPHA', 1 - progress);
      ctx.textAlign = 'center';
      ctx.fillText(anim.text, anim.x, anim.y - progress * 30);
      return true;
    });

    // Golden mole screen flash
    if (screenFlash.current > 0) {
      ctx.fillStyle = `rgba(255, 215, 0, ${screenFlash.current})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      screenFlash.current = Math.max(0, screenFlash.current - 0.05);
    }

    // Timer bar
    if (gameActive) {
      const timerBarWidth = (timeLeft / GAME_DURATION) * CANVAS_WIDTH;
      ctx.fillStyle = timeLeft <= 5 ? '#ff4444' : '#4CAF50';
      ctx.fillRect(0, 0, timerBarWidth, 6);
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

    // Fingertip cursor + hit detection
    if (handData) {
      const cursorX = (1 - handData.x) * CANVAS_WIDTH;
      const cursorY = handData.y * CANVAS_HEIGHT;

      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 14, 0, Math.PI * 2);
      ctx.fillStyle = handData.isPinching ? '#ff4444' : '#ffeb3b';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'black';
      ctx.stroke();

      const justPinched = handData.isPinching && !lastPinchState.current;
      lastPinchState.current = handData.isPinching;

      if (justPinched && gameActive) {
        const now = Date.now();
        if (
          activeMole !== null &&
          isWithinHole(cursorX, cursorY, holes[activeMole].x, holes[activeMole].y) &&
          now - lastWhackTime.current > 300
        ) {
          const newStreak = streak + 1;
          const multiplier = getComboMultiplier(newStreak);
          const points = (moleIsGolden ? 3 : 1) * multiplier;

          setScore((prev) => prev + points);
          setStreak(newStreak);
          setBestStreak((prev) => Math.max(prev, newStreak));

          hitAnimations.current.push({
            x: holes[activeMole].x,
            y: holes[activeMole].y,
            startTime: Date.now(),
            text: `+${points}${multiplier > 1 ? ` (${multiplier}x!)` : ''}`,
            color: moleIsGolden ? 'rgba(255, 215, 0, ALPHA)' : 'rgba(100, 255, 100, ALPHA)',
          });
          spawnParticles(
            holes[activeMole].x,
            holes[activeMole].y,
            moleIsGolden ? 'rgba(255, 215, 0, ALPHA)' : 'rgba(100, 220, 100, ALPHA)'
          );
          if (moleIsGolden) screenFlash.current = 0.4;
          playWhackSound();
          setActiveMole(null);
          lastWhackTime.current = now;
        } else {
          setStreak(0);
          hitAnimations.current.push({
            x: cursorX,
            y: cursorY,
            startTime: Date.now(),
            text: 'Miss',
            color: 'rgba(255, 100, 100, ALPHA)',
          });
        }
      }
    } else {
      lastPinchState.current = false;
    }
  }

  function toggleMute() {
    const newMuted = !muted;
    setMuted(newMuted);
    setMutedState(newMuted);
  }

  // Shared fullscreen wrapper styling
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

  // Responsive canvas container - maintains 4:3 aspect ratio, scales to fit viewport
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
        <h2>Whack-a-Mole 🐹</h2>
        <p>Choose your difficulty:</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {Object.entries(DIFFICULTY_SETTINGS).map(([key, setting]) => (
            <button
              key={key}
              onClick={() => {
                setDifficulty(key);
                setCountdown(3);
              }}
              style={{ padding: '0.75rem 1.5rem' }}
            >
              {setting.label}
              <div style={{ fontSize: '0.7rem', color: '#888' }}>
                Best: {getHighScore(key)}
              </div>
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
        <p>Best Streak: {bestStreak}</p>
        <p style={{ color: '#666' }}>
          Difficulty: {DIFFICULTY_SETTINGS[difficulty].label} | High Score: {getHighScore(difficulty)}
        </p>
        <button
          onClick={() => {
            setDifficulty(null);
            setScore(0);
            setStreak(0);
            setBestStreak(0);
            setTimeLeft(GAME_DURATION);
            setGameOver(false);
            setIsNewHighScore(false);
          }}
        >
          Play Again
        </button>
        <button onClick={onExit} style={{ marginLeft: '0.5rem' }}>Back to Menu</button>
      </div>
    );
  }

  // --- Screen 3: Active Game ---
  const multiplier = getComboMultiplier(streak);

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
        <h2 style={{ color: isFullscreen ? 'white' : 'inherit' }}>Whack-a-Mole 🐹</h2>
        <button onClick={toggleMute} style={{ fontSize: '1.2rem' }}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button onClick={toggleFullscreen} style={{ fontSize: '1.2rem' }}>
          {isFullscreen ? '⤓' : '⤢'}
        </button>
      </div>
      <p style={{ color: isFullscreen ? 'white' : 'inherit' }}>
        Score: {score} | Streak: {streak} {multiplier > 1 && `(${multiplier}x combo!)`} | Time: {timeLeft}s
      </p>
      <p style={{ fontSize: '0.85rem', color: isFullscreen ? '#aaa' : '#666' }}>
        Pinch to whack! ✨ Golden moles are worth 3x. Missing breaks your combo.
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
                  background: '#4CAF50',
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