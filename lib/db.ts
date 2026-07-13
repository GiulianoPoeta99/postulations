import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const applicationStatuses = ["pendiente", "aplicado", "rechazado", "entrevista"] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];

export type ApplicationNote = {
  id: number;
  postulacionId: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Application = {
  id: number;
  titulo: string;
  nombreEmpresa: string;
  linkPropuesta: string;
  estado: ApplicationStatus;
  textoPostulacion: string;
  cvFilename: string;
  cvStoredName: string;
  cvVersion: string;
  notas: string;
  noteCount: number;
  latestNote: string;
  notes: ApplicationNote[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ApplicationInput = {
  titulo: string;
  nombreEmpresa: string;
  linkPropuesta: string;
  estado: ApplicationStatus;
  textoPostulacion: string;
};

export type CvInput = {
  cvFilename: string;
  cvStoredName: string;
  cvVersion: string;
};

type ApplicationRow = {
  id: number;
  titulo: string;
  nombre_empresa: string;
  link_propuesta: string;
  estado: ApplicationStatus;
  texto_postulacion: string;
  cv_filename: string;
  cv_stored_name: string;
  cv_version: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  note_count: number;
  latest_note: string;
  notes_json: string;
};

type ApplicationNoteRow = {
  id: number;
  postulacion_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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

/* v8 ignore start */
function addColumnIfMissing(database: Database.Database, table: string, column: string, definition: string) {
  if (!hasColumn(database, table, column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
/* v8 ignore stop */

/* v8 ignore start */
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
        titulo TEXT NOT NULL DEFAULT '',
        nombre_empresa TEXT NOT NULL,
        link_propuesta TEXT NOT NULL DEFAULT '',
        estado TEXT NOT NULL CHECK (estado IN (${applicationStatusCheck})) DEFAULT 'aplicado',
        notas TEXT NOT NULL DEFAULT '',
        texto_postulacion TEXT NOT NULL DEFAULT '',
        cv_filename TEXT NOT NULL DEFAULT '',
        cv_stored_name TEXT NOT NULL DEFAULT '',
        cv_version TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT DEFAULT NULL
      );

      INSERT INTO postulaciones_new (
        id,
        titulo,
        nombre_empresa,
        link_propuesta,
        estado,
        notas,
        texto_postulacion,
        cv_filename,
        cv_stored_name,
        cv_version,
        created_at,
        updated_at,
        deleted_at
      )
      SELECT
        id,
        titulo,
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
        cv_version,
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
/* v8 ignore stop */

function migrateDatabase(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS postulaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL DEFAULT '',
      nombre_empresa TEXT NOT NULL,
      link_propuesta TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL CHECK (estado IN (${applicationStatusCheck})) DEFAULT 'aplicado',
      notas TEXT NOT NULL DEFAULT '',
      texto_postulacion TEXT NOT NULL DEFAULT '',
      cv_filename TEXT NOT NULL DEFAULT '',
      cv_stored_name TEXT NOT NULL DEFAULT '',
      cv_version TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT DEFAULT NULL
    );
  `);

  addColumnIfMissing(database, "postulaciones", "titulo", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(database, "postulaciones", "notas", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(database, "postulaciones", "texto_postulacion", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(database, "postulaciones", "cv_filename", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(database, "postulaciones", "cv_stored_name", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(database, "postulaciones", "cv_version", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(database, "postulaciones", "deleted_at", "TEXT DEFAULT NULL");
  ensureApplicationStatusConstraint(database);

  database.exec(`
    CREATE TABLE IF NOT EXISTS application_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postulacion_id INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT DEFAULT NULL,
      FOREIGN KEY (postulacion_id) REFERENCES postulaciones(id) ON DELETE CASCADE
    );

    CREATE TRIGGER IF NOT EXISTS application_notes_updated_at
    AFTER UPDATE ON application_notes
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE application_notes SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
  `);
  
  addColumnIfMissing(database, "application_notes", "title", "TEXT NOT NULL DEFAULT ''");

  // Migration: move combined notes back to application_notes if it doesn't have any
  database.exec(`
    INSERT INTO application_notes (postulacion_id, title, content)
    SELECT id, 'Nota Histórica', notas
    FROM postulaciones p
    WHERE p.notas != '' 
      AND NOT EXISTS (SELECT 1 FROM application_notes an WHERE an.postulacion_id = p.id)
  `);
}

const db = globalThis.postulacionesDb ?? openDatabase();
migrateDatabase(db);

if (process.env.NODE_ENV !== "production") {
  globalThis.postulacionesDb = db;
}

function mapApplication(row: ApplicationRow): Application {
  let parsedNotes: ApplicationNote[] = [];
  if (row.notes_json) {
    try {
      const notesArray = JSON.parse(row.notes_json);
      parsedNotes = notesArray.map((n: any) => ({
        id: n.id,
        postulacionId: n.postulacion_id,
        title: n.title,
        content: n.content,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
        deletedAt: n.deleted_at
      }));
    } catch {
      // Return empty array if JSON is somehow invalid
    }
  }

  return {
    id: row.id,
    titulo: row.titulo,
    nombreEmpresa: row.nombre_empresa,
    linkPropuesta: row.link_propuesta,
    estado: row.estado,
    textoPostulacion: row.texto_postulacion,
    cvFilename: row.cv_filename,
    cvStoredName: row.cv_stored_name,
    cvVersion: row.cv_version,
    notas: row.notas ?? "",
    noteCount: row.note_count ?? 0,
    latestNote: row.latest_note ?? "",
    notes: parsedNotes,
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
        p.id,
        p.titulo,
        p.nombre_empresa,
        p.link_propuesta,
        p.estado,
        p.texto_postulacion,
        p.cv_filename,
        p.cv_stored_name,
        p.cv_version,
        p.notas,
        p.created_at,
        p.updated_at,
        p.deleted_at,
        COUNT(n.id) as note_count,
        COALESCE(
          (SELECT content 
           FROM application_notes 
           WHERE postulacion_id = p.id AND deleted_at IS NULL 
           ORDER BY updated_at DESC LIMIT 1), 
          ''
        ) as latest_note,
        COALESCE(
          (SELECT json_group_array(
             json_object(
               'id', id,
               'postulacion_id', postulacion_id,
               'title', title,
               'content', content,
               'created_at', created_at,
               'updated_at', updated_at,
               'deleted_at', deleted_at
             )
           ) 
           FROM (
             SELECT * FROM application_notes 
             WHERE postulacion_id = p.id AND deleted_at IS NULL 
             ORDER BY updated_at DESC
           )),
          '[]'
        ) as notes_json
      FROM postulaciones p
      LEFT JOIN application_notes n ON p.id = n.postulacion_id AND n.deleted_at IS NULL
      WHERE p.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY p.id DESC
    `
    )
    .all() as ApplicationRow[];

  return rows.map((row) => mapApplication(row));
}

export function createApplication(input: ApplicationInput, cv?: CvInput | null): number {
  const result = db
    .prepare(
      `
      INSERT INTO postulaciones (
        titulo,
        nombre_empresa,
        link_propuesta,
        estado,
        texto_postulacion,
        cv_filename,
        cv_stored_name,
        cv_version
      )
      VALUES (
        @titulo,
        @nombreEmpresa,
        @linkPropuesta,
        @estado,
        @textoPostulacion,
        @cvFilename,
        @cvStoredName,
        @cvVersion
      )
    `
    )
    .run({
      ...input,
      cvFilename: cv?.cvFilename ?? "",
      cvStoredName: cv?.cvStoredName ?? "",
      cvVersion: cv?.cvVersion ?? ""
    });

  return Number(result.lastInsertRowid);
}

export function updateApplication(id: number, input: ApplicationInput, cv?: CvInput | null): void {
  db.prepare(
    `
      UPDATE postulaciones
      SET titulo = @titulo,
          nombre_empresa = @nombreEmpresa,
          link_propuesta = @linkPropuesta,
          estado = @estado,
          texto_postulacion = @textoPostulacion,
          cv_filename = CASE WHEN @cvFilename <> '' THEN @cvFilename ELSE cv_filename END,
          cv_stored_name = CASE WHEN @cvStoredName <> '' THEN @cvStoredName ELSE cv_stored_name END,
          cv_version = CASE WHEN @cvVersion IS NOT NULL THEN @cvVersion ELSE cv_version END
      WHERE id = @id
        AND deleted_at IS NULL
    `
  ).run({
    id,
    ...input,
    cvFilename: cv?.cvFilename ?? "",
    cvStoredName: cv?.cvStoredName ?? "",
    cvVersion: cv?.cvVersion ?? ""
  });
}

export function updateApplicationStatus(id: number, status: ApplicationStatus): void {
  db.prepare(
    `
      UPDATE postulaciones
      SET estado = @status
      WHERE id = @id
        AND deleted_at IS NULL
    `
  ).run({ id, status });
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

export function createApplicationNote(postulacionId: number, title: string, content: string): void {
  db.prepare(
    `
      INSERT INTO application_notes (postulacion_id, title, content)
      SELECT @postulacionId, @title, @content
      WHERE EXISTS (
        SELECT 1 FROM postulaciones
        WHERE id = @postulacionId AND deleted_at IS NULL
      )
    `
  ).run({ postulacionId, title, content });
}

export function updateApplicationNote(id: number, title: string, content: string): void {
  db.prepare(
    `
      UPDATE application_notes
      SET title = @title, content = @content
      WHERE id = @id
        AND deleted_at IS NULL
    `
  ).run({ id, title, content });
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
