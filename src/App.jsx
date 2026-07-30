import { useState } from 'react';
import GameMenu from './components/GameMenu';
import WhackAMole from './games/WhackAMole/WhackAMole';
import FlappyBird from './games/FlappyBird/FlappyBird';
import FruitNinja from './games/FruitNinja/FruitNinja';
import Pong from './games/Pong/Pong';
import PongOnline from './games/PongOnline/PongOnline';

// If the URL is an invite link (?game=pongonline&room=XXXXX), jump straight
// into the online game so opening the link is enough to join.
function getInitialGameFromURL() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room');
  const game = params.get('game');
  if (room && game === 'pongonline') {
    return { selectedGame: 'pongonline', initialRoomId: room };
  }
  return { selectedGame: null, initialRoomId: null };
}

function App() {
  const [{ selectedGame, initialRoomId }, setGameState] = useState(getInitialGameFromURL);

  function selectGame(id) {
    setGameState({ selectedGame: id, initialRoomId: null });
  }

  function exitToMenu() {
    // Clear ?room=/?game= so coming back to the menu doesn't immediately try to rejoin.
    window.history.replaceState({}, '', window.location.pathname);
    setGameState({ selectedGame: null, initialRoomId: null });
  }

  function renderGame() {
    switch (selectedGame) {
      case 'whackamole':
        return <WhackAMole onExit={exitToMenu} />;
      case 'flappybird':
        return <FlappyBird onExit={exitToMenu} />;
      case 'fruitninja':
        return <FruitNinja onExit={exitToMenu} />;
      case 'pong':
        return <Pong onExit={exitToMenu} />;
      case 'pongonline':
        return <PongOnline onExit={exitToMenu} initialRoomId={initialRoomId} />;
      default:
        return null;
    }
  }

  return selectedGame ? renderGame() : <GameMenu onSelectGame={selectGame} />;
}

export default App;