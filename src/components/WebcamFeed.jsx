import { useRef } from 'react';
import { useHandTracking } from '../hooks/useHandTracking';
import { HandTrackingContext } from '../hooks/HandTrackingContext';

// This component sets up the hidden video element MediaPipe needs, and
// exposes hand-tracking data (via context) to whatever's rendered inside it.
export default function WebcamFeed({ children }) {
  const videoRef = useRef(null);
  const tracking = useHandTracking(videoRef);

  return (
    <div style={{ position: 'relative', width: 640, height: 480 }}>
      <video ref={videoRef} style={{ display: 'none' }} playsInline />
      <HandTrackingContext.Provider value={tracking}>{children}</HandTrackingContext.Provider>
    </div>
  );
}