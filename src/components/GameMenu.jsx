export default function GameMenu({ onSelectGame }) {
  const games = [
    { id: 'whackamole', name: '🔨 Whack-a-Mole', ready: false },
    { id: 'flappybird', name: '🐦 Flappy Bird', ready: false },
    { id: 'fruitninja', name: '🍉 Fruit Ninja', ready: false },
    { id: 'pong', name: '🏓 Pong', ready: false },
  ];

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h1>Webcam Game Hub</h1>
      <p>Control classic games using just your hand — no keyboard needed.</p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => onSelectGame(game.id)}
            style={{
              padding: '1rem 1.5rem',
              fontSize: '1rem',
              cursor: 'pointer',
              opacity: game.ready ? 1 : 0.5,
            }}
          >
            {game.name}
            {!game.ready && <div style={{ fontSize: '0.7rem' }}>(coming soon)</div>}
          </button>
        ))}
      </div>
    </div>
  );
}