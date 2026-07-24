import { createHighScoreStore } from '../../hooks/useHighScores';

export const { getHighScore, saveHighScoreIfBetter } = createHighScoreStore('pong_highscores');