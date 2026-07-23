const STORAGE_KEY = 'fruitninja_highscores';

export function getHighScore(difficulty) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return data[difficulty] || 0;
  } catch {
    return 0;
  }
}

export function saveHighScoreIfBetter(difficulty, score) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    const currentBest = data[difficulty] || 0;
    if (score > currentBest) {
      data[difficulty] = score;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}