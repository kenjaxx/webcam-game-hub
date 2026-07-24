import { createHighScoreStore } from '../../hooks/useHighScores';

export const { getHighScore, saveHighScoreIfBetter } = createHighScoreStore('fruitninja_highscores');