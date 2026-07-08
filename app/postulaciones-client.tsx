"use client";

import {
  ExternalLink,
  FileText,
  MessageSquareText,
  Pencil,
  Plus,
  Save,
  Trash2,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  createNota,
  createPostulacion,
  deleteNota,
  deletePostulacion,
  updateNota,
  updatePostulacion
} from "@/app/actions";
import type { Application, ApplicationStatus } from "@/lib/db";

const statuses = ["pendiente", "aplicado", "rechazado", "entrevista"] as const satisfies readonly ApplicationStatus[];

const statusLabels: Record<ApplicationStatus, string> = {
  pendiente: "Pendiente",
  aplicado: "Aplicado",
  rechazado: "Rechazado",
  entrevista: "Entrevista"
};

type ModalState =
  | { type: "create" }
  | { type: "edit"; applicationId: number }
  | { type: "delete"; applicationId: number }
  | { type: "notes"; applicationId: number }
  | null;

type PostulacionesClientProps = {
  applications: Application[];
};

type ApplicationFieldsProps = {
  application?: Application;
  includeInitialNote?: boolean;
};

function applicationTextPreview(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  return normalized.length > 88 ? `${normalized.slice(0, 88)}...` : normalized;
}

function markdownTextPreview(text: string) {
  const normalized = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(^|\n)\s{0,3}#{1,6}\s+/g, "$1")
    .replace(/(^|\n)\s{0,3}>\s?/g, "$1")
    .replace(/`{1,3}/g, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized.length > 88 ? `${normalized.slice(0, 88)}...` : normalized;
}

function cvHref(application: Application) {
  return application.cvStoredName ? `/cv/${encodeURIComponent(application.cvStoredName)}` : "";
}

function MarkdownNote({ content }: { content: string }) {
  return (
    <div className="markdown-note">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function ApplicationFields({ application, includeInitialNote = false }: ApplicationFieldsProps) {
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
        <label className="field span-2">
          <span>Nota inicial</span>
          <textarea name="notaInicial" rows={4} placeholder="Nota opcional" />
        </label>
      ) : null}

      <label className="field span-2">
        <span>CV usado</span>
        <input
          name="cvFile"
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />
      </label>

      {application?.cvStoredName ? (
        <a className="file-chip span-2" href={cvHref(application)}>
          <FileText size={16} aria-hidden="true" />
          {application.cvFilename}
        </a>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className={`modal-card ${wide ? "modal-card-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
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

export function PostulacionesClient({ applications }: PostulacionesClientProps) {
  const [modal, setModal] = useState<ModalState>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const activeApplication = useMemo(() => {
    if (!modal || modal.type === "create") {
      return null;
    }

    return applications.find((application) => application.id === modal.applicationId) ?? null;
  }, [applications, modal]);

  function closeModal() {
    setModal(null);
    setEditingNoteId(null);
    setError("");
  }

  function runAction(action: (formData: FormData) => Promise<void>, onDone?: () => void) {
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

  return (
    <main className="page-shell">
      <section className="workspace">
        <header className="app-header">
          <div>
            <p className="eyebrow">Postulaciones</p>
            <h1>Seguimiento</h1>
          </div>
          <div className="header-actions">
            <div className="counter" aria-label={`${applications.length} postulaciones`}>
              {applications.length}
            </div>
            <button className="primary-button" type="button" onClick={() => setModal({ type: "create" })}>
              <Plus size={16} aria-hidden="true" />
              Nueva
            </button>
          </div>
        </header>

        <div className="table-frame">
          <table>
            <thead>
              <tr>
                <th className="id-col">ID</th>
                <th>Empresa</th>
                <th>Propuesta</th>
                <th>Estado</th>
                <th>Notas</th>
                <th>CV</th>
                <th className="actions-col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={7}>
                    Sin postulaciones
                  </td>
                </tr>
              ) : (
                applications.map((application) => (
                  <tr key={application.id}>
                    <td className="id-cell">{application.id}</td>
                    <td>
                      <strong>{application.nombreEmpresa}</strong>
                    </td>
                    <td>
                      <div className="proposal-cell">
                        {application.linkPropuesta ? (
                          <a
                            className="inline-link"
                            href={application.linkPropuesta}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={14} aria-hidden="true" />
                            Link
                          </a>
                        ) : (
                          <span className="muted-text">Sin link</span>
                        )}
                        {application.textoPostulacion ? (
                          <p>{applicationTextPreview(application.textoPostulacion)}</p>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${application.estado}`}>{statusLabels[application.estado]}</span>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => {
                          setEditingNoteId(null);
                          setModal({ type: "notes", applicationId: application.id });
                        }}
                      >
                        <MessageSquareText size={15} aria-hidden="true" />
                        {application.noteCount}
                      </button>
                      {application.latestNote ? <p className="note-preview">{markdownTextPreview(application.latestNote)}</p> : null}
                    </td>
                    <td>
                      {application.cvStoredName ? (
                        <a className="inline-link" href={cvHref(application)}>
                          <FileText size={14} aria-hidden="true" />
                          CV
                        </a>
                      ) : (
                        <span className="muted-text">Sin CV</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => setModal({ type: "edit", applicationId: application.id })}
                          title="Editar"
                        >
                          <Pencil size={16} aria-hidden="true" />
                          <span className="sr-only">Editar</span>
                        </button>
                        <button
                          className="icon-button danger"
                          type="button"
                          onClick={() => setModal({ type: "delete", applicationId: application.id })}
                          title="Eliminar"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          <span className="sr-only">Eliminar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal?.type === "create" ? (
        <Modal title="Nueva postulacion" onClose={closeModal}>
          <form action={runAction(createPostulacion, closeModal)} className="modal-body">
            <ApplicationFields includeInitialNote />
            {error ? <p className="form-error">{error}</p> : null}
            <footer className="modal-footer">
              <button className="secondary-button" type="button" onClick={closeModal}>
                Cancelar
              </button>
              <button className="primary-button" type="submit" disabled={pending}>
                <Plus size={16} aria-hidden="true" />
                Crear
              </button>
            </footer>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "edit" && activeApplication ? (
        <Modal title="Editar postulacion" onClose={closeModal}>
          <form
            action={runAction(updatePostulacion.bind(null, activeApplication.id), closeModal)}
            className="modal-body"
            key={activeApplication.id}
          >
            <ApplicationFields application={activeApplication} />
            {error ? <p className="form-error">{error}</p> : null}
            <footer className="modal-footer">
              <button className="secondary-button" type="button" onClick={closeModal}>
                Cancelar
              </button>
              <button className="primary-button" type="submit" disabled={pending}>
                <Save size={16} aria-hidden="true" />
                Guardar
              </button>
            </footer>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "delete" && activeApplication ? (
        <Modal title="Confirmar eliminacion" onClose={closeModal}>
          <form
            action={runAction(async () => deletePostulacion(activeApplication.id), closeModal)}
            className="modal-body"
          >
            <p className="confirm-copy">
              La postulacion de <strong>{activeApplication.nombreEmpresa}</strong> se va a ocultar.
            </p>
            {error ? <p className="form-error">{error}</p> : null}
            <footer className="modal-footer">
              <button className="secondary-button" type="button" onClick={closeModal}>
                Cancelar
              </button>
              <button className="danger-button" type="submit" disabled={pending}>
                <Trash2 size={16} aria-hidden="true" />
                Eliminar
              </button>
            </footer>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "notes" && activeApplication ? (
        <Modal title={`Notas: ${activeApplication.nombreEmpresa}`} onClose={closeModal} wide>
          <div className="modal-body notes-modal-body">
            <section className="notes-main">
              <header className="notes-toolbar">
                <div>
                  <strong>{activeApplication.noteCount}</strong>
                  <span>{activeApplication.noteCount === 1 ? " nota" : " notas"}</span>
                </div>
                {editingNoteId ? (
                  <button className="secondary-button compact-button" type="button" onClick={() => setEditingNoteId(null)}>
                    Ver preview
                  </button>
                ) : null}
              </header>

              <div className="notes-list">
                {activeApplication.notes.length === 0 ? (
                  <p className="empty-notes">Sin notas</p>
                ) : (
                  activeApplication.notes.map((note) => {
                    const isEditing = editingNoteId === note.id;

                    if (isEditing) {
                      return (
                        <form
                          action={runAction(updateNota.bind(null, note.id), () => setEditingNoteId(null))}
                          className="note-item note-item-editing"
                          key={note.id}
                        >
                          <div className="note-item-header">
                            <span>{note.createdAt}</span>
                            <div className="row-actions">
                              <button className="secondary-button compact-button" type="button" onClick={() => setEditingNoteId(null)}>
                                Cancelar
                              </button>
                              <button className="primary-button compact-button" type="submit" disabled={pending}>
                                <Save size={15} aria-hidden="true" />
                                Guardar
                              </button>
                            </div>
                          </div>
                          <textarea name="content" rows={12} defaultValue={note.content} required />
                        </form>
                      );
                    }

                    return (
                      <article className="note-item" key={note.id}>
                        <div className="note-item-header">
                          <span>{note.createdAt}</span>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              type="button"
                              onClick={() => setEditingNoteId(note.id)}
                              title="Editar nota"
                            >
                              <Pencil size={16} aria-hidden="true" />
                              <span className="sr-only">Editar nota</span>
                            </button>
                            <form action={runAction(async () => deleteNota(note.id))}>
                              <button className="icon-button danger" type="submit" disabled={pending} title="Eliminar nota">
                                <Trash2 size={16} aria-hidden="true" />
                                <span className="sr-only">Eliminar nota</span>
                              </button>
                            </form>
                          </div>
                        </div>
                        <MarkdownNote content={note.content} />
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            <aside className="notes-compose">
              <form
                action={runAction(createNota.bind(null, activeApplication.id))}
                className="note-create"
                key={`create-note-${activeApplication.id}-${activeApplication.noteCount}`}
              >
                <label className="field">
                  <span>Nueva nota</span>
                  <textarea name="content" rows={10} placeholder="Escribe Markdown" required />
                </label>
                <button className="primary-button" type="submit" disabled={pending}>
                  <Plus size={16} aria-hidden="true" />
                  Agregar
                </button>
              </form>
            </aside>

            {error ? <p className="form-error notes-error">{error}</p> : null}
            <footer className="modal-footer notes-footer">
              <button className="secondary-button" type="button" onClick={closeModal}>
                Cerrar
              </button>
            </footer>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
