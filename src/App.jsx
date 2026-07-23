import { useState } from 'react';
import GameMenu from './components/GameMenu';
import WebcamFeed from './components/WebcamFeed';

function App() {
  const [selectedGame, setSelectedGame] = useState(null);

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      {!selectedGame ? (
        <GameMenu onSelectGame={setSelectedGame} />
      ) : (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <button onClick={() => setSelectedGame(null)}>← Back to Menu</button>
          <WebcamFeed>
            {(handData) => (
              <div>
                <p>Hand data: {handData ? `x:${handData.x.toFixed(2)}, y:${handData.y.toFixed(2)}, pinch:${handData.isPinching}` : 'No hand detected'}</p>
              </div>
            )}
          </WebcamFeed>
        </div>
      )}
    </div>
  );
}

export default App;