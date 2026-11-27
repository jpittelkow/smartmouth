// The database (ADR 0010): one SQLite file in the data folder, node:sqlite, no ORM. Migrations are numbered steps
// below; PRAGMA user_version records how far a file has got. Never edit a step that has shipped: add a new one.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS: string[] = [
  // 1: the question library
  `CREATE TABLE questions (
     id            INTEGER PRIMARY KEY,
     seed_key      TEXT UNIQUE,
     prompt        TEXT NOT NULL,
     kind          TEXT NOT NULL,
     answers       TEXT NOT NULL,            -- JSON [{text, image}]
     correct       INTEGER NOT NULL,
     explain       TEXT NOT NULL DEFAULT '',
     age_min       INTEGER NOT NULL,         -- band rank, 0 = Little … 4 = Grown-ups
     age_max       INTEGER NOT NULL,
     difficulty    INTEGER NOT NULL,         -- 1–5 within its age range
     category      TEXT NOT NULL,
     tags          TEXT NOT NULL DEFAULT '[]',
     freshness     TEXT NOT NULL,            -- evergreen | dated | current
     as_of         TEXT,
     expires_at    TEXT,
     season        TEXT,
     region        TEXT NOT NULL DEFAULT 'global',
     spice         INTEGER NOT NULL DEFAULT 0, -- spice rank, 0 = Mild … 3 = Filthy
     status        TEXT NOT NULL DEFAULT 'draft',
     source        TEXT NOT NULL DEFAULT 'manual',
     source_ref    TEXT NOT NULL DEFAULT '',
     notes         TEXT NOT NULL DEFAULT '',
     asked         INTEGER NOT NULL DEFAULT 0,
     correct_count INTEGER NOT NULL DEFAULT 0,
     total_ms      INTEGER NOT NULL DEFAULT 0,
     last_asked_at TEXT,
     flags         INTEGER NOT NULL DEFAULT 0,
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL
   );
   CREATE INDEX questions_pick ON questions (status, age_min, age_max, category);
   CREATE INDEX questions_updated ON questions (updated_at);`,
  // 2: pictures (owner, 2026-11-27): a library of image files with their credits, and each question's picture and
  //    reveal pictures (stored with the question as JSON {url, alt, credit}, so a game never needs a join).
  `CREATE TABLE images (
     id         INTEGER PRIMARY KEY,
     file       TEXT NOT NULL UNIQUE,         -- under DATA_DIR/media/images/
     source     TEXT NOT NULL,                -- commons | upload | ai
     title      TEXT NOT NULL DEFAULT '',
     author     TEXT NOT NULL DEFAULT '',
     license    TEXT NOT NULL DEFAULT '',
     page_url   TEXT NOT NULL DEFAULT '',
     alt        TEXT NOT NULL DEFAULT '',
     width      INTEGER,
     height     INTEGER,
     created_at TEXT NOT NULL
   );
   ALTER TABLE questions ADD COLUMN image TEXT;
   ALTER TABLE questions ADD COLUMN reveal_images TEXT NOT NULL DEFAULT '[]';`,
];

export type Db = DatabaseSync;

export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v] as string);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}
