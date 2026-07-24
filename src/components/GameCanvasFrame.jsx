import './GameCanvasFrame.css';

export default function GameCanvasFrame({ canvasRef, width, height, isFullscreen }) {
  return (
    <div
      className="game-frame__canvas-wrap"
      style={{
        aspectRatio: `${width} / ${height}`,
        maxWidth: isFullscreen ? 900 : width,
      }}
    >
      <canvas ref={canvasRef} width={width} height={height} className="game-frame__canvas" />
    </div>
  );
}