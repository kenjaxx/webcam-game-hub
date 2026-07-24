const STORAGE_KEY = 'arcade_session_stats';

// Logs one lightweight record per completed round. Local-only (no server) —
// this powers the in-app "Your Stats" screen and could later feed an LLM
// summarizer if you want the "You're 23% more accurate than last week" copy.
export function logSession(gameId, { score, difficulty, accuracy, durationSec }) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    all.push({
      gameId,
      score,
      difficulty,
      accuracy, // 0–1
      durationSec,
      playedAt: Date.now(),
    });
    // Keep the last 200 sessions total to avoid unbounded growth.
    const trimmed = all.slice(-200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed to log session stats:', err);
  }
}

export function getAllSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function getStatsSummary(gameId = null) {
  const sessions = gameId ? getAllSessions().filter((s) => s.gameId === gameId) : getAllSessions();
  if (sessions.length === 0) {
    return { totalSessions: 0, avgAccuracy: 0, bestScore: 0, totalPlaySec: 0 };
  }
  const totalPlaySec = sessions.reduce((sum, s) => sum + (s.durationSec || 0), 0);
  const avgAccuracy = sessions.reduce((sum, s) => sum + (s.accuracy || 0), 0) / sessions.length;
  const bestScore = Math.max(...sessions.map((s) => s.score));
  return { totalSessions: sessions.length, avgAccuracy, bestScore, totalPlaySec };
}