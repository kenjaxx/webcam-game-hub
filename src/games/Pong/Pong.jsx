import { useRef, useState } from 'react';
import ArcadeScreen from '../../components/ArcadeScreen';
import GameHUD from '../../components/GameHUD';
import HandTrackedCanvas from '../../components/HandTrackedCanvas';
import { useCountdown } from '../../hooks/useCountdown';
import { useFullscreen } from '../../hooks/useFullscreen';
import Leaderboard from '../../components/Leaderboard';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { logSession } from '../../hooks/useSessionStats';
import { THEME, drawArcadeBackground } from '../../shared/theme';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_HEIGHT,
  BALL_RADIUS,
  PLAYER_X,
  AI_X,
  STARTING_LIVES,
  DIFFICULTY_SETTINGS,
  createBall,
  updateBallPhysics,
  checkPaddleCollision,
  updateAIPaddle,
  clampPaddleY,
} from './logic';
import {
  playPaddleHitSound,
  playWallBounceSound,
  playScoreSound,
  playMissSound,
  playGameOverSound,
  setMuted,
  getMuted,
} from './sounds';
import { getHighScore, saveHighScoreIfBetter } from './storage';

export default function Pong({ onExit }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [isFullscreen, toggleFullscreen] = useFullscreen(wrapperRef);
  const [countdown, setCountdown] = useCountdown();

  const [difficulty, setDifficulty] = useState(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [gameOver, setGameOver] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [muted, setMutedState] = useState(getMuted());
  const [pointFlash, setPointFlash] = useState(null);

  const ball = useRef(null);
  const playerPaddleY = useRef(CANVAS_HEIGHT / 2);
  const aiPaddleY = useRef(CANVAS_HEIGHT / 2);
  const particles = useRef([]);
  const screenShake = useRef(0);
  const gameActiveRef = useRef(false);
  const scoreRef = useRef(0);
  const livesRef = useRef(STARTING_LIVES);
  const hasEndedRef = useRef(false);
  const servePauseUntil = useRef(0);
  const { topScores, loading, submitScore } = useLeaderboard('pong');
  const openPalmHeldSince = useRef(null);
const [isPaused, setIsPaused] = useState(false);

  const gameActive = difficulty && countdown === null && !gameOver;
  gameActiveRef.current = gameActive;

  function startNewRound(chosenDifficulty) {
    const settings = DIFFICULTY_SETTINGS[chosenDifficulty];
    ball.current = createBall(settings.ballSpeed);
    playerPaddleY.current = CANVAS_HEIGHT / 2;
    aiPaddleY.current = CANVAS_HEIGHT / 2;
    particles.current = [];
    screenShake.current = 0;
    scoreRef.current = 0;
    livesRef.current = STARTING_LIVES;
    hasEndedRef.current = false;
    servePauseUntil.current = 0;
    setScore(0);
    setLives(STARTING_LIVES);
    setGameOver(false);
    setIsNewHighScore(false);
    setPointFlash(null);
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

  function handlePoint(scorer) {
    const settings = DIFFICULTY_SETTINGS[difficulty];

    if (scorer === 'player') {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      playScoreSound();
      spawnParticles(CANVAS_WIDTH - BALL_RADIUS - 4, ball.current.y, 'rgba(77, 208, 165, ALPHA)');
    } else {
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      playMissSound();
      screenShake.current = 10;
      spawnParticles(BALL_RADIUS + 4, ball.current.y, 'rgba(255, 107, 107, ALPHA)');
    }

    setPointFlash(scorer);
    setTimeout(() => setPointFlash(null), 500);

    if (scorer === 'ai' && livesRef.current <= 0) {
      endGame();
      return;
    }

    ball.current = createBall(settings.ballSpeed, scorer === 'player' ? false : true);
    servePauseUntil.current = Date.now() + 500;
  }

  function draw(handData, deltaMs) {
    const canvas = canvasRef.current;
    if (!canvas || !ball.current) return;
    const ctx = canvas.getContext('2d');
    setHandDetected(!!handData);

    const dt = Math.min(deltaMs / 16.67, 3);
    const now = Date.now();

    if (handData) {
      const targetY = handData.y * CANVAS_HEIGHT;
      playerPaddleY.current += (targetY - playerPaddleY.current) * 0.35;
      playerPaddleY.current = clampPaddleY(playerPaddleY.current);
    }

    if (gameActiveRef.current && !hasEndedRef.current && now >= servePauseUntil.current) {
      const settings = DIFFICULTY_SETTINGS[difficulty];

      aiPaddleY.current = updateAIPaddle(aiPaddleY.current, ball.current, settings, dt);

      const prevBallX = ball.current.x;
      const prevBallY = ball.current.y;

      const wallHit = updateBallPhysics(ball.current, dt);
      if (wallHit) playWallBounceSound();

      const hitPlayer = checkPaddleCollision(ball.current, prevBallX, prevBallY, playerPaddleY.current, PLAYER_X, true);
      if (hitPlayer) {
        playPaddleHitSound();
        spawnParticles(ball.current.x, ball.current.y, 'rgba(255,255,255,ALPHA)', 8);
      }

      const hitAI = checkPaddleCollision(ball.current, prevBallX, prevBallY, aiPaddleY.current, AI_X, false);
      if (hitAI) {
        playPaddleHitSound();
        spawnParticles(ball.current.x, ball.current.y, 'rgba(255,255,255,ALPHA)', 8);
      }

      if (ball.current.x + BALL_RADIUS < 0) {
        handlePoint('ai');
      } else if (ball.current.x - BALL_RADIUS > CANVAS_WIDTH) {
        handlePoint('player');
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

    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = THEME.success;
    ctx.fillRect(PLAYER_X, playerPaddleY.current - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.fillStyle = THEME.danger;
    ctx.fillRect(AI_X, aiPaddleY.current - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);

    if (now >= servePauseUntil.current || countdown !== null) {
      ctx.beginPath();
      ctx.arc(ball.current.x, ball.current.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = THEME.gold;
      ctx.fill();
    }

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

    if (pointFlash) {
      ctx.fillStyle = pointFlash === 'player' ? 'rgba(77, 208, 165, 0.15)' : 'rgba(255, 107, 107, 0.15)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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
      <ArcadeScreen eyebrow="Select Difficulty" title="Pong 🏓">
        <p className="stat-line--muted">
          Move your hand up/down to control your paddle. You have 5 lives — rack up points before the AI wins them all!
        </p>
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
        title="Pong 🏓"
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