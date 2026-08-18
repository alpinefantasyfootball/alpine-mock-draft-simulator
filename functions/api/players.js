export async function onRequest(context) {
  const { env } = context;
  
  // 1. Check if the database cache has players loaded within the last 24 hours
  const { results } = await env.DB.prepare(
    "SELECT * FROM players WHERE last_updated > datetime('now', '-1 day') LIMIT 1"
  ).all();

  // 2. Cache Hit: Serve instantly from Cloudflare D1
  if (results.length > 0) {
    const allPlayers = await env.DB.prepare("SELECT * FROM players").all();
    return new Response(JSON.stringify(allPlayers.results), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // 3. Cache Miss: Securely fetch from Sleeper API at the edge
  const response = await fetch("https://sleeper.app");
  const data = await response.json();

  // 4. Batch insert/update the player pool in the background to refresh cache
  const insertStatement = env.DB.prepare(
    "INSERT OR REPLACE INTO players (player_id, full_name, position, team, injury_status, last_updated) VALUES (?, ?, ?, ?, ?, datetime('now'))"
  );
  
  // Create an array of batch database writes (handling the first 100 for speed demo)
  const batchStatements = Object.values(data).slice(0, 100).map(p => 
    insertStatement.bind(p.player_id, p.full_name || 'Unknown', p.position, p.team, p.injury_status)
  );
  
  await env.DB.batch(batchStatements);

  return new Response(JSON.stringify(Object.values(data).slice(0, 100)), {
    headers: { "Content-Type": "application/json" }
  });
}
