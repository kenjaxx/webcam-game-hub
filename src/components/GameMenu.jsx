export default function GameMenu({ onSelectGame }) {
  const games = [
    { id: 'whackamole', name: '🔨 Whack-a-Mole', ready: true },
    { id: 'flappybird', name: '🐦 Flappy Bird', ready: true },
    { id: 'fruitninja', name: '🍉 Fruit Ninja', ready: true },
    { id: 'pong', name: '🏓 Pong', ready: false },
  ];

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h1>Webcam Game Hub</h1>
      <p>Control classic games using just your hand — no keyboard needed.</p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }}>
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => game.ready && onSelectGame(game.id)}
            disabled={!game.ready}
            style={{
              padding: '1rem 1.5rem',
              fontSize: '1rem',
              cursor: game.ready ? 'pointer' : 'not-allowed',
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