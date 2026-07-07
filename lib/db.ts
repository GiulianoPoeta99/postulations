import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const applicationStatuses = ["aplicado", "rechazado", "entrevista"] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];

export type Application = {
  id: number;
  nombreEmpresa: string;
  linkPropuesta: string;
  estado: ApplicationStatus;
  notas: string;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationInput = {
  nombreEmpresa: string;
  linkPropuesta: string;
  estado: ApplicationStatus;
  notas: string;
};

type ApplicationRow = {
  id: number;
  nombre_empresa: string;
  link_propuesta: string;
  estado: ApplicationStatus;
  notas: string;
  created_at: string;
  updated_at: string;
};

declare global {
  // eslint-disable-next-line no-var
  var postulacionesDb: Database.Database | undefined;
}

function openDatabase() {
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = process.env.DATABASE_PATH ?? path.join(dataDir, "postulaciones.sqlite");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS postulaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_empresa TEXT NOT NULL,
      link_propuesta TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL CHECK (estado IN ('aplicado', 'rechazado', 'entrevista')) DEFAULT 'aplicado',
      notas TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS postulaciones_updated_at
    AFTER UPDATE ON postulaciones
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE postulaciones SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
  `);

  return db;
}

const db = globalThis.postulacionesDb ?? openDatabase();

if (process.env.NODE_ENV !== "production") {
  globalThis.postulacionesDb = db;
}

function mapApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    nombreEmpresa: row.nombre_empresa,
    linkPropuesta: row.link_propuesta,
    estado: row.estado,
    notas: row.notas,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return applicationStatuses.includes(value as ApplicationStatus);
}

export function listApplications(): Application[] {
  return db
    .prepare(
      `
      SELECT id, nombre_empresa, link_propuesta, estado, notas, created_at, updated_at
      FROM postulaciones
      ORDER BY id DESC
    `
    )
    .all()
    .map((row) => mapApplication(row as ApplicationRow));
}

export function createApplication(input: ApplicationInput): void {
  db.prepare(
    `
      INSERT INTO postulaciones (nombre_empresa, link_propuesta, estado, notas)
      VALUES (@nombreEmpresa, @linkPropuesta, @estado, @notas)
    `
  ).run(input);
}

export function updateApplication(id: number, input: ApplicationInput): void {
  db.prepare(
    `
      UPDATE postulaciones
      SET nombre_empresa = @nombreEmpresa,
          link_propuesta = @linkPropuesta,
          estado = @estado,
          notas = @notas
      WHERE id = @id
    `
  ).run({ id, ...input });
}

export function deleteApplication(id: number): void {
  db.prepare("DELETE FROM postulaciones WHERE id = ?").run(id);
}
