import { getHighScore as getWhackHighScore } from '../games/WhackAMole/storage';
import { getHighScore as getFlappyHighScore } from '../games/FlappyBird/storage';
import { getHighScore as getFruitHighScore } from '../games/FruitNinja/storage';
import { getHighScore as getPongHighScore } from '../games/Pong/storage';
import './GameMenu.css';

// Reads best score across all difficulties for a given game's storage module
function getBestScore(getHighScoreFn) {
  return Math.max(getHighScoreFn('easy'), getHighScoreFn('medium'), getHighScoreFn('hard'));
}

export default function GameMenu({ onSelectGame }) {
  const games = [
    {
      id: 'whackamole',
      name: 'Whack-a-Mole',
      emoji: '🔨',
      ready: true,
      best: getBestScore(getWhackHighScore),
    },
    {
      id: 'flappybird',
      name: 'Flappy Bird',
      emoji: '🐦',
      ready: true,
      best: getBestScore(getFlappyHighScore),
    },
    {
      id: 'fruitninja',
      name: 'Fruit Ninja',
      emoji: '🍉',
      ready: true,
      best: getBestScore(getFruitHighScore),
    },
    {
      id: 'pong',
      name: 'Pong',
      emoji: '🏓',
      ready: true,
      best: getBestScore(getPongHighScore),
    },
    {
      id: 'mystery',
      name: 'New Cartridge',
      emoji: '❓',
      ready: false,
      best: 0,
    },
  ];

  return (
    <div className="arcade">
      <div className="arcade__bg" aria-hidden="true">
        <div className="arcade__grid" />
        <div className="arcade__glow" />
        <div className="arcade__scanlines" />
      </div>

      <div className="arcade__marquee" aria-hidden="true">
        {Array.from({ length: 13 }).map((_, i) => (
          <span
            key={i}
            className="arcade__bulb"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>

      <header className="arcade__header">
        <p className="arcade__eyebrow">1 Player · Hand Tracking</p>
        <h1 className="arcade__title">Webcam Game Hub</h1>
        <p className="arcade__subtitle">
          Move your hand, control the game — no mouse, no keyboard, no controller.
        </p>
      </header>

      <div className="arcade__cabinet">
        {games.map((game) => (
          <button
            key={game.id}
            className={`cartridge${game.ready ? '' : ' cartridge--locked'}`}
            onClick={() => game.ready && onSelectGame(game.id)}
            disabled={!game.ready}
            aria-label={game.ready ? `Play ${game.name}` : `${game.name} — coming soon`}
          >
            <span className="cartridge__notch" />
            <span className="cartridge__icon">{game.emoji}</span>
            <span className="cartridge__name">{game.name}</span>
            <span className="cartridge__footer">
              <span className="cartridge__best">
                {game.ready ? `Best ${game.best}` : '· · ·'}
              </span>
              <span className={`cartridge__status ${game.ready ? 'is-ready' : 'is-locked'}`}>
                {game.ready ? 'Ready' : 'Coming Soon'}
              </span>
            </span>
          </button>
        ))}
      </div>

      <p className="arcade__footnote">
        Grant camera access when prompted — your hand is the controller.
      </p>
    </div>
  );
}