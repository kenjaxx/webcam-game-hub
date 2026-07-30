import { useEffect, useRef, useState } from 'react';
import ArcadeScreen from '../../components/ArcadeScreen';
import GameHUD from '../../components/GameHUD';
import HandTrackedCanvas from '../../components/HandTrackedCanvas';
import { useCountdown } from '../../hooks/useCountdown';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useRoom } from '../../hooks/useRoom';
import { logSession } from '../../hooks/useSessionStats';
import { THEME, drawArcadeBackground } from '../../shared/theme';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_HEIGHT,
  BALL_RADIUS,
  PLAYER_X,
  AI_X as GUEST_X,
  STARTING_LIVES,
  DIFFICULTY_SETTINGS,
  createBall,
  updateBallPhysics,
  checkPaddleCollision,
  clampPaddleY,
} from '../Pong/logic';
import {
  playPaddleHitSound,
  playWallBounceSound,
  playScoreSound,
  playMissSound,
  playGameOverSound,
  setMuted,
  getMuted,
} from '../Pong/sounds';
import './PongOnline.css';

export default function PongOnline({ onExit, initialRoomId }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [isFullscreen, toggleFullscreen] = useFullscreen(wrapperRef);
  const [countdown, setCountdown] = useCountdown();
  const [muted, setMutedState] = useState(getMuted());
  const [handDetected, setHandDetected] = useState(false);
  const [pointFlash, setPointFlash] = useState(null);
  const [copied, setCopied] = useState(false);

  const { room, roomId, role, connectionError, createRoom, joinRoom, updatePaddle, updateGameState, startPlaying, leaveRoom } =
    useRoom();

  const localPaddleY = useRef(CANVAS_HEIGHT / 2);
  const ballRef = useRef(null);
  const particles = useRef([]);
  const screenShake = useRef(0);
  const servePauseUntil = useRef(0);
  const lastPaddleSyncRef = useRef(0);
  const lastBallSyncRef = useRef(0);
  const autoJoinAttemptedRef = useRef(false);
  const startedRef = useRef(false);
  const prevStatusRef = useRef(null);
  const roundStartTimeRef = useRef(0);

  // Host-only running totals — kept in refs so a point can be resolved and
  // written in one go without waiting on a React state round-trip.
  const hostScoreRef = useRef(0);
  const guestScoreRef = useRef(0);
  const hostLivesRef = useRef(STARTING_LIVES);
  const guestLivesRef = useRef(STARTING_LIVES);

  // Auto-join if we arrived via an invite link.
  useEffect(() => {
    if (initialRoomId && !roomId && !autoJoinAttemptedRef.current) {
      autoJoinAttemptedRef.current = true;
      joinRoom(initialRoomId);
    }
  }, [initialRoomId, roomId, joinRoom]);

  // Kick off a local 3-2-1 countdown the moment the room enters 'countdown'.
  useEffect(() => {
    if (room?.status === 'countdown' && prevStatusRef.current !== 'countdown') {
      setCountdown(3);
    }
    prevStatusRef.current = room?.status;
  }, [room?.status, setCountdown]);

  // Host: once its local countdown finishes, spin up the ball and flip the room to 'playing'.
  useEffect(() => {
    if (role === 'host' && room?.status === 'countdown' && countdown === null && !startedRef.current) {
      startedRef.current = true;
      const settings = DIFFICULTY_SETTINGS[room.difficulty];
      const ball = createBall(settings.ballSpeed);
      ballRef.current = ball;
      hostScoreRef.current = 0;
      guestScoreRef.current = 0;
      hostLivesRef.current = STARTING_LIVES;
      guestLivesRef.current = STARTING_LIVES;
      roundStartTimeRef.current = Date.now();
      startPlaying(ball);
    }
  }, [role, room?.status, room?.difficulty, countdown, startPlaying]);

  const mySide = role === 'host' ? 'host' : 'guest';
  const oppSide = role === 'host' ? 'guest' : 'host';

  function spawnParticles(x, y, color, count = 12) {
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

  // Host-only: resolves a point, ends the match if someone's out of lives.
  function handlePoint(scorer) {
    const settings = DIFFICULTY_SETTINGS[room.difficulty];

    if (scorer === 'host') {
      hostScoreRef.current += 1;
      guestLivesRef.current = Math.max(0, guestLivesRef.current - 1);
      playScoreSound();
      spawnParticles(CANVAS_WIDTH - BALL_RADIUS - 4, ballRef.current.y, 'rgba(77, 208, 165, ALPHA)');
    } else {
      guestScoreRef.current += 1;
      hostLivesRef.current = Math.max(0, hostLivesRef.current - 1);
      playMissSound();
      screenShake.current = 10;
      spawnParticles(BALL_RADIUS + 4, ballRef.current.y, 'rgba(255, 107, 107, ALPHA)');
    }

    setPointFlash(scorer);
    setTimeout(() => setPointFlash(null), 500);

    const winner = hostLivesRef.current <= 0 ? 'guest' : guestLivesRef.current <= 0 ? 'host' : null;

    if (winner) {
      playGameOverSound();
      updateGameState({
        'host.score': hostScoreRef.current,
        'host.lives': hostLivesRef.current,
        'guest.score': guestScoreRef.current,
        'guest.lives': guestLivesRef.current,
        status: 'gameover',
        winner,
      });
      logSession('pongonline', {
        score: hostScoreRef.current,
        difficulty: room.difficulty,
        accuracy: null,
        durationSec: Math.round((Date.now() - roundStartTimeRef.current) / 1000),
      });
      return;
    }

    ballRef.current = createBall(settings.ballSpeed, scorer !== 'host');
    servePauseUntil.current = Date.now() + 500;

    updateGameState({
      'host.score': hostScoreRef.current,
      'host.lives': hostLivesRef.current,
      'guest.score': guestScoreRef.current,
      'guest.lives': guestLivesRef.current,
    });
  }

  function draw(handData, deltaMs) {
    const canvas = canvasRef.current;
    if (!canvas || !room) return;
    const ctx = canvas.getContext('2d');
    setHandDetected(!!handData);

    const dt = Math.min(deltaMs / 16.67, 3);
    const now = Date.now();

    if (handData) {
      const targetY = handData.y * CANVAS_HEIGHT;
      localPaddleY.current += (targetY - localPaddleY.current) * 0.35;
      localPaddleY.current = clampPaddleY(localPaddleY.current);
    }
    if (now - lastPaddleSyncRef.current > 80) {
      lastPaddleSyncRef.current = now;
      updatePaddle(mySide, localPaddleY.current);
    }

    const isPlaying = room.status === 'playing';
    const opponentPaddleY = room[oppSide]?.paddleY ?? CANVAS_HEIGHT / 2;

    // Only the host simulates physics; the guest just renders the synced ball.
    if (role === 'host' && isPlaying && ballRef.current && now >= servePauseUntil.current) {
      const prevBallX = ballRef.current.x;
      const prevBallY = ballRef.current.y;

      const wallHit = updateBallPhysics(ballRef.current, dt);
      if (wallHit) playWallBounceSound();

      const hitHost = checkPaddleCollision(ballRef.current, prevBallX, prevBallY, localPaddleY.current, PLAYER_X, true);
      if (hitHost) {
        playPaddleHitSound();
        spawnParticles(ballRef.current.x, ballRef.current.y, 'rgba(255,255,255,ALPHA)', 8);
      }

      const hitGuest = checkPaddleCollision(ballRef.current, prevBallX, prevBallY, opponentPaddleY, GUEST_X, false);
      if (hitGuest) {
        playPaddleHitSound();
        spawnParticles(ballRef.current.x, ballRef.current.y, 'rgba(255,255,255,ALPHA)', 8);
      }

      if (ballRef.current.x + BALL_RADIUS < 0) {
        handlePoint('guest');
      } else if (ballRef.current.x - BALL_RADIUS > CANVAS_WIDTH) {
        handlePoint('host');
      }

      if (now - lastBallSyncRef.current > 60) {
        lastBallSyncRef.current = now;
        updateGameState({
          ball: {
            x: ballRef.current.x,
            y: ballRef.current.y,
            vx: ballRef.current.vx,
            vy: ballRef.current.vy,
            speed: ballRef.current.speed,
          },
        });
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

    const hostPaddleY = role === 'host' ? localPaddleY.current : room.host?.paddleY ?? CANVAS_HEIGHT / 2;
    const guestPaddleY = role === 'guest' ? localPaddleY.current : room.guest?.paddleY ?? CANVAS_HEIGHT / 2;

    ctx.fillStyle = THEME.success;
    ctx.fillRect(PLAYER_X, hostPaddleY - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.fillStyle = THEME.danger;
    ctx.fillRect(GUEST_X, guestPaddleY - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);

    const ballPos = role === 'host' ? ballRef.current : room.ball;
    if (ballPos && (isPlaying || countdown !== null)) {
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, BALL_RADIUS, 0, Math.PI * 2);
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
      ctx.fillStyle = pointFlash === mySide ? 'rgba(77, 208, 165, 0.15)' : 'rgba(255, 107, 107, 0.15)';
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

  function handleCreate(difficulty) {
    startedRef.current = false;
    createRoom(difficulty);
  }

  function handleCopyLink() {
    const inviteLink = `${window.location.origin}${window.location.pathname}?game=pongonline&room=${roomId}`;
    navigator.clipboard
      ?.writeText(inviteLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        /* Clipboard API unavailable — link is still selectable/visible for manual copy. */
      });
  }

  function handleLeave() {
    if (roomId && room && (room.status === 'countdown' || room.status === 'playing')) {
      updateGameState({ status: 'abandoned' });
    }
    leaveRoom();
    onExit();
  }

  function handlePlayAgain() {
    startedRef.current = false;
    leaveRoom();
  }

  // ---------- Render states ----------

  if (connectionError) {
    return (
      <ArcadeScreen eyebrow="Connection Problem" title="Pong Online 🏓🌐">
        <p className="stat-line">{connectionError}</p>
        <div className="ghost-btn-row">
          <button className="ghost-btn" onClick={onExit}>Back to Menu</button>
        </div>
      </ArcadeScreen>
    );
  }

  if (initialRoomId && !roomId) {
    return (
      <ArcadeScreen eyebrow="Joining Game" title="Pong Online 🏓🌐">
        <p className="stat-line--muted">Connecting to your friend's game…</p>
      </ArcadeScreen>
    );
  }

  if (!roomId) {
    return (
      <ArcadeScreen eyebrow="2 Player · Online" title="Pong Online 🏓🌐">
        <p className="stat-line--muted">
          Create a game and send the invite link to a friend on another device. You'll each use your own
          webcam to control your paddle.
        </p>
        <div className="difficulty-grid">
          {Object.entries(DIFFICULTY_SETTINGS).map(([key, setting]) => (
            <button key={key} className="difficulty-card" onClick={() => handleCreate(key)}>
              <span className="difficulty-card__label">{setting.label}</span>
            </button>
          ))}
        </div>
        <div className="ghost-btn-row">
          <button className="ghost-btn" onClick={onExit}>← Back to Menu</button>
        </div>
      </ArcadeScreen>
    );
  }

  if (!room) {
    return (
      <ArcadeScreen eyebrow="Connecting" title="Pong Online 🏓🌐">
        <p className="stat-line--muted">Connecting…</p>
      </ArcadeScreen>
    );
  }

  if (room.status === 'abandoned') {
    return (
      <ArcadeScreen eyebrow="Match Ended" title="Opponent Left">
        <p className="stat-line--muted">Your opponent left the game.</p>
        <div className="ghost-btn-row">
          <button className="ghost-btn" onClick={onExit}>Back to Menu</button>
        </div>
      </ArcadeScreen>
    );
  }

  if (room.status === 'gameover') {
    const youWon = room.winner === role;
    return (
      <ArcadeScreen eyebrow="Match Over" title={youWon ? 'You Win! 🏆' : 'You Lose'}>
        <p className="stat-line">
          Final Score — You: {room[mySide]?.score ?? 0} · Opponent: {room[oppSide]?.score ?? 0}
        </p>
        <div className="ghost-btn-row">
          <button className="ghost-btn" onClick={handlePlayAgain}>New Game</button>
          <button className="ghost-btn" onClick={onExit}>Back to Menu</button>
        </div>
      </ArcadeScreen>
    );
  }

  if (room.status === 'waiting') {
    const inviteLink = `${window.location.origin}${window.location.pathname}?game=pongonline&room=${roomId}`;
    return (
      <ArcadeScreen eyebrow="Waiting For Opponent" title="Pong Online 🏓🌐">
        <p className="stat-line--muted">
          Send this link to a friend on another device. The game starts as soon as they open it.
        </p>
        <div className="invite-box">
          <code className="invite-link">{inviteLink}</code>
          <button className="ghost-btn" onClick={handleCopyLink}>{copied ? 'Copied!' : 'Copy Link'}</button>
        </div>
        <p className="stat-line--muted waiting-dots">Waiting for player to join</p>
        <div className="ghost-btn-row">
          <button className="ghost-btn" onClick={handleLeave}>Cancel</button>
        </div>
      </ArcadeScreen>
    );
  }

  // status is 'countdown' or 'playing'
  const heartsFor = (side) => {
    const lives = room[side]?.lives ?? STARTING_LIVES;
    return `${'❤️'.repeat(lives)}${'🖤'.repeat(STARTING_LIVES - lives)}`;
  };

  return (
    <div ref={wrapperRef} className={`game-wrapper${isFullscreen ? ' game-wrapper--fullscreen' : ''}`}>
      <GameHUD
        title="Pong Online 🏓🌐"
        isFullscreen={isFullscreen}
        muted={muted}
        onToggleMute={toggleMute}
        onToggleFullscreen={toggleFullscreen}
        stats={`You: ${room[mySide]?.score ?? 0} ${heartsFor(mySide)}  ·  Opponent: ${room[oppSide]?.score ?? 0} ${heartsFor(oppSide)}`}
        warning={!handDetected ? 'Hand not detected — move your hand into frame, with good lighting' : null}
      />

      <HandTrackedCanvas
        canvasRef={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        isFullscreen={isFullscreen}
        onFrame={draw}
      />

      <button className="ghost-btn" onClick={handleLeave} style={{ marginTop: '1rem' }}>Quit Game</button>
    </div>
  );
}