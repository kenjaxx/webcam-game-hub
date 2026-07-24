import { useRef, useState } from 'react';
import ArcadeScreen from '../../components/ArcadeScreen';
import GameHUD from '../../components/GameHUD';
import HandTrackedCanvas from '../../components/HandTrackedCanvas';
import { useCountdown } from '../../hooks/useCountdown';
import { useFullscreen } from '../../hooks/useFullscreen';
import { THEME, drawArcadeBackground } from '../../shared/theme';
import {
  getHolePositions,
  getRandomHoleIndex,
  isWithinHole,
  getComboMultiplier,
  isGoldenMole,
  GAME_DURATION,
  DIFFICULTY_SETTINGS,
} from './logic';
import { playWhackSound, playGameOverSound, setMuted, getMuted } from './sounds';
import { getHighScore, saveHighScoreIfBetter } from './storage';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 360;

export default function WhackAMole({ onExit }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [isFullscreen, toggleFullscreen] = useFullscreen(wrapperRef);
  const [countdown, setCountdown] = useCountdown();

  const [difficulty, setDifficulty] = useState(null);
  const [activeMole, setActiveMole] = useState(null);
  const [moleIsGolden, setMoleIsGolden] = useState(false);
  const [moleSpawnTime, setMoleSpawnTime] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [gameOver, setGameOver] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [muted, setMutedState] = useState(getMuted());

  const lastWhackTime = useRef(0);
  const lastPinchState = useRef(false);
  const hitAnimations = useRef([]);
  const particles = useRef([]);
  const screenFlash = useRef(0);
  const lastSpawnTime = useRef(0);
  const lastTimerTick = useRef(0);
  const hasEndedRef = useRef(false);
  const gameActiveRef = useRef(false);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);

  const holes = getHolePositions(CANVAS_WIDTH, CANVAS_HEIGHT);
  const gameActive = difficulty && countdown === null && !gameOver;
  gameActiveRef.current = gameActive;

  function startNewRound(chosenDifficulty) {
    setActiveMole(null);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setTimeLeft(GAME_DURATION);
    setGameOver(false);
    setIsNewHighScore(false);
    hasEndedRef.current = false;
    scoreRef.current = 0;
    streakRef.current = 0;
    lastSpawnTime.current = 0;
    lastTimerTick.current = 0;
    hitAnimations.current = [];
    particles.current = [];
    setDifficulty(chosenDifficulty);
    setCountdown(3);
  }

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

  function endGame() {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    playGameOverSound();
    setGameOver(true);
    const isNew = saveHighScoreIfBetter(difficulty, scoreRef.current);
    setIsNewHighScore(isNew);
  }

  // Called every animation frame via HandTrackedCanvas. Mole spawning and the
  // round timer live here too now, driven by one clock instead of separate
  // setInterval timers running alongside the old MediaPipe-rate draw calls.
  function draw(handData) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const now = Date.now();

    setHandDetected(!!handData);

    if (gameActiveRef.current) {
      const spawnRate = DIFFICULTY_SETTINGS[difficulty].spawnRate;
      if (now - lastSpawnTime.current > spawnRate) {
        setActiveMole((prev) => getRandomHoleIndex(holes.length, prev));
        setMoleIsGolden(isGoldenMole());
        setMoleSpawnTime(now);
        lastSpawnTime.current = now;
      }
      if (now - lastTimerTick.current > 1000) {
        lastTimerTick.current = now;
        setTimeLeft((prev) => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawArcadeBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

    holes.forEach((hole, index) => {
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, 45, 0, Math.PI * 2);
      ctx.fillStyle = '#2a1f3d';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(hole.x, hole.y, 38, 0, Math.PI * 2);
      ctx.fillStyle = index === activeMole ? (moleIsGolden ? THEME.gold : THEME.accent) : '#160f24';
      ctx.fill();

      if (index === activeMole && gameActiveRef.current) {
        const age = now - moleSpawnTime;
        const scale = Math.min(age / 150, 1);
        const easedScale = 1 - Math.pow(1 - scale, 3);

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

    hitAnimations.current = hitAnimations.current.filter((anim) => {
      const age = now - anim.startTime;
      if (age > 600) return false;
      const progress = age / 600;
      ctx.font = `bold 22px ${THEME.fontHeading}`;
      ctx.fillStyle = anim.color.replace('ALPHA', 1 - progress);
      ctx.textAlign = 'center';
      ctx.fillText(anim.text, anim.x, anim.y - progress * 30);
      return true;
    });

    if (screenFlash.current > 0) {
      ctx.fillStyle = `rgba(255, 187, 61, ${screenFlash.current})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      screenFlash.current = Math.max(0, screenFlash.current - 0.05);
    }

    if (gameActiveRef.current) {
      const timerBarWidth = (timeLeft / GAME_DURATION) * CANVAS_WIDTH;
      ctx.fillStyle = timeLeft <= 5 ? THEME.danger : THEME.cyan;
      ctx.fillRect(0, 0, timerBarWidth, 6);
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

    if (handData) {
      const cursorX = (1 - handData.x) * CANVAS_WIDTH;
      const cursorY = handData.y * CANVAS_HEIGHT;

      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 14, 0, Math.PI * 2);
      ctx.fillStyle = handData.isPinching ? THEME.danger : THEME.gold;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#160f24';
      ctx.stroke();

      const justPinched = handData.isPinching && !lastPinchState.current;
      lastPinchState.current = handData.isPinching;

      if (justPinched && gameActiveRef.current) {
        if (
          activeMole !== null &&
          isWithinHole(cursorX, cursorY, holes[activeMole].x, holes[activeMole].y) &&
          now - lastWhackTime.current > 300
        ) {
          const newStreak = streakRef.current + 1;
          streakRef.current = newStreak;
          const multiplier = getComboMultiplier(newStreak);
          const points = (moleIsGolden ? 3 : 1) * multiplier;

          scoreRef.current += points;
          setScore(scoreRef.current);
          setStreak(newStreak);
          setBestStreak((prev) => Math.max(prev, newStreak));

          hitAnimations.current.push({
            x: holes[activeMole].x,
            y: holes[activeMole].y,
            startTime: now,
            text: `+${points}${multiplier > 1 ? ` (${multiplier}x!)` : ''}`,
            color: moleIsGolden ? 'rgba(255, 187, 61, ALPHA)' : 'rgba(100, 255, 100, ALPHA)',
          });
          spawnParticles(
            holes[activeMole].x,
            holes[activeMole].y,
            moleIsGolden ? 'rgba(255, 187, 61, ALPHA)' : 'rgba(100, 220, 100, ALPHA)'
          );
          if (moleIsGolden) screenFlash.current = 0.4;
          playWhackSound();
          setActiveMole(null);
          lastWhackTime.current = now;
        } else {
          streakRef.current = 0;
          setStreak(0);
          hitAnimations.current.push({
            x: cursorX,
            y: cursorY,
            startTime: now,
            text: 'Miss',
            color: 'rgba(255, 107, 107, ALPHA)',
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

  if (!difficulty) {
    return (
      <ArcadeScreen eyebrow="Select Difficulty" title="Whack-a-Mole 🐹">
        <p className="stat-line--muted">Pinch to whack moles as they pop up. Golden moles are worth 3x!</p>
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
        <p className="stat-line">Final Score: {score}</p>
        <p className="stat-line">Best Streak: {bestStreak}</p>
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

  const multiplier = getComboMultiplier(streak);

  return (
    <div ref={wrapperRef} className={`game-wrapper${isFullscreen ? ' game-wrapper--fullscreen' : ''}`}>
      <GameHUD
        title="Whack-a-Mole 🐹"
        isFullscreen={isFullscreen}
        muted={muted}
        onToggleMute={toggleMute}
        onToggleFullscreen={toggleFullscreen}
        stats={`Score: ${score} | Streak: ${streak}${multiplier > 1 ? ` (${multiplier}x combo!)` : ''} | Time: ${timeLeft}s`}
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