import { createHighScoreStore } from '../../hooks/useHighScores';

export const { getHighScore, saveHighScoreIfBetter } = createHighScoreStore('whackamole_highscores');