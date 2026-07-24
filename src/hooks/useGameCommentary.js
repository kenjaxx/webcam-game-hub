import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';

export function useGameCommentary() {
  const [commentary, setCommentary] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchCommentary(gameId, score, difficulty, streak = 0) {
    setLoading(true);
    try {
      const functions = getFunctions(app);
      const call = httpsCallable(functions, 'gameCommentary');
      const result = await call({ gameId, score, difficulty, streak });
      setCommentary(result.data.commentary);
    } catch (err) {
      console.error('Commentary fetch failed:', err);
      setCommentary(null); // fail silently, don't block the game-over screen
    } finally {
      setLoading(false);
    }
  }

  return { commentary, loading, fetchCommentary };
}