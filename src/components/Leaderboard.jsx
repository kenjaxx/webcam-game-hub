import { useState } from 'react';
import './Leaderboard.css';

export default function Leaderboard({ topScores, loading, onSubmit, isNewHighScore }) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit(name.trim());
    setSubmitted(true);
  }

  return (
    <div className="leaderboard">
      <p className="leaderboard__title">🌐 Global Leaderboard</p>

      {isNewHighScore && !submitted && (
        <form className="leaderboard__form" onSubmit={handleSubmit}>
          <input
            className="leaderboard__input"
            placeholder="Your name"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="ghost-btn" type="submit">Submit Score</button>
        </form>
      )}

      {loading ? (
        <p className="stat-line--muted">Loading scores…</p>
      ) : topScores.length === 0 ? (
        <p className="stat-line--muted">No scores yet — be the first!</p>
      ) : (
        <ol className="leaderboard__list">
          {topScores.map((entry, i) => (
            <li key={i} className="leaderboard__row">
              <span className="leaderboard__rank">#{i + 1}</span>
              <span className="leaderboard__name">{entry.name}</span>
              <span className="leaderboard__score">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}