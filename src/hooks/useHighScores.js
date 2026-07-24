// Factory for a localStorage-backed high-score store, keyed by difficulty.
export function createHighScoreStore(storageKey) {
  function readAll() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || {};
    } catch {
      return {};
    }
  }

  function getHighScore(difficulty) {
    return readAll()[difficulty] || 0;
  }

  function saveHighScoreIfBetter(difficulty, score) {
    try {
      const data = readAll();
      const currentBest = data[difficulty] || 0;
      if (score > currentBest) {
        data[difficulty] = score;
        localStorage.setItem(storageKey, JSON.stringify(data));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  return { getHighScore, saveHighScoreIfBetter };
}