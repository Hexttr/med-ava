import Database from "better-sqlite3"
import path from "path"
import fs from "fs"

const DATA_DIR = path.join(process.cwd(), "data")
const DB_PATH = path.join(DATA_DIR, "eam.db")
const UPLOADS_DIR = path.join(DATA_DIR, "uploads")

let db: Database.Database | null = null

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
  const orgDir = path.join(UPLOADS_DIR, "organizations")
  const galleryDir = path.join(UPLOADS_DIR, "gallery")
  if (!fs.existsSync(orgDir)) fs.mkdirSync(orgDir, { recursive: true })
  if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true })
}

export function getDb(): Database.Database {
  if (db) return db
  ensureDataDir()
  db = new Database(DB_PATH)
  db.pragma("journal_mode = WAL")
  runMigrations(db)
  return db
}

function runMigrations(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      photo_path TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      photo_path TEXT NOT NULL,
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_employees_org_id ON employees(org_id);

    CREATE TABLE IF NOT EXISTS gallery_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      medical_path TEXT NOT NULL,
      corporate_path TEXT NOT NULL,
      organization_id TEXT,
      organization_name TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gallery_org ON gallery_items(organization_id);
  `)
}

export function getUploadsDir(): string {
  ensureDataDir()
  return UPLOADS_DIR
}

export function getDataDir(): string {
  ensureDataDir()
  return DATA_DIR
}
