import { useCallback, useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

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

  async function submitScore(name, score, difficulty) {
    try {
      await addDoc(collection(db, `leaderboard_${gameId}`), {
        name: name.slice(0, 20),
        score,
        difficulty,
        createdAt: serverTimestamp(),
      });
      await fetchTop();
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