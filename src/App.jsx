import { useState } from 'react';
import GameMenu from './components/GameMenu';
import WhackAMole from './games/WhackAMole/WhackAMole';
import FlappyBird from './games/FlappyBird/FlappyBird';
import FruitNinja from './games/FruitNinja/FruitNinja';

function App() {
  const [selectedGame, setSelectedGame] = useState(null);

  function renderGame() {
    switch (selectedGame) {
      case 'whackamole':
        return <WhackAMole onExit={() => setSelectedGame(null)} />;
      case 'flappybird':
        return <FlappyBird onExit={() => setSelectedGame(null)} />;
      case 'fruitninja':
        return <FruitNinja onExit={() => setSelectedGame(null)} />;
      default:
        return null;
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '1rem' }}>
      {!selectedGame ? <GameMenu onSelectGame={setSelectedGame} /> : renderGame()}
    </div>
  );
}

export default App;