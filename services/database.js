/**
 * Database Service - SQLite persistence
 * Stores every AI generation (agent + 1:1 replies) and every BambiCloud
 * playlist link assigned by the autonomous agent.
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

class DatabaseService {
  constructor() {
    const dataDir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(path.join(dataDir, "bambisleep.sqlite"));
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        socket_id TEXT,
        username TEXT,
        source TEXT NOT NULL,
        prompt TEXT,
        response TEXT NOT NULL,
        word_count INTEGER,
        trigger_matched TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS playlist_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        socket_id TEXT,
        username TEXT,
        playlist_id TEXT NOT NULL,
        playlist_title TEXT NOT NULL,
        playlist_url TEXT NOT NULL,
        category TEXT,
        reason TEXT NOT NULL,
        trigger_matched TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at);
      CREATE INDEX IF NOT EXISTS idx_playlist_assignments_created_at ON playlist_assignments(created_at);
    `);

    this._insertGeneration = this.db.prepare(`
      INSERT INTO generations (socket_id, username, source, prompt, response, word_count, trigger_matched)
      VALUES (@socketId, @username, @source, @prompt, @response, @wordCount, @triggerMatched)
    `);

    this._insertPlaylistAssignment = this.db.prepare(`
      INSERT INTO playlist_assignments (socket_id, username, playlist_id, playlist_title, playlist_url, category, reason, trigger_matched)
      VALUES (@socketId, @username, @playlistId, @playlistTitle, @playlistUrl, @category, @reason, @triggerMatched)
    `);
  }

  /**
   * Records one AI-generated message (agent broadcast or 1:1 reply).
   * @param {object} data
   * @param {string} [data.socketId]
   * @param {string} [data.username]
   * @param {string} data.source - 'aigf' | 'agent-idle' | 'agent-trigger'
   * @param {string} [data.prompt]
   * @param {string} data.response
   * @param {number} [data.wordCount]
   * @param {string} [data.triggerMatched]
   */
  recordGeneration(data) {
    this._insertGeneration.run({
      socketId: data.socketId ?? null,
      username: data.username ?? null,
      source: data.source,
      prompt: data.prompt ?? null,
      response: data.response,
      wordCount: data.wordCount ?? null,
      triggerMatched: data.triggerMatched ?? null,
    });
  }

  /**
   * Records one BambiCloud playlist link assigned by the agent.
   * @param {object} data
   * @param {string} [data.socketId]
   * @param {string} [data.username]
   * @param {object} data.playlist - entry from workers/bambicloud-playlists.json
   * @param {string} data.reason - 'idle' | 'trigger'
   * @param {string} [data.triggerMatched]
   */
  recordPlaylistAssignment(data) {
    this._insertPlaylistAssignment.run({
      socketId: data.socketId ?? null,
      username: data.username ?? null,
      playlistId: data.playlist.id,
      playlistTitle: data.playlist.title,
      playlistUrl: data.playlist.url,
      category: data.playlist.category ?? null,
      reason: data.reason,
      triggerMatched: data.triggerMatched ?? null,
    });
  }

  getRecentGenerations(limit = 50) {
    return this.db
      .prepare("SELECT * FROM generations ORDER BY id DESC LIMIT ?")
      .all(limit);
  }

  getRecentPlaylistAssignments(limit = 50) {
    return this.db
      .prepare("SELECT * FROM playlist_assignments ORDER BY id DESC LIMIT ?")
      .all(limit);
  }

  close() {
    this.db.close();
  }
}

module.exports = new DatabaseService();
