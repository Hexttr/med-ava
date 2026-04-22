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
  const employeesDir = path.join(UPLOADS_DIR, "employees")
  const galleryDir = path.join(UPLOADS_DIR, "gallery")
  const backgroundsDir = path.join(UPLOADS_DIR, "backgrounds")
  if (!fs.existsSync(employeesDir)) fs.mkdirSync(employeesDir, { recursive: true })
  if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true })
  if (!fs.existsSync(backgroundsDir)) fs.mkdirSync(backgroundsDir, { recursive: true })
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
  database.exec(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT);`)
  // Schema version: 1 = old, 2 = new (departments + employees + gallery_items with employee_id)
  database.exec(`
    CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER NOT NULL);
    INSERT INTO _schema_version (version) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM _schema_version);
  `)
  const row = database.prepare("SELECT version FROM _schema_version LIMIT 1").get() as { version: number } | undefined
  const version = row?.version ?? 1

  if (version < 2) {

  const hasOrgs = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='organizations'"
  ).get()

  if (hasOrgs) {
    // Migrate from old schema
    database.exec(`
      CREATE TABLE IF NOT EXISTS departments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS employees_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        photo_path TEXT NOT NULL,
        department_id TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      );
    `)
    const oldEmployees = database.prepare("SELECT id, name, photo_path FROM employees").all() as Array<{ id: string; name: string; photo_path: string }>
    const now = Date.now()
    const insertEmp = database.prepare(
      "INSERT INTO employees_new (id, name, photo_path, department_id, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    for (const e of oldEmployees) {
      insertEmp.run(e.id, e.name, e.photo_path, null, now)
    }
    database.exec(`
      DROP TABLE IF EXISTS employees;
      ALTER TABLE employees_new RENAME TO employees;
      CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
    `)

    database.exec(`
      CREATE TABLE IF NOT EXISTS gallery_items_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        medical_path TEXT NOT NULL,
        corporate_path TEXT NOT NULL,
        employee_id TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
      );
    `)
    const oldGallery = database.prepare(
      "SELECT id, name, medical_path, corporate_path, created_at FROM gallery_items"
    ).all() as Array<{ id: string; name: string; medical_path: string; corporate_path: string; created_at: number }>
    const insertGal = database.prepare(
      "INSERT INTO gallery_items_new (id, name, medical_path, corporate_path, employee_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    for (const g of oldGallery) {
      insertGal.run(g.id, g.name, g.medical_path, g.corporate_path, null, g.created_at)
    }
    database.exec(`
      DROP TABLE gallery_items;
      ALTER TABLE gallery_items_new RENAME TO gallery_items;
      CREATE INDEX IF NOT EXISTS idx_gallery_employee_id ON gallery_items(employee_id);
      DROP TABLE IF EXISTS organizations;
    `)
  } else {
    // Fresh install: create new schema only
    database.exec(`
      CREATE TABLE IF NOT EXISTS departments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        photo_path TEXT NOT NULL,
        department_id TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);

      CREATE TABLE IF NOT EXISTS gallery_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        medical_path TEXT NOT NULL,
        corporate_path TEXT NOT NULL,
        employee_id TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_gallery_employee_id ON gallery_items(employee_id);
    `)
  }

  database.prepare("UPDATE _schema_version SET version = 2").run()
  }

  if (version < 3) {
    try {
      database.exec("ALTER TABLE employees ADD COLUMN thumbnail_path TEXT")
    } catch {
      // Column may already exist
    }
    database.prepare("UPDATE _schema_version SET version = 3").run()
  }

  if (version < 4) {
    database.exec(`
      CREATE TABLE gallery_items_v4 (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        medical_path TEXT,
        corporate_path TEXT,
        employee_id TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
      );
    `)
    const rows = database.prepare("SELECT id, name, medical_path, corporate_path, employee_id, created_at FROM gallery_items").all() as Array<{
      id: string
      name: string
      medical_path: string
      corporate_path: string
      employee_id: string | null
      created_at: number
    }>
    const ins = database.prepare(
      "INSERT INTO gallery_items_v4 (id, name, medical_path, corporate_path, employee_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    for (const r of rows) {
      ins.run(r.id, r.name, r.medical_path, r.corporate_path, r.employee_id, r.created_at)
    }
    database.exec(`
      DROP TABLE gallery_items;
      ALTER TABLE gallery_items_v4 RENAME TO gallery_items;
      CREATE INDEX IF NOT EXISTS idx_gallery_employee_id ON gallery_items(employee_id);
    `)
    database.prepare("UPDATE _schema_version SET version = 4").run()
  }

  if (version < 5) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS gallery_feedback_votes (
        id TEXT PRIMARY KEY,
        gallery_item_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        style TEXT NOT NULL,
        vote TEXT NOT NULL,
        fingerprint_hash TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        user_agent_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_unique_viewer
        ON gallery_feedback_votes(gallery_item_id, style, fingerprint_hash);
      CREATE INDEX IF NOT EXISTS idx_feedback_gallery_item_id
        ON gallery_feedback_votes(gallery_item_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_employee_id
        ON gallery_feedback_votes(employee_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_ip_hash
        ON gallery_feedback_votes(ip_hash);
      CREATE INDEX IF NOT EXISTS idx_feedback_created_at
        ON gallery_feedback_votes(created_at);
    `)
    database.prepare("UPDATE _schema_version SET version = 5").run()
  }

  if (version < 6) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS gallery_image_comments (
        id TEXT PRIMARY KEY,
        gallery_item_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        style TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        editor_fingerprint_hash TEXT NOT NULL,
        editor_ip_hash TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_image_comments_unique_style
        ON gallery_image_comments(gallery_item_id, style);
      CREATE INDEX IF NOT EXISTS idx_gallery_image_comments_employee_id
        ON gallery_image_comments(employee_id);
      CREATE INDEX IF NOT EXISTS idx_gallery_image_comments_updated_at
        ON gallery_image_comments(updated_at);
    `)
    database.prepare("UPDATE _schema_version SET version = 6").run()
  }

  if (version < 7) {
    database.exec(`
      CREATE TABLE gallery_feedback_votes_v7 (
        id TEXT PRIMARY KEY,
        gallery_item_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        style TEXT NOT NULL,
        vote TEXT NOT NULL,
        fingerprint_hash TEXT,
        ip_hash TEXT NOT NULL,
        user_agent_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)

    const groupedVotes = database.prepare(
      `SELECT
         gallery_item_id,
         employee_id,
         style,
         SUM(CASE WHEN vote = 'like' THEN 1 ELSE 0 END) AS likes,
         SUM(CASE WHEN vote = 'dislike' THEN 1 ELSE 0 END) AS dislikes
       FROM gallery_feedback_votes
       GROUP BY gallery_item_id, employee_id, style`
    ).all() as Array<{
      gallery_item_id: string
      employee_id: string
      style: string
      likes: number
      dislikes: number
    }>

    const selectLatestVoteRow = database.prepare(
      `SELECT
         id,
         gallery_item_id,
         employee_id,
         style,
         vote,
         fingerprint_hash,
         ip_hash,
         user_agent_hash,
         created_at,
         updated_at
       FROM gallery_feedback_votes
       WHERE gallery_item_id = ? AND style = ? AND vote = ?
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`
    )
    const insertSharedVote = database.prepare(
      `INSERT INTO gallery_feedback_votes_v7 (
         id,
         gallery_item_id,
         employee_id,
         style,
         vote,
         fingerprint_hash,
         ip_hash,
         user_agent_hash,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    for (const row of groupedVotes) {
      const hasLikes = row.likes > 0
      const hasDislikes = row.dislikes > 0
      if (hasLikes === hasDislikes) {
        continue
      }

      const finalVote = hasLikes ? "like" : "dislike"
      const latestVoteRow = selectLatestVoteRow.get(row.gallery_item_id, row.style, finalVote) as {
        id: string
        gallery_item_id: string
        employee_id: string
        style: string
        vote: string
        fingerprint_hash: string | null
        ip_hash: string
        user_agent_hash: string
        created_at: number
        updated_at: number
      } | undefined

      if (!latestVoteRow) {
        continue
      }

      insertSharedVote.run(
        latestVoteRow.id,
        latestVoteRow.gallery_item_id,
        latestVoteRow.employee_id,
        latestVoteRow.style,
        latestVoteRow.vote,
        latestVoteRow.fingerprint_hash,
        latestVoteRow.ip_hash,
        latestVoteRow.user_agent_hash,
        latestVoteRow.created_at,
        latestVoteRow.updated_at
      )
    }

    database.exec(`
      DROP TABLE gallery_feedback_votes;
      ALTER TABLE gallery_feedback_votes_v7 RENAME TO gallery_feedback_votes;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_unique_style
        ON gallery_feedback_votes(gallery_item_id, style);
      CREATE INDEX IF NOT EXISTS idx_feedback_gallery_item_id
        ON gallery_feedback_votes(gallery_item_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_employee_id
        ON gallery_feedback_votes(employee_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_updated_at
        ON gallery_feedback_votes(updated_at);
    `)
    database.prepare("UPDATE _schema_version SET version = 7").run()
  }
}

export function getUploadsDir(): string {
  ensureDataDir()
  return UPLOADS_DIR
}

export function getDataDir(): string {
  ensureDataDir()
  return DATA_DIR
}
