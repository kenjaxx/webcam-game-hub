import { getStatsSummary } from '../hooks/useSessionStats';
import ArcadeScreen from './ArcadeScreen';

const GAMES = [
  { id: 'whackamole', name: 'Whack-a-Mole' },
  { id: 'flappybird', name: 'Flappy Bird' },
  { id: 'fruitninja', name: 'Fruit Ninja' },
  { id: 'pong', name: 'Pong' },
];

export default function StatsScreen({ onExit }) {
  return (
    <ArcadeScreen eyebrow="Your Stats" title="Player Profile 📊">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: 420 }}>
        {GAMES.map((game) => {
          const stats = getStatsSummary(game.id);
          return (
            <div
              key={game.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                border: '1px solid rgba(180, 91, 255, 0.3)',
                borderRadius: 10,
                background: 'rgba(180, 91, 255, 0.06)',
              }}
            >
              <span>{game.name}</span>
              <span className="stat-line--muted">
                {stats.totalSessions === 0
                  ? 'No plays yet'
                  : `Best ${stats.bestScore} · ${Math.round(stats.avgAccuracy * 100)}% acc · ${stats.totalSessions} plays`}
              </span>
            </div>
          );
        })}
      </div>
      <div className="ghost-btn-row">
        <button className="ghost-btn" onClick={onExit}>← Back to Menu</button>
      </div>
    </ArcadeScreen>
  );
}