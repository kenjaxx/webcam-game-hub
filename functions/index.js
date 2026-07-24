const functions = require('firebase-functions');
const fetch = require('node-fetch');

exports.gameCommentary = functions.https.onCall(async (data) => {
  const { gameId, score, difficulty, streak } = data;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': functions.config().anthropic.key, // set via `firebase functions:config:set anthropic.key="..."`
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 60,
      messages: [
        {
          role: 'user',
          content: `Write one short, upbeat, funny sentence (max 20 words) reacting to this arcade game result: game=${gameId}, score=${score}, difficulty=${difficulty}, bestStreak=${streak}. No hashtags, no emoji spam (max 1 emoji).`,
        },
      ],
    }),
  });

  const json = await response.json();
  const text = json.content?.find((c) => c.type === 'text')?.text || 'Nice round!';
  return { commentary: text };
});