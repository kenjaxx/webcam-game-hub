import { useEffect, useRef } from 'react';

// Calls `callback(deltaMs)` on every animation frame while the component using
// it is mounted. Keeping the callback in a ref means the rAF loop itself never
// restarts on re-render — only the *logic* it runs gets fresher each frame.
export function useAnimationFrame(callback) {
  const callbackRef = useRef(callback);
  const frameRef = useRef(null);
  const lastTimeRef = useRef(null);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    function tick(time) {
      const dt = lastTimeRef.current != null ? time - lastTimeRef.current : 16.67;
      lastTimeRef.current = time;
      callbackRef.current(dt);
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameRef.current);
      lastTimeRef.current = null;
    };
  }, []);
}