import { useEffect, useRef } from 'react';

// Tracks Arrow Up/Down (and W/S) as an alternative to hand tracking for any
// game that just needs "move up / move down" control. Exposes a ref with the
// current direction (-1 up, 1 down, 0 idle) plus a helper to check whether
// the keyboard was used recently, so games can prefer it over stale or
// unavailable hand-tracking data without the two inputs fighting each other.
const UP_KEYS = new Set(['ArrowUp', 'w', 'W']);
const DOWN_KEYS = new Set(['ArrowDown', 's', 'S']);
const ACTIVE_WINDOW_MS = 1000; // how long after the last keypress we still "prefer" keyboard

export function useKeyboardControl() {
  const directionRef = useRef(0);
  const lastInputTime = useRef(0);

  useEffect(() => {
    const keysDown = new Set();

    function recompute() {
      let up = false;
      let down = false;
      keysDown.forEach((key) => {
        if (UP_KEYS.has(key)) up = true;
        if (DOWN_KEYS.has(key)) down = true;
      });
      directionRef.current = up && !down ? -1 : down && !up ? 1 : 0;
    }

    function handleKeyDown(e) {
      if (!UP_KEYS.has(e.key) && !DOWN_KEYS.has(e.key)) return;
      e.preventDefault();
      keysDown.add(e.key);
      lastInputTime.current = Date.now();
      recompute();
    }

    function handleKeyUp(e) {
      if (!UP_KEYS.has(e.key) && !DOWN_KEYS.has(e.key)) return;
      keysDown.delete(e.key);
      lastInputTime.current = Date.now();
      recompute();
    }

    // If the window loses focus mid-press, don't leave a "stuck" direction.
    function handleBlur() {
      keysDown.clear();
      directionRef.current = 0;
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  function isActive() {
    return directionRef.current !== 0 || Date.now() - lastInputTime.current < ACTIVE_WINDOW_MS;
  }

  return { directionRef, isActive };
}