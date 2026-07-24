import { useState } from 'react';
import './Leaderboard.css';

export default function Leaderboard({ topScores, loading, onSubmit, isNewHighScore }) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || isSubmitting || submitted) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const success = await onSubmit(name.trim());
      if (success) {
        setSubmitted(true);
      } else {
        setError('Could not submit your score. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
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
            disabled={isSubmitting}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="ghost-btn" type="submit" disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? 'Submitting…' : 'Submit Score'}
          </button>
        </form>
      )}

      {error && <p className="stat-line--muted">{error}</p>}

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