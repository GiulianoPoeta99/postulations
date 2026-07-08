import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const applicationStatuses = ["pendiente", "aplicado", "rechazado", "entrevista"] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];

export type ApplicationNote = {
  id: number;
  postulacionId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type Application = {
  id: number;
  nombreEmpresa: string;
  linkPropuesta: string;
  estado: ApplicationStatus;
  textoPostulacion: string;
  cvFilename: string;
  cvStoredName: string;
  noteCount: number;
  latestNote: string;
  notes: ApplicationNote[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ApplicationInput = {
  nombreEmpresa: string;
  linkPropuesta: string;
  estado: ApplicationStatus;
  textoPostulacion: string;
};

export type CvInput = {
  cvFilename: string;
  cvStoredName: string;
};

type ApplicationRow = {
  id: number;
  nombre_empresa: string;
  link_propuesta: string;
  estado: ApplicationStatus;
  texto_postulacion: string;
  cv_filename: string;
  cv_stored_name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type ApplicationNoteRow = {
  id: number;
  postulacion_id: number;
  content: string;
  created_at: string;
  updated_at: string;
};

type CvFileRow = {
  cv_filename: string;
  cv_stored_name: string;
};

declare global {
  // eslint-disable-next-line no-var
  var postulacionesDb: Database.Database | undefined;
}

const dataDir = path.join(process.cwd(), "data");
const cvDir = path.join(dataDir, "cvs");
const applicationStatusCheck = "'pendiente', 'aplicado', 'rechazado', 'entrevista'";

function openDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = process.env.DATABASE_PATH ?? path.join(dataDir, "postulaciones.sqlite");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return db;
}

function hasColumn(database: Database.Database, table: string, column: string) {
  return database
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((row) => (row as { name: string }).name === column);
}

function addColumnIfMissing(database: Database.Database, table: string, column: string, definition: string) {
  if (!hasColumn(database, table, column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function ensureApplicationStatusConstraint(database: Database.Database) {
  const table = database
    .prepare(
      `
      SELECT sql
      FROM sqlite_master
      WHERE type = 'table'
        AND name = 'postulaciones'
    `
    )
    .get() as { sql: string } | undefined;

  if (!table || table.sql.includes("'pendiente'")) {
    return;
  }

  database.pragma("foreign_keys = OFF");

  const rebuild = database.transaction(() => {
    database.exec(`
      DROP TRIGGER IF EXISTS postulaciones_updated_at;

      CREATE TABLE postulaciones_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_empresa TEXT NOT NULL,
        link_propuesta TEXT NOT NULL DEFAULT '',
        estado TEXT NOT NULL CHECK (estado IN (${applicationStatusCheck})) DEFAULT 'aplicado',
        notas TEXT NOT NULL DEFAULT '',
        texto_postulacion TEXT NOT NULL DEFAULT '',
        cv_filename TEXT NOT NULL DEFAULT '',
        cv_stored_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT DEFAULT NULL
      );

      INSERT INTO postulaciones_new (
        id,
        nombre_empresa,
        link_propuesta,
        estado,
        notas,
        texto_postulacion,
        cv_filename,
        cv_stored_name,
        created_at,
        updated_at,
        deleted_at
      )
      SELECT
        id,
        nombre_empresa,
        link_propuesta,
        CASE
          WHEN estado IN (${applicationStatusCheck}) THEN estado
          ELSE 'aplicado'
        END,
        notas,
        texto_postulacion,
        cv_filename,
        cv_stored_name,
        created_at,
        updated_at,
        deleted_at
      FROM postulaciones;

      DROP TABLE postulaciones;
      ALTER TABLE postulaciones_new RENAME TO postulaciones;

      DELETE FROM sqlite_sequence WHERE name = 'postulaciones';
      INSERT INTO sqlite_sequence (name, seq)
      SELECT 'postulaciones', COALESCE(MAX(id), 0)
      FROM postulaciones;
    `);
  });

  try {
    rebuild();
  } finally {
    database.pragma("foreign_keys = ON");
  }
}

function migrateDatabase(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS postulaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_empresa TEXT NOT NULL,
      link_propuesta TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL CHECK (estado IN (${applicationStatusCheck})) DEFAULT 'aplicado',
      notas TEXT NOT NULL DEFAULT '',
      texto_postulacion TEXT NOT NULL DEFAULT '',
      cv_filename TEXT NOT NULL DEFAULT '',
      cv_stored_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT DEFAULT NULL
    );
  `);

  addColumnIfMissing(database, "postulaciones", "notas", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(database, "postulaciones", "texto_postulacion", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(database, "postulaciones", "cv_filename", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(database, "postulaciones", "cv_stored_name", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(database, "postulaciones", "deleted_at", "TEXT DEFAULT NULL");
  ensureApplicationStatusConstraint(database);

  database.exec(`
    CREATE TABLE IF NOT EXISTS application_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postulacion_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT DEFAULT NULL,
      FOREIGN KEY (postulacion_id) REFERENCES postulaciones(id) ON DELETE CASCADE
    );

    CREATE TRIGGER IF NOT EXISTS postulaciones_updated_at
    AFTER UPDATE ON postulaciones
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE postulaciones SET updated_at = datetime('now') WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS application_notes_updated_at
    AFTER UPDATE ON application_notes
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE application_notes SET updated_at = datetime('now') WHERE id = OLD.id;
    END;

    INSERT INTO application_notes (postulacion_id, content)
    SELECT p.id, p.notas
    FROM postulaciones p
    WHERE trim(COALESCE(p.notas, '')) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM application_notes n
        WHERE n.postulacion_id = p.id
      );
  `);
}

const db = globalThis.postulacionesDb ?? openDatabase();
migrateDatabase(db);

if (process.env.NODE_ENV !== "production") {
  globalThis.postulacionesDb = db;
}

function mapNote(row: ApplicationNoteRow): ApplicationNote {
  return {
    id: row.id,
    postulacionId: row.postulacion_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapApplication(row: ApplicationRow, notes: ApplicationNote[]): Application {
  return {
    id: row.id,
    nombreEmpresa: row.nombre_empresa,
    linkPropuesta: row.link_propuesta,
    estado: row.estado,
    textoPostulacion: row.texto_postulacion,
    cvFilename: row.cv_filename,
    cvStoredName: row.cv_stored_name,
    noteCount: notes.length,
    latestNote: notes[0]?.content ?? "",
    notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

export function getCvStorageDir() {
  fs.mkdirSync(cvDir, { recursive: true });
  return cvDir;
}

export function getCvFilePath(storedName: string) {
  return path.join(getCvStorageDir(), path.basename(storedName));
}

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return applicationStatuses.includes(value as ApplicationStatus);
}

export function listApplications(): Application[] {
  const rows = db
    .prepare(
      `
      SELECT
        id,
        nombre_empresa,
        link_propuesta,
        estado,
        texto_postulacion,
        cv_filename,
        cv_stored_name,
        created_at,
        updated_at,
        deleted_at
      FROM postulaciones
      WHERE deleted_at IS NULL
      ORDER BY id DESC
    `
    )
    .all() as ApplicationRow[];

  const noteRows = db
    .prepare(
      `
      SELECT n.id, n.postulacion_id, n.content, n.created_at, n.updated_at
      FROM application_notes n
      INNER JOIN postulaciones p ON p.id = n.postulacion_id
      WHERE n.deleted_at IS NULL
        AND p.deleted_at IS NULL
      ORDER BY n.created_at DESC, n.id DESC
    `
    )
    .all() as ApplicationNoteRow[];

  const notesByApplication = new Map<number, ApplicationNote[]>();
  for (const row of noteRows) {
    const notes = notesByApplication.get(row.postulacion_id) ?? [];
    notes.push(mapNote(row));
    notesByApplication.set(row.postulacion_id, notes);
  }

  return rows.map((row) => mapApplication(row, notesByApplication.get(row.id) ?? []));
}

export function createApplication(input: ApplicationInput, cv?: CvInput | null): number {
  const result = db
    .prepare(
      `
      INSERT INTO postulaciones (
        nombre_empresa,
        link_propuesta,
        estado,
        texto_postulacion,
        cv_filename,
        cv_stored_name
      )
      VALUES (
        @nombreEmpresa,
        @linkPropuesta,
        @estado,
        @textoPostulacion,
        @cvFilename,
        @cvStoredName
      )
    `
    )
    .run({
      ...input,
      cvFilename: cv?.cvFilename ?? "",
      cvStoredName: cv?.cvStoredName ?? ""
    });

  return Number(result.lastInsertRowid);
}

export function updateApplication(id: number, input: ApplicationInput, cv?: CvInput | null): void {
  db.prepare(
    `
      UPDATE postulaciones
      SET nombre_empresa = @nombreEmpresa,
          link_propuesta = @linkPropuesta,
          estado = @estado,
          texto_postulacion = @textoPostulacion,
          cv_filename = CASE WHEN @cvFilename <> '' THEN @cvFilename ELSE cv_filename END,
          cv_stored_name = CASE WHEN @cvStoredName <> '' THEN @cvStoredName ELSE cv_stored_name END
      WHERE id = @id
        AND deleted_at IS NULL
    `
  ).run({
    id,
    ...input,
    cvFilename: cv?.cvFilename ?? "",
    cvStoredName: cv?.cvStoredName ?? ""
  });
}

export function softDeleteApplication(id: number): void {
  db.prepare(
    `
      UPDATE postulaciones
      SET deleted_at = datetime('now')
      WHERE id = ?
        AND deleted_at IS NULL
    `
  ).run(id);
}

export function createApplicationNote(postulacionId: number, content: string): void {
  db.prepare(
    `
      INSERT INTO application_notes (postulacion_id, content)
      SELECT @postulacionId, @content
      WHERE EXISTS (
        SELECT 1
        FROM postulaciones
        WHERE id = @postulacionId
          AND deleted_at IS NULL
      )
    `
  ).run({ postulacionId, content });
}

export function updateApplicationNote(id: number, content: string): void {
  db.prepare(
    `
      UPDATE application_notes
      SET content = @content
      WHERE id = @id
        AND deleted_at IS NULL
    `
  ).run({ id, content });
}

export function softDeleteApplicationNote(id: number): void {
  db.prepare(
    `
      UPDATE application_notes
      SET deleted_at = datetime('now')
      WHERE id = ?
        AND deleted_at IS NULL
    `
  ).run(id);
}

export function getCvFile(storedName: string): CvInput | null {
  const row = db
    .prepare(
      `
      SELECT cv_filename, cv_stored_name
      FROM postulaciones
      WHERE cv_stored_name = ?
        AND deleted_at IS NULL
      LIMIT 1
    `
    )
    .get(path.basename(storedName)) as CvFileRow | undefined;

  if (!row) {
    return null;
  }

  return {
    cvFilename: row.cv_filename,
    cvStoredName: row.cv_stored_name
  };
}
