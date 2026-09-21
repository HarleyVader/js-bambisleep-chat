/**
 * Database Service - SQLite persistence
 * Stores every AI generation (agent + 1:1 replies) and every BambiCloud
 * playlist link assigned by the autonomous agent.
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const ENV = require("../config/env");

class DatabaseService {
  constructor() {
    const dataDir = ENV.SERVER.DATA_DIR;
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        if (err.code === "EACCES") {
          throw new Error(
            `Cannot create data directory at "${dataDir}": permission denied. ` +
              `Either grant the service user write access to this path, or set the ` +
              `DATA_DIR environment variable to a directory the service user owns.`,
            { cause: err },
          );
        }
        throw err;
      }
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

      CREATE TABLE IF NOT EXISTS patreon_tiers (
        patreon_user_id TEXT PRIMARY KEY,
        tier TEXT NOT NULL,
        features TEXT NOT NULL,
        email TEXT,
        full_name TEXT,
        avatar_url TEXT,
        thumb_url TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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

    this._upsertPatreonTier = this.db.prepare(`
      INSERT INTO patreon_tiers (patreon_user_id, tier, features, email, full_name, avatar_url, thumb_url, updated_at)
      VALUES (@patreonUserId, @tier, @features, @email, @fullName, @avatarUrl, @thumbUrl, datetime('now'))
      ON CONFLICT(patreon_user_id) DO UPDATE SET
        tier = excluded.tier,
        features = excluded.features,
        email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url,
        thumb_url = excluded.thumb_url,
        updated_at = excluded.updated_at
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

  /**
   * Persists (upserts) a Patreon user's tier so it survives server restarts.
   * @param {string} patreonUserId
   * @param {object} tierData - { tier, features, email, fullName, avatarUrl, thumbUrl }
   */
  savePatreonTier(patreonUserId, tierData) {
    this._upsertPatreonTier.run({
      patreonUserId,
      tier: tierData.tier,
      features: JSON.stringify(tierData.features ?? []),
      email: tierData.email ?? null,
      fullName: tierData.fullName ?? null,
      avatarUrl: tierData.avatarUrl ?? null,
      thumbUrl: tierData.thumbUrl ?? null,
    });
  }

  /**
   * Loads every persisted Patreon tier, keyed by patreon_user_id, for
   * rehydrating the in-memory cache on server startup.
   * @returns {Map<string, object>}
   */
  getAllPatreonTiers() {
    const rows = this.db.prepare("SELECT * FROM patreon_tiers").all();
    const tiersByUserId = new Map();
    for (const row of rows) {
      tiersByUserId.set(row.patreon_user_id, {
        tier: row.tier,
        features: JSON.parse(row.features),
        userId: row.patreon_user_id,
        email: row.email,
        fullName: row.full_name,
        avatarUrl: row.avatar_url,
        thumbUrl: row.thumb_url,
        updatedAt: row.updated_at,
      });
    }
    return tiersByUserId;
  }

  close() {
    this.db.close();
  }
}

module.exports = new DatabaseService();
