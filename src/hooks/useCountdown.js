import { useEffect, useState } from 'react';
import { playCountdownBeep } from './useSound';

// Runs a 3-2-1-GO countdown. `countdown` is null when inactive, 0 during the
// "GO!" beat. Call the returned setter with e.g. 3 to start a round.
export function useCountdown() {
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      const timeout = setTimeout(() => setCountdown(null), 500);
      return () => clearTimeout(timeout);
    }

    playCountdownBeep();
    const timeout = setTimeout(() => setCountdown((prev) => prev - 1), 800);
    return () => clearTimeout(timeout);
  }, [countdown]);

  return [countdown, setCountdown];
}