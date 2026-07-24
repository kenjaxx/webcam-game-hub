import { createHighScoreStore } from '../../hooks/useHighScores';

export const { getHighScore, saveHighScoreIfBetter } = createHighScoreStore('flappybird_highscores');