-- Table for Sleeper Player Pool Cache
CREATE TABLE IF NOT EXISTS players (
    player_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    position TEXT,
    team TEXT,
    injury_status TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table for Tank01 Player News Cache
CREATE TABLE IF NOT EXISTS player_news (
    news_id TEXT PRIMARY KEY,
    player_id TEXT,
    title TEXT NOT NULL,
    content TEXT,
    source TEXT,
    published_at TEXT,
    saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(player_id) REFERENCES players(player_id)
);

-- Indexing for blazing fast search speeds on Sunday mornings
CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);
CREATE INDEX IF NOT EXISTS idx_news_player_id ON player_news(player_id);
