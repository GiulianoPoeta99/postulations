"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, X } from "lucide-react";
import type { Application, ApplicationStatus } from "@/lib/db";

export const statuses = ["pendiente", "aplicado", "rechazado", "entrevista"] as const satisfies readonly ApplicationStatus[];

export const statusLabels: Record<ApplicationStatus, string> = {
  pendiente: "Pendiente",
  aplicado: "Aplicado",
  rechazado: "Rechazado",
  entrevista: "Entrevista"
};

export function applicationTextPreview(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > 88 ? `${normalized.slice(0, 88)}...` : normalized;
}

export function markdownTextPreview(text: string) {
  const normalized = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(^|\n)\s{0,3}#{1,6}\s+/g, "$1")
    .replace(/(^|\n)\s{0,3}>\s?/g, "$1")
    .replace(/`{1,3}/g, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  return normalized.length > 88 ? `${normalized.slice(0, 88)}...` : normalized;
}

export function cvHref(application: Application) {
  return application.cvStoredName ? `/cv/${encodeURIComponent(application.cvStoredName)}` : "";
}

export function isApplicationStale(app: Application) {
  if (app.estado !== "aplicado") return false;
  const daysDiff = (Date.now() - new Date(app.updatedAt).getTime()) / (1000 * 3600 * 24);
  return daysDiff > 7;
}

export function runAction(
  action: (formData: FormData) => Promise<void>,
  setPending: (v: boolean) => void,
  setError: (e: string) => void,
  onDone?: () => void
) {
  return async (formData: FormData) => {
    setPending(true);
    setError("");
    try {
      await action(formData);
      onDone?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar la accion.");
    } finally {
      setPending(false);
    }
  };
}

export function MarkdownNote({ content }: { content: string }) {
  return (
    <div className="markdown-note">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export type ApplicationFieldsProps = {
  application?: Application;
  includeInitialNote?: boolean;
  cvVersions?: string[];
};

export function ApplicationFields({ application, includeInitialNote = false, cvVersions = [] }: ApplicationFieldsProps) {
  const [notaInicialText, setNotaInicialText] = useState("");

  return (
    <div className="modal-grid">
      <label className="field">
        <span>Empresa</span>
        <input
          name="nombreEmpresa"
          placeholder="Nombre empresa"
          required
          defaultValue={application?.nombreEmpresa ?? ""}
        />
      </label>

      <label className="field">
        <span>Título</span>
        <input
          name="titulo"
          placeholder="Ej: Backend Developer"
          defaultValue={application?.titulo ?? ""}
        />
      </label>

      <label className="field">
        <span>Link propuesta</span>
        <input
          name="linkPropuesta"
          type="url"
          placeholder="https://..."
          defaultValue={application?.linkPropuesta ?? ""}
        />
      </label>

      <label className="field">
        <span>Estado</span>
        <select name="estado" defaultValue={application?.estado ?? "aplicado"}>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="field span-2">
        <span>Texto postulacion</span>
        <textarea
          name="textoPostulacion"
          rows={8}
          placeholder="Pega aca el texto completo de la propuesta"
          defaultValue={application?.textoPostulacion ?? ""}
        />
      </label>

      {includeInitialNote ? (
        <div className="field span-2">
          <label className="field">
            <span>Nota inicial</span>
            <textarea
              name="notaInicial"
              rows={4}
              placeholder="Nota opcional (soporta Markdown)"
              value={notaInicialText}
              onChange={(e) => setNotaInicialText(e.target.value)}
            />
          </label>
          {notaInicialText.trim() && (
            <div className="note-live-preview-box">
              <div className="note-live-preview-title">Vista previa de la nota inicial</div>
              <MarkdownNote content={notaInicialText} />
            </div>
          )}
        </div>
      ) : null}

      <div className="field span-2 cv-selection-row">
        <label className="field" style={{ flex: 1 }}>
          <span>CV Generado</span>
          <select name="cvVersion" defaultValue={application?.cvVersion ?? ""}>
            <option value="">Ninguno</option>
            {cvVersions.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <span style={{ display: 'flex', alignItems: 'center', margin: '0 1rem', color: 'var(--gray)' }}>O</span>

        <label className="field" style={{ flex: 1 }}>
          <span>Subir CV manual</span>
          <input
            name="cvFile"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          />
        </label>
      </div>

      {application?.cvStoredName ? (
        <a className="file-chip span-2" href={cvHref(application)} target="_blank" rel="noopener noreferrer">
          <FileText size={16} aria-hidden="true" />
          {application.cvFilename ?? application.cvStoredName}
        </a>
      ) : null}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  giant = false
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  giant?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className={`modal-card ${wide ? "modal-card-wide" : ""} ${giant ? "modal-card-giant" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} title="Cerrar">
            <X size={17} aria-hidden="true" />
            <span className="sr-only">Cerrar</span>
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
