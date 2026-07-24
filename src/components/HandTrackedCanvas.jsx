import WebcamFeed from './WebcamFeed';
import GameCanvasFrame from './GameCanvasFrame';
import { useHandTrackingContext } from '../hooks/HandTrackingContext';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { useHiDPICanvas } from '../hooks/useHiDPICanvas';

// The rAF loop lives here so it runs at full display refresh rate — reading
// the latest known hand position from a ref — instead of being throttled to
// however often MediaPipe happens to call back with new landmarks.
function GameLoopRunner({ canvasRef, width, height, isFullscreen, onFrame }) {
  const { handDataRef } = useHandTrackingContext();
  useHiDPICanvas(canvasRef, width, height);
  useAnimationFrame((dt) => onFrame(handDataRef.current, dt));

  return <GameCanvasFrame canvasRef={canvasRef} width={width} height={height} isFullscreen={isFullscreen} />;
}

// Each game just supplies `onFrame(handData, deltaMs)` — everything else
// (webcam, tracking, HiDPI scaling, the animation loop, the canvas frame) is shared.
export default function HandTrackedCanvas({ canvasRef, width, height, isFullscreen, onFrame }) {
  return (
    <WebcamFeed>
      <GameLoopRunner canvasRef={canvasRef} width={width} height={height} isFullscreen={isFullscreen} onFrame={onFrame} />
    </WebcamFeed>
  );
}