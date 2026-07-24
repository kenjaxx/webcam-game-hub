import { useState } from 'react';
import GameMenu from './components/GameMenu';
import WhackAMole from './games/WhackAMole/WhackAMole';
import FlappyBird from './games/FlappyBird/FlappyBird';
import FruitNinja from './games/FruitNinja/FruitNinja';
import Pong from './games/Pong/Pong';

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
      case 'pong':
        return <Pong onExit={() => setSelectedGame(null)} />;
      default:
        return null;
    }
  }

  return selectedGame ? renderGame() : <GameMenu onSelectGame={setSelectedGame} />;
}

export default App;