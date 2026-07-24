import { useEffect } from 'react';

// Backs the canvas with extra pixel density on HiDPI screens so gameplay stays
// crisp, while game code keeps drawing in logical (CSS) pixel coordinates.
export function useHiDPICanvas(canvasRef, width, height) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [canvasRef, width, height]);
}