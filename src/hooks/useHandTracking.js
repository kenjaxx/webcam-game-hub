import { useEffect, useRef, useState } from 'react';


function classifyGesture(landmarks) {

  const wrist = landmarks[0];
  const tips = [8, 12, 16, 20];
  const knuckles = [6, 10, 14, 18];

  let extendedCount = 0;
  for (let i = 0; i < tips.length; i++) {
    const tipDist = Math.hypot(landmarks[tips[i]].x - wrist.x, landmarks[tips[i]].y - wrist.y);
    const knuckleDist = Math.hypot(landmarks[knuckles[i]].x - wrist.x, landmarks[knuckles[i]].y - wrist.y);
    if (tipDist > knuckleDist * 1.15) extendedCount++;
  }

  if (extendedCount >= 3) return 'open_palm';
  if (extendedCount === 0) return 'fist';
  return 'neutral';
}

const GRACE_PERIOD_MS = 300; // keep last known position for 300ms after losing detection

export function useHandTracking(videoRef) {
  const handDataRef = useRef(null);
  const [handDetected, setHandDetected] = useState(false);

  const smoothedPos = useRef({ x: 0.5, y: 0.5 });
  const isFirstDetection = useRef(true);
  const lastSeenTime = useRef(0);

  useEffect(() => {
    if (!videoRef.current) return;

    let cancelled = false;
    let hands = null;
    let camera = null;

    function init() {
      if (cancelled) return;
      // MediaPipe scripts load with `defer` now, so wait for them if needed.
      if (!window.Hands || !window.Camera) {
        requestAnimationFrame(init);
        return;
      }

      hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results) => {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
    const isPinching = distance < 0.05;
    const smoothingFactor = 0.35;

    if (isFirstDetection.current) {
      smoothedPos.current.x = indexTip.x;
      smoothedPos.current.y = indexTip.y;
      isFirstDetection.current = false;
    } else {
      smoothedPos.current.x += (indexTip.x - smoothedPos.current.x) * smoothingFactor;
      smoothedPos.current.y += (indexTip.y - smoothedPos.current.y) * smoothingFactor;
    }

    const newHandData = {
      x: smoothedPos.current.x,
      y: smoothedPos.current.y,
      isPinching,
      gesture: classifyGesture(landmarks),
      allLandmarks: landmarks,
    };

    handDataRef.current = newHandData;

    lastSeenTime.current = Date.now();
    setHandDetected(true);
  } else {
    const now = Date.now();
    if (handDataRef.current && now - lastSeenTime.current < GRACE_PERIOD_MS) {
      // Brief flicker - keep last known position instead of vanishing.
    } else {
      handDataRef.current = null;
      isFirstDetection.current = true;
      setHandDetected(false);
    }
  }
});

      camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current });
        },
        width: 480,
        height: 360,
      });
      camera.start();
    }

    init();

    return () => {
      cancelled = true;
      camera?.stop();
      hands?.close();
    };
  }, [videoRef]);

  return { handDataRef, handDetected };
}

