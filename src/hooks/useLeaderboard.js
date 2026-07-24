import { useCallback, useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const SUBMIT_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

// One Firestore collection per game (e.g. "leaderboard_whackamole"), each doc
// is { name, score, difficulty, createdAt }. Simple top-N read, no auth —
// fine for a casual arcade leaderboard, but note anyone can write to it as-is.
export function useLeaderboard(gameId) {
  const [topScores, setTopScores] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTop = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, `leaderboard_${gameId}`),
        orderBy('score', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      setTopScores(snapshot.docs.map((doc) => doc.data()));
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setTopScores([]);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // Resolves as soon as the write itself succeeds (or times out) — the
  // caller shouldn't have to wait on a full re-fetch of the top-10 just to
  // know their score went through. The refresh happens in the background.
  async function submitScore(name, score, difficulty) {
    try {
      await withTimeout(
        addDoc(collection(db, `leaderboard_${gameId}`), {
          name: name.slice(0, 20),
          score,
          difficulty,
          createdAt: serverTimestamp(),
        }),
        SUBMIT_TIMEOUT_MS,
        'Submission timed out — check your connection.'
      );
      fetchTop(); // fire-and-forget refresh, don't block on it
      return true;
    } catch (err) {
      console.error('Failed to submit score:', err);
      return false;
    }
  }

  useEffect(() => {
    fetchTop();
  }, [fetchTop]);

  return { topScores, loading, submitScore, refetch: fetchTop };
}