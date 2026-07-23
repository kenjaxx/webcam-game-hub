import { useRef } from 'react';
import { useHandTracking } from '../hooks/useHandTracking';

// This component sets up the hidden video element MediaPipe needs,
// and exposes hand tracking data to whatever game wraps it.
export default function WebcamFeed({ children }) {
  const videoRef = useRef(null);
  const handData = useHandTracking(videoRef);

  return (
    <div style={{ position: 'relative', width: 640, height: 480 }}>
      {/* Hidden video feed - MediaPipe reads from this, we don't need to show it directly */}
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        playsInline
      />

      {/* Each game renders its own canvas/UI here, receiving handData as a prop */}
      {children(handData)}
    </div>
  );
}