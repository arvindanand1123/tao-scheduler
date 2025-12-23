import { Database } from "jsr:@db/sqlite@^0.13.0";

const DB_PATH = "./tao.db";

let db: Database | null = null;

function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS server_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        pid INTEGER,
        status TEXT NOT NULL DEFAULT 'stopped',
        started_at TEXT,
        version TEXT
      )
    `);
    // Ensure there's always exactly one row
    db.exec(`
      INSERT OR IGNORE INTO server_state (id, status) VALUES (1, 'stopped')
    `);
  }
  return db;
}

export interface ServerState {
  pid: number | null;
  status: "running" | "stopped";
  startedAt: string | null;
  version: string | null;
}

export function getServerState(): ServerState {
  const db = getDb();
  const row = db.prepare(
    "SELECT pid, status, started_at, version FROM server_state WHERE id = 1"
  ).get<[number | null, string, string | null, string | null]>();

  if (!row) {
    return { pid: null, status: "stopped", startedAt: null, version: null };
  }

  return {
    pid: row[0],
    status: row[1] as "running" | "stopped",
    startedAt: row[2],
    version: row[3],
  };
}

export function setServerRunning(pid: number, version: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE server_state SET pid = ?, status = 'running', started_at = ?, version = ? WHERE id = 1"
  ).run(pid, new Date().toISOString(), version);
}

export function setServerStopped(): void {
  const db = getDb();
  db.prepare(
    "UPDATE server_state SET pid = NULL, status = 'stopped', started_at = NULL WHERE id = 1"
  ).run();
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
