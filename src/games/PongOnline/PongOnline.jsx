import { useEffect, useRef, useState } from 'react';
import ArcadeScreen from '../../components/ArcadeScreen';
import GameHUD from '../../components/GameHUD';
import HandTrackedCanvas from '../../components/HandTrackedCanvas';
import { useCountdown } from '../../hooks/useCountdown';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useKeyboardControl } from '../../hooks/useKeyboardControl';
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
  SERVE_PAUSE_MS,
  KEYBOARD_PADDLE_SPEED,
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
  const keyboard = useKeyboardControl();
  const [muted, setMutedState] = useState(getMuted());
  const [handDetected, setHandDetected] = useState(false);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [pointFlash, setPointFlash] = useState(null);
  const [copied, setCopied] = useState(false);

  const {
    room,
    roomId,
    role,
    connectionError,
    createRoom,
    joinRoom,
    updatePaddle,
    setReady,
    updateGameState,
    startPlaying,
    resetForRematch,
    leaveRoom,
  } = useRoom();

  const localPaddleY = useRef(CANVAS_HEIGHT / 2);
  const ballRef = useRef(null);
  const particles = useRef([]);
  const screenShake = useRef(0);
  const servePauseUntil = useRef(0);
  const lastPaddleSyncRef = useRef(0);
  const lastBallSyncRef = useRef(0);
  const autoJoinAttemptedRef = useRef(false);
  const startedRef = useRef(false);
  const readyTransitionRef = useRef(false);
  const prevStatusRef = useRef(null);
  const roundStartTimeRef = useRef(0);

  // Drives the "Get Ready: N" readout shown to BOTH players after a point.
  // The host also drives actual ball-physics gating via `servePauseUntil`
  // (set immediately, no round trip needed); this ref is what everyone's
  // canvas reads to draw the countdown, kept in sync via the score watch
  // below for the guest (and set directly by the host for zero-lag display).
  const displayServeUntilRef = useRef(0);
  const prevTotalScoreRef = useRef(0);

  const hostScoreRef = useRef(0);
  const guestScoreRef = useRef(0);
  const hostLivesRef = useRef(STARTING_LIVES);
  const guestLivesRef = useRef(STARTING_LIVES);

  const mySide = role === 'host' ? 'host' : 'guest';
  const oppSide = role === 'host' ? 'guest' : 'host';
  const iAmReady = !!room?.[mySide]?.ready;
  const opponentReady = !!room?.[oppSide]?.ready;

  useEffect(() => {
    if (initialRoomId && !roomId && !autoJoinAttemptedRef.current) {
      autoJoinAttemptedRef.current = true;
      joinRoom(initialRoomId);
    }
  }, [initialRoomId, roomId, joinRoom]);

  // Once both players hit "Ready", the host (single writer) advances the
  // room into the 3-2-1 countdown. Guarded by a ref so it only fires once
  // per ready phase even though this effect re-runs on every snapshot.
  useEffect(() => {
    if (
      role === 'host' &&
      room?.status === 'ready' &&
      room.host?.ready &&
      room.guest?.ready &&
      !readyTransitionRef.current
    ) {
      readyTransitionRef.current = true;
      updateGameState({ status: 'countdown' });
    }
    if (room?.status !== 'ready') {
      readyTransitionRef.current = false;
    }
  }, [role, room?.status, room?.host?.ready, room?.guest?.ready, updateGameState]);

  useEffect(() => {
    if (room?.status === 'countdown' && prevStatusRef.current !== 'countdown') {
      setCountdown(3);
    }
    prevStatusRef.current = room?.status;
  }, [room?.status, setCountdown]);

  // Every time we land back on the ready screen (fresh room OR a rematch),
  // clear the "already started this round" guard, and reset the serve-pause
  // trackers so a leftover countdown from the last match doesn't flash up.
  useEffect(() => {
    if (room?.status === 'ready') {
      startedRef.current = false;
      prevTotalScoreRef.current = 0;
      displayServeUntilRef.current = 0;
    }
  }, [room?.status]);

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
    const pauseUntil = Date.now() + SERVE_PAUSE_MS;
    servePauseUntil.current = pauseUntil;
    // Host sets its own display countdown immediately (no need to wait for
    // the round trip through Firestore) and pre-marks the score total so the
    // score-watch effect below doesn't double-trigger once the write echoes back.
    displayServeUntilRef.current = pauseUntil;
    prevTotalScoreRef.current = hostScoreRef.current + guestScoreRef.current;

    updateGameState({
      'host.score': hostScoreRef.current,
      'host.lives': hostLivesRef.current,
      'guest.score': guestScoreRef.current,
      'guest.lives': guestLivesRef.current,
    });
  }

  // Lightweight camera preview shown on the ready screen — just confirms hand
  // tracking is working before the match starts, no gameplay logic involved.
  function drawReady(handData) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    setHandDetected(!!handData);

    drawArcadeBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = THEME.text;
    ctx.font = `bold 18px ${THEME.fontHeading}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Move your hand to test tracking (or just use ↑ / ↓)', CANVAS_WIDTH / 2, 26);

    if (handData) {
      const cursorX = (1 - handData.x) * CANVAS_WIDTH;
      const cursorY = handData.y * CANVAS_HEIGHT;
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 10, 0, Math.PI * 2);
      ctx.fillStyle = THEME.gold;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#160f24';
      ctx.stroke();
    }
  }

  function draw(handData, deltaMs) {
    const canvas = canvasRef.current;
    if (!canvas || !room) return;
    const ctx = canvas.getContext('2d');
    setHandDetected(!!handData);

    const dt = Math.min(deltaMs / 16.67, 3);
    const now = Date.now();

    // Keyboard takes priority over hand tracking whenever it's actively in use.
    const usingKeyboard = keyboard.isActive();
    setKeyboardActive(usingKeyboard);

    if (usingKeyboard) {
      localPaddleY.current += keyboard.directionRef.current * KEYBOARD_PADDLE_SPEED * dt;
      localPaddleY.current = clampPaddleY(localPaddleY.current);
    } else if (handData) {
      const targetY = handData.y * CANVAS_HEIGHT;
      localPaddleY.current += (targetY - localPaddleY.current) * 0.45;
      localPaddleY.current = clampPaddleY(localPaddleY.current);
    }
    if (now - lastPaddleSyncRef.current > 80) {
      lastPaddleSyncRef.current = now;
      updatePaddle(mySide, localPaddleY.current);
    }

    const isPlaying = room.status === 'playing';
    const opponentPaddleY = room[oppSide]?.paddleY ?? CANVAS_HEIGHT / 2;

    // Guest doesn't run handlePoint, so it detects a scored point purely from
    // the synced score total changing, and starts its own local "get ready"
    // countdown display from that moment.
    if (isPlaying) {
      const totalScore = (room.host?.score ?? 0) + (room.guest?.score ?? 0);
      if (totalScore !== prevTotalScoreRef.current) {
        prevTotalScoreRef.current = totalScore;
        if (totalScore > 0) {
          displayServeUntilRef.current = now + SERVE_PAUSE_MS;
        }
      }
    }

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

    // Shown to BOTH players — ball is parked at center, paddles still respond,
    // this is just the "heads up, play resumes in N" readout.
    if (isPlaying && countdown === null && now < displayServeUntilRef.current) {
      const secondsLeft = Math.max(1, Math.ceil((displayServeUntilRef.current - now) / 1000));
      ctx.fillStyle = THEME.text;
      ctx.font = `bold 22px ${THEME.fontHeading}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Get Ready: ${secondsLeft}`, CANVAS_WIDTH / 2, 30);
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
      .catch(() => {});
  }

  function handleLeave() {
    if (roomId && room && ['ready', 'countdown', 'playing', 'gameover'].includes(room.status)) {
      updateGameState({ status: 'abandoned' });
    }
    leaveRoom();
    onExit();
  }

  // Resets scores/lives/readiness but keeps the SAME room doc — and therefore
  // the same invite link — so both players can go again without re-sharing anything.
  function handleRematch() {
    resetForRematch();
  }

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
          webcam, or the ↑ / ↓ arrow keys, to control your paddle.
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
          <button className="ghost-btn" onClick={handleRematch}>Play Again (Same Link)</button>
          <button className="ghost-btn" onClick={handleLeave}>Back to Menu</button>
        </div>
      </ArcadeScreen>
    );
  }

  if (room.status === 'waiting') {
    const inviteLink = `${window.location.origin}${window.location.pathname}?game=pongonline&room=${roomId}`;
    return (
      <ArcadeScreen eyebrow="Waiting For Opponent" title="Pong Online 🏓🌐">
        <p className="stat-line--muted">
          Send this link to a friend on another device. You'll both get a chance to ready up once they join.
        </p>
        <div className="invite-box">
          <code className="invite-link">{inviteLink}</code>
          <button className="ghost-btn" onClick={handleCopyLink}>{copied ? 'Copied!' : 'Copy Link'}</button>
        </div>
        <p className="stat-line--muted">Waiting for player to join...</p>
        <div className="ghost-btn-row">
          <button className="ghost-btn" onClick={handleLeave}>Cancel</button>
        </div>
      </ArcadeScreen>
    );
  }

  if (room.status === 'ready') {
    const inviteLink = `${window.location.origin}${window.location.pathname}?game=pongonline&room=${roomId}`;
    return (
      <div ref={wrapperRef} className={`game-wrapper${isFullscreen ? ' game-wrapper--fullscreen' : ''}`}>
        <GameHUD
          title="Pong Online 🏓🌐"
          isFullscreen={isFullscreen}
          muted={muted}
          onToggleMute={toggleMute}
          onToggleFullscreen={toggleFullscreen}
          stats={`Difficulty: ${DIFFICULTY_SETTINGS[room.difficulty]?.label ?? room.difficulty}`}
          warning={
            !handDetected && !keyboardActive
              ? 'Hand not detected — move your hand into frame, with good lighting (or use ↑ / ↓ arrow keys)'
              : null
          }
        />

        <HandTrackedCanvas
          canvasRef={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          isFullscreen={isFullscreen}
          onFrame={drawReady}
        />

        <div className="ready-panel">
          <p className="stat-line--muted">
            Get your camera set up (or just have your arrow keys ready) and check your hand shows up
            above. The match starts as soon as both players hit ready.
          </p>
          <div className="ready-status-row">
            <span className={`ready-pill${iAmReady ? ' is-ready' : ''}`}>
              You: {iAmReady ? 'Ready ✅' : 'Not Ready'}
            </span>
            <span className={`ready-pill${opponentReady ? ' is-ready' : ''}`}>
              Opponent: {opponentReady ? 'Ready ✅' : 'Waiting…'}
            </span>
          </div>
          <div className="ghost-btn-row">
            <button className="ghost-btn" onClick={() => setReady(mySide, !iAmReady)}>
              {iAmReady ? 'Cancel Ready' : "I'm Ready"}
            </button>
            <button className="ghost-btn" onClick={handleLeave}>Leave Game</button>
          </div>
          <div className="invite-box">
            <code className="invite-link">{inviteLink}</code>
          </div>
        </div>
      </div>
    );
  }

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
        warning={
          !handDetected && !keyboardActive
            ? 'Hand not detected — move your hand into frame, with good lighting (or use ↑ / ↓ arrow keys)'
            : null
        }
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