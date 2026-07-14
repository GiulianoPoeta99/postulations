"use client";

import { useMemo, useState, useEffect } from "react";
import { AlertCircle, ExternalLink, Eye, FileText, MessageSquareText, Pencil, Save, Trash2, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { wrappedLineIndent } from "codemirror-wrapped-line-indent";
import { EditorView } from '@codemirror/view';

import {
  deletePostulacion,
  updatePostulacion,
  createNota,
  updateNota,
  deleteNota,
  updateStatusAction,
  listCvVersions
} from "@/app/actions";
import type { Application, ApplicationStatus } from "@/lib/db";
import {
  ApplicationFields,
  Modal,
  applicationTextPreview,
  cvHref,
  isApplicationStale,
  markdownTextPreview,
  runAction,
  statusLabels,
  statuses
} from "../components/Shared";

type ModalState =
  | { type: "edit"; applicationId: number }
  | { type: "delete"; applicationId: number }
  | { type: "notes"; applicationId: number }
  | { type: "previewCv"; applicationId: number }
  | { type: "view"; applicationId: number }
  | null;

export function PostulacionesClientView({ applications }: { applications: Application[] }) {
  const [modal, setModal] = useState<ModalState>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "todos">("todos");
  const [cvVersions, setCvVersions] = useState<string[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<number | "new" | null>(null);
  const [noteEditingTitle, setNoteEditingTitle] = useState("");
  const [noteEditingContent, setNoteEditingContent] = useState("");
  const [draggedAppId, setDraggedAppId] = useState<number | null>(null);

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    setTheme(saved === "dark" ? "dark" : "light");

    // Listen to theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "data-theme") {
          const newTheme = document.documentElement.getAttribute("data-theme") as "light" | "dark";
          setTheme(newTheme);
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    
    // Load CV versions for editing
    listCvVersions().then(setCvVersions);

    return () => observer.disconnect();
  }, []);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const q = searchText.toLowerCase();
      const matchesSearch = !q ||
        app.nombreEmpresa.toLowerCase().includes(q) ||
        app.textoPostulacion.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "todos" || app.estado === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [applications, searchText, statusFilter]);

  const activeApplication = useMemo(() => {
    if (!modal) return null;
    return applications.find((a) => a.id === modal.applicationId) ?? null;
  }, [applications, modal]);

  function openModal(state: ModalState) {
    setModal(state);
    setError("");
  }

  function closeModal() {
    setModal(null);
    setActiveNoteId(null);
    setError("");
  }

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedAppId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: ApplicationStatus) => {
    e.preventDefault();
    if (!draggedAppId) return;

    const app = applications.find(a => a.id === draggedAppId);
    if (app && app.estado !== targetStatus) {
      setPending(true);
      try {
        await updateStatusAction(draggedAppId, targetStatus);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Error updating status.");
      } finally {
        setPending(false);
      }
    }
    setDraggedAppId(null);
  };

  return (
    <>
      <div className="filter-bar">
        <div className="search-wrapper">
          <input
            className="search-input"
            type="search"
            placeholder="Buscar por empresa o texto..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <button
            className={`filter-btn${statusFilter === "todos" ? " active" : ""}`}
            type="button"
            onClick={() => setStatusFilter("todos")}
          >
            Todos
          </button>
          {statuses.map((status) => (
            <button
              key={status}
              className={`filter-btn${statusFilter === status ? " active" : ""}`}
              type="button"
              onClick={() => setStatusFilter(status)}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>

        <div className="view-toggle">
          <button
            className={viewMode === "list" ? "active" : ""}
            onClick={() => setViewMode("list")}
            title="Vista de lista"
          >
            Lista
          </button>
          <button
            className={viewMode === "kanban" ? "active" : ""}
            onClick={() => setViewMode("kanban")}
            title="Tablero Kanban"
          >
            Kanban
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
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
              {filteredApplications.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={7}>
                    {applications.length === 0 ? "Sin postulaciones" : "Sin resultados para la búsqueda"}
                  </td>
                </tr>
              ) : (
                filteredApplications.map((application) => (
                  <tr key={application.id}>
                    <td className="id-cell">{application.id}</td>
                    <td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                        <strong>{application.nombreEmpresa}</strong>
                        {application.titulo && <span style={{ color: "var(--muted)", fontSize: "0.9em" }}>- {application.titulo}</span>}
                        {isApplicationStale(application) && (
                          <span className="stale-badge" title="Acción requerida: Han pasado más de 7 días sin novedades.">
                            <AlertCircle size={14} />
                          </span>
                        )}
                      </div>
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
                      <span className={`status-pill ${application.estado}`}>
                        {statusLabels[application.estado]}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => {
                          if (application.notes && application.notes.length > 0) {
                            setActiveNoteId(application.notes[0].id);
                            setNoteEditingTitle(application.notes[0].title);
                            setNoteEditingContent(application.notes[0].content);
                          } else {
                            setActiveNoteId("new");
                            setNoteEditingTitle("Nueva Nota");
                            setNoteEditingContent("");
                          }
                          openModal({ type: "notes", applicationId: application.id });
                        }}
                      >
                        <MessageSquareText size={15} aria-hidden="true" />
                        {application.noteCount > 0 ? "Ver notas" : "Agregar notas"}
                      </button>
                      {application.latestNote ? (
                        <p className="note-preview">{markdownTextPreview(application.latestNote)}</p>
                      ) : null}
                    </td>
                    <td>
                      {(application.cvStoredName || application.cvVersion) ? (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => openModal({ type: "previewCv", applicationId: application.id })}
                        >
                          <FileText size={15} aria-hidden="true" />
                          Ver CV
                        </button>
                      ) : (
                        <span className="muted-text">Sin CV</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => openModal({ type: "view", applicationId: application.id })}
                          title="Ver detalle"
                        >
                          <Eye size={16} aria-hidden="true" />
                          <span className="sr-only">Ver detalle</span>
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => openModal({ type: "edit", applicationId: application.id })}
                          title="Editar"
                        >
                          <Pencil size={16} aria-hidden="true" />
                          <span className="sr-only">Editar</span>
                        </button>
                        <button
                          className="icon-button danger"
                          type="button"
                          onClick={() => openModal({ type: "delete", applicationId: application.id })}
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
      ) : (
        <div className="kanban-board">
          {statuses.filter(s => statusFilter === "todos" || statusFilter === s).map((status) => {
            const columnApps = filteredApplications.filter((app) => app.estado === status);
            return (
              <div
                key={status}
                className="kanban-column"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div className="kanban-column-header">
                  {statusLabels[status]}
                  <span className="badge">{columnApps.length}</span>
                </div>
                <div className="kanban-cards">
                  {columnApps.map((application) => (
                    <div
                      key={application.id}
                      className={`kanban-card ${draggedAppId === application.id ? 'dragging' : ''} ${isApplicationStale(application) ? 'stale' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, application.id)}
                      onDragEnd={() => setDraggedAppId(null)}
                    >
                      <div className="kanban-card-title">
                        {application.nombreEmpresa}
                        {application.titulo && <div style={{ fontSize: "0.85em", color: "var(--muted)", fontWeight: "normal", marginTop: 2 }}>{application.titulo}</div>}
                        {isApplicationStale(application) && (
                          <span className="stale-badge" title="Acción requerida: Han pasado más de 7 días sin novedades.">
                            <AlertCircle size={14} />
                          </span>
                        )}
                      </div>
                      {application.textoPostulacion ? (
                        <div className="kanban-card-desc">{applicationTextPreview(application.textoPostulacion)}</div>
                      ) : null}

                      <div className="kanban-card-footer">
                        <span className="kanban-date">
                          {new Date(application.createdAt).toLocaleDateString()}
                        </span>
                        <div className="kanban-card-actions">
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => openModal({ type: "view", applicationId: application.id })}
                            title="Ver detalle"
                          >
                            <Eye size={14} aria-hidden="true" />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => {
                              if (application.notes && application.notes.length > 0) {
                                setActiveNoteId(application.notes[0].id);
                                setNoteEditingTitle(application.notes[0].title);
                                setNoteEditingContent(application.notes[0].content);
                              } else {
                                setActiveNoteId("new");
                                setNoteEditingTitle("Nueva Nota");
                                setNoteEditingContent("");
                              }
                              openModal({ type: "notes", applicationId: application.id });
                            }}
                            title="Ver notas"
                          >
                            <MessageSquareText size={14} aria-hidden="true" />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => openModal({ type: "edit", applicationId: application.id })}
                            title="Editar"
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal?.type === "edit" && activeApplication ? (
        <Modal title="Editar postulacion" onClose={closeModal}>
          <form
            action={runAction(updatePostulacion.bind(null, activeApplication.id), setPending, setError, closeModal)}
            className="modal-body"
            key={activeApplication.id}
          >
            <ApplicationFields application={activeApplication} cvVersions={cvVersions} />
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
            action={runAction(async () => deletePostulacion(activeApplication.id), setPending, setError, closeModal)}
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
        <Modal title={`Notas: ${activeApplication.nombreEmpresa}`} onClose={closeModal} giant>
          <div className="modal-body notes-workspace-giant">
            <div className="notes-sidebar-giant">
              <div className="notes-sidebar-header">
                <h3>Historial</h3>
                <button
                  className="icon-button"
                  onClick={() => {
                    setActiveNoteId("new");
                    setNoteEditingTitle("Nueva Nota");
                    setNoteEditingContent("");
                  }}
                  title="Nueva Nota"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="notes-sidebar-list">
                {activeApplication.notes.map((note) => (
                  <div
                    key={note.id}
                    className={`note-sidebar-item ${activeNoteId === note.id ? "active" : ""}`}
                    onClick={() => {
                      setActiveNoteId(note.id);
                      setNoteEditingTitle(note.title);
                      setNoteEditingContent(note.content);
                    }}
                  >
                    <div className="note-sidebar-item-info">
                      <span className="note-sidebar-item-title">{note.title || "Sin título"}</span>
                      <span className="note-sidebar-item-date">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      className="icon-button danger"
                      style={{ width: 24, height: 24, padding: 0 }}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("¿Estás seguro de que deseas eliminar esta nota?")) {
                          runAction(async () => {
                            await deleteNota(note.id);
                            if (activeNoteId === note.id) {
                              setActiveNoteId(null);
                            }
                          }, setPending, setError, () => { })();
                        }
                      }}
                      title="Eliminar"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {activeApplication.notes.length === 0 && activeNoteId !== "new" && (
                  <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
                    No hay notas.
                  </div>
                )}
              </div>
            </div>

            {activeNoteId !== null ? (
              <form
                className="notes-editor-split"
                action={runAction(async (formData: FormData) => {
                  if (activeNoteId === "new") {
                    await createNota(activeApplication.id, formData);
                    setActiveNoteId(null);
                  } else {
                    await updateNota(activeNoteId, formData);
                  }
                }, setPending, setError, () => { })}
              >
                <div className="notes-editor-split-header">
                  <input
                    name="title"
                    className="notes-editor-split-title-input"
                    value={noteEditingTitle}
                    onChange={(e) => setNoteEditingTitle(e.target.value)}
                    placeholder="Título de la nota..."
                    required
                  />
                  <input type="hidden" name="content" value={noteEditingContent} />
                  <button className="primary-button" type="submit" disabled={pending}>
                    <Save size={16} />
                    Guardar
                  </button>
                </div>
                <div className="notes-split-panes">
                  <div className="notes-split-pane-left">
                    <CodeMirror
                      value={noteEditingContent}
                      height="100%"
                      theme={theme === "dark" ? vscodeDark : vscodeLight}
                      extensions={[
                        markdown({ base: markdownLanguage, codeLanguages: languages }),
                        EditorView.lineWrapping,
                        wrappedLineIndent
                      ]}
                      onChange={(value) => setNoteEditingContent(value)}
                      style={{ fontSize: "14px", height: "100%" }}
                      basicSetup={{
                        lineNumbers: true,
                        highlightActiveLineGutter: true,
                        foldGutter: true,
                        tabSize: 2,
                      }}
                    />
                  </div>
                  <div className="notes-split-pane-right">
                    <div className="markdown-note">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {noteEditingContent || "*Vista previa...*"}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
                {error && <p className="form-error" style={{ margin: '8px 16px' }}>{error}</p>}
              </form>
            ) : (
              <div className="notes-editor-split" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--muted)' }}>Selecciona una nota o crea una nueva.</p>
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {modal?.type === "previewCv" && activeApplication ? (
        <Modal title={`CV de postulacion a ${activeApplication.nombreEmpresa}`} onClose={closeModal} wide>
          <div className="modal-body" style={{ height: '70vh', padding: 0 }}>
            <iframe
              src={activeApplication.cvVersion ? `/api/cv/pdf?version=${activeApplication.cvVersion}&v=1` : cvHref(activeApplication)}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Vista previa del CV"
            />
          </div>
        </Modal>
      ) : null}

      {modal?.type === "view" && activeApplication ? (
        <Modal title={`Detalle de Postulación`} onClose={closeModal} wide>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong>Empresa:</strong>
                <p>{activeApplication.nombreEmpresa}</p>
              </div>
              <div>
                <strong>Título:</strong>
                <p>{activeApplication.titulo || "N/A"}</p>
              </div>
              <div>
                <strong>Estado:</strong>
                <p><span className={`status-pill ${activeApplication.estado}`}>{statusLabels[activeApplication.estado]}</span></p>
              </div>
              <div>
                <strong>Link Propuesta:</strong>
                <p>
                  {activeApplication.linkPropuesta ? (
                    <a className="inline-link" href={activeApplication.linkPropuesta} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} aria-hidden="true" /> Ver link
                    </a>
                  ) : "N/A"}
                </p>
              </div>
            </div>
            <div>
              <strong>Texto de la Postulación:</strong>
              <div className="markdown-note" style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '6px', whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
                {activeApplication.textoPostulacion || "Sin texto."}
              </div>
            </div>
            {activeApplication.notes && activeApplication.notes.length > 0 && (
              <div>
                <strong>Última Nota:</strong>
                <div className="markdown-note" style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '6px', marginTop: '0.5rem' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeApplication.notes[0].content}</ReactMarkdown>
                </div>
              </div>
            )}
            <footer className="modal-footer" style={{ marginTop: 'auto' }}>
              <button className="primary-button" type="button" onClick={closeModal}>
                Cerrar
              </button>
            </footer>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
