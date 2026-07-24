import { useRef } from 'react';

// Tracks a rolling window of hit/miss events during a round and nudges a
// difficulty multiplier up/down. Games multiply their own spawnRate/speed
// values by `getMultiplier()` instead of switching between fixed presets.
const WINDOW_SIZE = 8;
const MIN_MULTIPLIER = 0.6;
const MAX_MULTIPLIER = 1.8;
const ADJUST_STEP = 0.08;

export function useAdaptiveDifficulty() {
  const events = useRef([]); // true = hit, false = miss
  const multiplier = useRef(1);

  function recordHit() {
    events.current.push(true);
    trim();
    adjust();
  }

  function recordMiss() {
    events.current.push(false);
    trim();
    adjust();
  }

  function trim() {
    if (events.current.length > WINDOW_SIZE) {
      events.current.shift();
    }
  }

  function adjust() {
    if (events.current.length < WINDOW_SIZE) return; // not enough data yet
    const hitRate = events.current.filter(Boolean).length / events.current.length;

    // Player doing very well -> speed things up. Struggling -> ease off.
    if (hitRate > 0.75) {
      multiplier.current = Math.min(MAX_MULTIPLIER, multiplier.current + ADJUST_STEP);
    } else if (hitRate < 0.4) {
      multiplier.current = Math.max(MIN_MULTIPLIER, multiplier.current - ADJUST_STEP);
    }
  }

  function getMultiplier() {
    return multiplier.current;
  }

  function reset() {
    events.current = [];
    multiplier.current = 1;
  }

  return { recordHit, recordMiss, getMultiplier, reset };
}