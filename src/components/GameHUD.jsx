import './GameHUD.css';

export default function GameHUD({ title, isFullscreen, muted, onToggleMute, onToggleFullscreen, stats, warning }) {
  return (
    <div className="game-hud">
      <div className="game-hud__row">
        <h2 className="game-hud__title">{title}</h2>
        <div className="game-hud__controls">
          <button className="game-hud__icon-btn" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="game-hud__icon-btn" onClick={onToggleFullscreen} aria-label="Toggle fullscreen">
            {isFullscreen ? '⤓' : '⤢'}
          </button>
        </div>
      </div>
      {stats && <p className="game-hud__stats">{stats}</p>}
      {warning && <p className="game-hud__warning">✋ {warning}</p>}
    </div>
  );
}