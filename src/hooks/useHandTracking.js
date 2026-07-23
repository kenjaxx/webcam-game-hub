import { useEffect, useRef, useState } from 'react';
// No more imports for Hands/Camera - they now come from window (loaded via CDN script tags)

export function useHandTracking(videoRef) {
  const [handData, setHandData] = useState(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;

    // Access MediaPipe classes from the global window object
    const hands = new window.Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
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

        setHandData({
          x: indexTip.x,
          y: indexTip.y,
          isPinching,
          allLandmarks: landmarks,
        });
      } else {
        setHandData(null);
      }
    });

    const camera = new window.Camera(videoRef.current, {
      onFrame: async () => {
        await hands.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
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