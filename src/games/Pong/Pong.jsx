import { useEffect, useRef, useState } from 'react';
import WebcamFeed from '../../components/WebcamFeed';
import ArcadeScreen from '../../components/ArcadeScreen';
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
  playCountdownBeep,
  setMuted,
} from './sounds';
import { getHighScore, saveHighScoreIfBetter } from './storage';

export default function Pong({ onExit }) {
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
  const [pointFlash, setPointFlash] = useState(null); // 'player' | 'ai' | null, for the brief serve pause

  // Fast-changing game state lives in refs to avoid re-render churn every frame
  const ball = useRef(null);
  const playerPaddleY = useRef(CANVAS_HEIGHT / 2);
  const aiPaddleY = useRef(CANVAS_HEIGHT / 2);
  const particles = useRef([]);
  const lastFrameTime = useRef(null);
  const screenShake = useRef(0);
  const gameActiveRef = useRef(false);
  const scoreRef = useRef(0);
  const livesRef = useRef(STARTING_LIVES);
  const hasEndedRef = useRef(false);
  const servePauseUntil = useRef(0);

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

  function startNewRound(chosenDifficulty) {
    const settings = DIFFICULTY_SETTINGS[chosenDifficulty];
    ball.current = createBall(settings.ballSpeed);
    playerPaddleY.current = CANVAS_HEIGHT / 2;
    aiPaddleY.current = CANVAS_HEIGHT / 2;
    particles.current = [];
    lastFrameTime.current = null;
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

  function endGame() {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    playGameOverSound();
    setGameOver(true);
    const isNew = saveHighScoreIfBetter(difficulty, scoreRef.current);
    setIsNewHighScore(isNew);
  }

  // Handles a point being scored, resets the ball, and gives a brief on-screen flash
  function handlePoint(scorer) {
    const settings = DIFFICULTY_SETTINGS[difficulty];

    if (scorer === 'player') {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      playScoreSound();
      spawnParticles(CANVAS_WIDTH - BALL_RADIUS - 4, ball.current.y, 'rgba(100, 220, 100, ALPHA)');
    } else {
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      playMissSound();
      screenShake.current = 10;
      spawnParticles(BALL_RADIUS + 4, ball.current.y, 'rgba(255, 100, 100, ALPHA)');
    }

    setPointFlash(scorer);
    setTimeout(() => setPointFlash(null), 500);

    if (scorer === 'ai' && livesRef.current <= 0) {
      endGame();
      return;
    }

    // Serve toward whoever just lost the point
    ball.current = createBall(settings.ballSpeed, scorer === 'player' ? false : true);
    servePauseUntil.current = Date.now() + 500;
  }

  function draw(handData) {
    const canvas = canvasRef.current;
    if (!canvas || !ball.current) return;
    const ctx = canvas.getContext('2d');

    setHandDetected(!!handData);

    const now = Date.now();
    const dt = lastFrameTime.current ? Math.min((now - lastFrameTime.current) / 16.67, 3) : 1;
    lastFrameTime.current = now;

    // --- UPDATE ---
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

      // Off-screen left = AI scored, off-screen right = player scored
      if (ball.current.x + BALL_RADIUS < 0) {
        handlePoint('ai');
      } else if (ball.current.x - BALL_RADIUS > CANVAS_WIDTH) {
        handlePoint('player');
      }
    }

    // --- DRAW ---
    ctx.save();

    if (screenShake.current > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake.current;
      const shakeY = (Math.random() - 0.5) * screenShake.current;
      ctx.translate(shakeX, shakeY);
      screenShake.current = Math.max(0, screenShake.current - 0.6);
    }

    // Court background
    ctx.fillStyle = '#0f1420';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Center dashed line
    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Player paddle (mint) and AI paddle (coral)
    ctx.fillStyle = '#4dd0a5';
    ctx.fillRect(PLAYER_X, playerPaddleY.current - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(AI_X, aiPaddleY.current - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Ball
    if (now >= servePauseUntil.current || countdown !== null) {
      ctx.beginPath();
      ctx.arc(ball.current.x, ball.current.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#ffeb3b';
      ctx.fill();
    }

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

    // Point-scored flash
    if (pointFlash) {
      ctx.fillStyle =
        pointFlash === 'player' ? 'rgba(77, 208, 165, 0.15)' : 'rgba(255, 107, 107, 0.15)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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
    padding: '1rem',
    textAlign: 'center',
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
        </div>
      </ArcadeScreen>
    );
  }

  // --- Screen 2: Game Over ---
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

  // --- Screen 3: Active Game ---
  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
        <h2 style={{ color: isFullscreen ? 'white' : 'inherit' }}>Pong 🏓</h2>
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