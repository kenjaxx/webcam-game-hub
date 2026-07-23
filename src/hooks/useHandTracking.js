import { useEffect, useRef, useState } from 'react';

const GRACE_PERIOD_MS = 300; // keep last known position for 300ms after losing detection

export function useHandTracking(videoRef) {
  const [handData, setHandData] = useState(null);
  const cameraRef = useRef(null);
  const smoothedPos = useRef({ x: 0.5, y: 0.5 });
  const isFirstDetection = useRef(true);
  const lastValidData = useRef(null);
  const lastSeenTime = useRef(0);

  useEffect(() => {
    if (!videoRef.current) return;

    const hands = new window.Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
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
        const distance = Math.hypot(
          indexTip.x - thumbTip.x,
          indexTip.y - thumbTip.y
        );
        const isPinching = distance < 0.05;

        const smoothingFactor = 0.35;

        if (isFirstDetection.current) {
          // First detection after hand appears - snap directly, no lag
          smoothedPos.current.x = indexTip.x;
          smoothedPos.current.y = indexTip.y;
          isFirstDetection.current = false;
        } else {
          smoothedPos.current.x =
            smoothedPos.current.x + (indexTip.x - smoothedPos.current.x) * smoothingFactor;
          smoothedPos.current.y =
            smoothedPos.current.y + (indexTip.y - smoothedPos.current.y) * smoothingFactor;
        }

        const newHandData = {
          x: smoothedPos.current.x,
          y: smoothedPos.current.y,
          isPinching,
          allLandmarks: landmarks,
        };

        setHandData(newHandData);

        // Store this as the "last known good" position for grace-period fallback
        lastValidData.current = newHandData;
        lastSeenTime.current = Date.now();
      } else {
        // No hand detected this frame - check if we're still within the grace period
        const now = Date.now();
        if (lastValidData.current && now - lastSeenTime.current < GRACE_PERIOD_MS) {
          // Brief flicker - keep showing last known position instead of vanishing
          setHandData(lastValidData.current);
        } else {
          // Real dropout - clear hand data and reset for next detection
          setHandData(null);
          isFirstDetection.current = true;
        }
      }
    });

    const camera = new window.Camera(videoRef.current, {
      onFrame: async () => {
        await hands.send({ image: videoRef.current });
      },
      width: 480,
      height: 360,
    });

    camera.start();
    cameraRef.current = camera;

    return () => {
      camera.stop();
      hands.close();
    };
  }, [videoRef]);

  return handData;
}