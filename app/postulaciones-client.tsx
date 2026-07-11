"use client";

import {
  ExternalLink,
  FileText,
  MessageSquareText,
  Moon,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Save,
  Sun,
  Trash2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { wrappedLineIndent } from "codemirror-wrapped-line-indent";
import { EditorView } from '@codemirror/view';

import {
  createNota,
  createPostulacion,
  deleteNota,
  deletePostulacion,
  updateNota,
  updatePostulacion,
  compileCv,
  listCvVersions,
  getCvVersion,
  saveCvVersion,
  deleteCvVersion,
  renameCvVersion
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
  if (!normalized) return "";
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
  if (!normalized) return "";
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

export function ApplicationFields({ application, includeInitialNote = false }: ApplicationFieldsProps) {
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
          {application.cvFilename ?? application.cvStoredName}
        </a>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide = false
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeTab, setActiveTab] = useState<"postulaciones" | "cv">("postulaciones");

  // Table search/filter
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "todos">("todos");

  // CV Editor states
  const [cvYaml, setCvYaml] = useState("");
  const [cvVersions, setCvVersions] = useState<string[]>([]);
  const [activeVersion, setActiveVersion] = useState("default");
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState("");
  const [newName, setNewName] = useState("");
  const [compileStatus, setCompileStatus] = useState<"idle" | "compiling" | "success" | "error">("idle");
  const [compileError, setCompileError] = useState("");
  const [previewVersion, setPreviewVersion] = useState(0);
  const [cvPageCount, setCvPageCount] = useState(1);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const versionMenuRef = useRef<HTMLDivElement>(null);

  // Notes live preview states
  const [noteComposeText, setNoteComposeText] = useState("");
  const [noteEditingText, setNoteEditingText] = useState("");

  // Ref to avoid stale closure in debounce
  const cvYamlRef = useRef(cvYaml);
  const activeVersionRef = useRef(activeVersion);
  useEffect(() => { cvYamlRef.current = cvYaml; }, [cvYaml]);
  useEffect(() => { activeVersionRef.current = activeVersion; }, [activeVersion]);

  // Read initial theme from DOM (set by layout.tsx script)
  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    setTheme(saved === "dark" ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  // ----- CV Actions -----

  const loadVersions = useCallback(async () => {
    const versions = await listCvVersions();
    setCvVersions(versions);
  }, []);

  const doCompile = useCallback(async (version: string, yaml: string) => {
    setCompileStatus("compiling");
    setCompileError("");
    try {
      const res = await compileCv(version, yaml);
      if (res.success) {
        setCompileStatus("success");
        if (res.pageCount) setCvPageCount(res.pageCount);
        setPreviewVersion((v) => v + 1);
      } else {
        setCompileStatus("error");
        setCompileError(res.error || "Error desconocido al compilar.");
      }
    } catch (err: any) {
      setCompileStatus("error");
      setCompileError(err.message || "Error al compilar.");
    }
  }, []);

  const handleCompile = useCallback(() => {
    doCompile(activeVersionRef.current, cvYamlRef.current);
  }, [doCompile]);

  // Load YAML and auto-compile when tab or version changes
  useEffect(() => {
    if (activeTab !== "cv") return;

    let cancelled = false;
    loadVersions();

    getCvVersion(activeVersion).then((yaml) => {
      if (cancelled) return;
      setCvYaml(yaml);
      doCompile(activeVersion, yaml);
    });

    return () => { cancelled = true; };
  }, [activeTab, activeVersion, loadVersions, doCompile]);

  // Debounced auto-compile on YAML edit (1.5s after last keystroke)
  const isDirtyRef = useRef(false);
  useEffect(() => {
    if (!isDirtyRef.current) return;

    const timer = setTimeout(() => {
      isDirtyRef.current = false;
      doCompile(activeVersionRef.current, cvYamlRef.current);
    }, 800);

    return () => clearTimeout(timer);
  }, [cvYaml, doCompile]);

  const handleYamlChange = (val: string) => {
    setCvYaml(val);
    isDirtyRef.current = true;
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (versionMenuRef.current && !versionMenuRef.current.contains(e.target as Node)) {
        setShowVersionMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSaveAs = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = saveAsName.replace(/[^a-zA-Z0-9_-]/g, "").trim();
    if (!name) return;
    await saveCvVersion(name, cvYaml);
    await loadVersions();
    setActiveVersion(name);
    setShowSaveAsModal(false);
    setSaveAsName("");
  };

  const handleDeleteVersion = async (versionToDelete: string) => {
    if (versionToDelete === "default") return;
    if (!confirm(`¿Eliminar la versión "${versionToDelete}"?`)) return;
    await deleteCvVersion(versionToDelete);
    if (activeVersion === versionToDelete) {
      setActiveVersion("default");
    }
    await loadVersions();
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedNewName = newName.replace(/[^a-zA-Z0-9_-]/g, "").trim();
    if (!sanitizedNewName || sanitizedNewName === renameTarget) {
      setShowRenameModal(false);
      return;
    }
    const res = await renameCvVersion(renameTarget, sanitizedNewName);
    if (res.success) {
      await loadVersions();
      if (activeVersion === renameTarget) {
        setActiveVersion(sanitizedNewName);
      }
      setShowRenameModal(false);
    } else {
      alert(res.error || "Error al renombrar.");
    }
  };

  // ----- Derived state -----

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
    if (!modal || modal.type === "create") return null;
    return applications.find((a) => a.id === modal.applicationId) ?? null;
  }, [applications, modal]);

  // ----- Helpers -----

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

  // ----- Render -----

  return (
    <main className="page-shell">
      <section className="workspace">
        <header className="app-header">
          <div>
            <p className="eyebrow">Postulaciones</p>
            <h1>Seguimiento</h1>
          </div>
          <div className="header-actions">
            <button
              className="icon-button"
              type="button"
              onClick={toggleTheme}
              title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
              aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
            </button>
            <div className="counter" aria-label={`${applications.length} postulaciones`}>
              {applications.length}
            </div>
            <button className="primary-button" type="button" onClick={() => setModal({ type: "create" })}>
              <Plus size={16} aria-hidden="true" />
              Nueva
            </button>
          </div>
        </header>

        <nav className="tab-navigation" role="tablist">
          <button
            className={`tab-button ${activeTab === "postulaciones" ? "active" : ""}`}
            onClick={() => setActiveTab("postulaciones")}
            role="tab"
            aria-selected={activeTab === "postulaciones"}
          >
            Postulaciones
          </button>
          <button
            className={`tab-button ${activeTab === "cv" ? "active" : ""}`}
            onClick={() => setActiveTab("cv")}
            role="tab"
            aria-selected={activeTab === "cv"}
          >
            Mi CV (RenderCV)
          </button>
        </nav>

        {/* ── POSTULACIONES TAB ── */}
        {activeTab === "postulaciones" ? (
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
            </div>

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
                          <span className={`status-pill ${application.estado}`}>
                            {statusLabels[application.estado]}
                          </span>
                        </td>
                        <td>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => {
                              setEditingNoteId(null);
                              setNoteComposeText("");
                              setModal({ type: "notes", applicationId: application.id });
                            }}
                          >
                            <MessageSquareText size={15} aria-hidden="true" />
                            {application.noteCount}
                          </button>
                          {application.latestNote ? (
                            <p className="note-preview">{markdownTextPreview(application.latestNote)}</p>
                          ) : null}
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
          </>
        ) : null}

        {/* ── CV TAB ── */}
        {activeTab === "cv" ? (
          <div className="cv-workspace">
            {/* Sidebar */}
            <div className="cv-sidebar">
              <div className="cv-sidebar-header">
                <h3>Versiones</h3>
                <button 
                  className="icon-button" 
                  onClick={() => { setSaveAsName(""); setShowSaveAsModal(true); }}
                  title="Duplicar versión actual"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="cv-version-list">
                {cvVersions.map((v) => (
                  <div key={v} className={`cv-version-item ${activeVersion === v ? "active" : ""}`}>
                    <button 
                      className="cv-version-name" 
                      onClick={() => setActiveVersion(v)}
                      title={`Seleccionar ${v}`}
                    >
                      <FileText size={14} aria-hidden="true" />
                      <span>{v === "default" ? "default (principal)" : v}</span>
                    </button>
                    {v !== "default" && (
                      <div className="cv-version-actions">
                        <button 
                          className="icon-button"
                          title="Renombrar versión"
                          onClick={() => { setRenameTarget(v); setNewName(v); setShowRenameModal(true); }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button 
                          className="icon-button danger"
                          title="Eliminar versión"
                          onClick={() => handleDeleteVersion(v)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Editor panel */}
            <div className="cv-editor-panel">
              <div className="cv-top-bar">
                <div className="cv-top-bar-left">
                  <span className="cv-version-label">Editando: {activeVersion === "default" ? "default (principal)" : activeVersion}</span>
                </div>
                <div className="cv-compile-inline">
                  {compileStatus === "compiling" && (
                    <span className="compile-status compiling" title="Compilando...">
                      <span className="spinner-small" aria-hidden="true"></span>
                    </span>
                  )}
                  {compileStatus === "success" && (
                    <span className="compile-status success" title="¡Listo!">✓</span>
                  )}
                  {compileStatus === "error" && (
                    <span className="compile-status error" title="Error">!</span>
                  )}
                  <button
                    className="primary-button icon-only"
                    type="button"
                    onClick={handleCompile}
                    disabled={compileStatus === "compiling"}
                    title="Forzar Compilación"
                  >
                    <Play size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="cv-codemirror-wrapper">
                <CodeMirror
                  value={cvYaml}
                  height="100%"
                  extensions={[yaml(), EditorView.lineWrapping, wrappedLineIndent]}
                  theme={theme === "dark" ? vscodeDark : vscodeLight}
                  onChange={(value) => handleYamlChange(value)}
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    foldGutter: true,
                    tabSize: 2,
                  }}
                />
              </div>

              {compileError && (
                <div className="cv-error-log">{compileError}</div>
              )}
            </div>

            {/* Preview panel */}
            <div className="cv-preview-panel">
              <header className="cv-editor-header">
                <h2>Vista previa en vivo</h2>
                {previewVersion > 0 && (
                  <a
                    className="inline-link"
                    href={`/api/cv/pdf?version=${activeVersion}&v=${previewVersion}`}
                    download={`${activeVersion}_cv.pdf`}
                  >
                    <FileText size={14} aria-hidden="true" />
                    Descargar PDF
                  </a>
                )}
              </header>

              <div className="cv-preview-container">
                {compileStatus === "compiling" && previewVersion === 0 ? (
                  <div className="cv-preview-empty">
                    <span className="compile-status compiling">Compilando...</span>
                  </div>
                ) : previewVersion === 0 ? (
                  <div className="cv-preview-empty">
                    <p>No hay vista previa aún.</p>
                    <button className="secondary-button" type="button" onClick={handleCompile}>
                      Compilar ahora
                    </button>
                  </div>
                ) : (
                  <div className="cv-preview-image-wrapper">
                    {compileStatus === "compiling" && (
                      <div className="cv-preview-overlay">
                        <div className="spinner"></div>
                        <span>Actualizando...</span>
                      </div>
                    )}
                    <div className="cv-preview-pages-container">
                      {Array.from({ length: cvPageCount }).map((_, i) => (
                        <img
                          key={`${previewVersion}-${i}`}
                          src={`/api/cv/preview?version=${activeVersion}&page=${i + 1}&v=${previewVersion}`}
                          alt={`Vista previa del CV página ${i + 1}`}
                          className={`cv-preview-image ${compileStatus === "compiling" ? "compiling" : ""}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── MODALS ── */}

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
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    onClick={() => setEditingNoteId(null)}
                  >
                    Cancelar edición
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
                              <button
                                className="secondary-button compact-button"
                                type="button"
                                onClick={() => setEditingNoteId(null)}
                              >
                                Cancelar
                              </button>
                              <button className="primary-button compact-button" type="submit" disabled={pending}>
                                <Save size={15} aria-hidden="true" />
                                Guardar
                              </button>
                            </div>
                          </div>
                          <textarea
                            name="content"
                            rows={10}
                            value={noteEditingText}
                            onChange={(e) => setNoteEditingText(e.target.value)}
                            required
                          />
                          {noteEditingText.trim() && (
                            <div className="note-live-preview-box">
                              <div className="note-live-preview-title">Vista previa</div>
                              <MarkdownNote content={noteEditingText} />
                            </div>
                          )}
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
                              onClick={() => {
                                setEditingNoteId(note.id);
                                setNoteEditingText(note.content);
                              }}
                              title="Editar nota"
                            >
                              <Pencil size={16} aria-hidden="true" />
                              <span className="sr-only">Editar nota</span>
                            </button>
                            <form action={runAction(async () => deleteNota(note.id))}>
                              <button
                                className="icon-button danger"
                                type="submit"
                                disabled={pending}
                                title="Eliminar nota"
                              >
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
                action={runAction(createNota.bind(null, activeApplication.id), () => setNoteComposeText(""))}
                className="note-create"
                key={`create-note-${activeApplication.id}-${activeApplication.noteCount}`}
              >
                <label className="field">
                  <span>Nueva nota</span>
                  <textarea
                    name="content"
                    rows={8}
                    placeholder="Escribe Markdown..."
                    required
                    value={noteComposeText}
                    onChange={(e) => setNoteComposeText(e.target.value)}
                  />
                </label>
                {noteComposeText.trim() && (
                  <div className="note-live-preview-box">
                    <div className="note-live-preview-title">Vista previa</div>
                    <MarkdownNote content={noteComposeText} />
                  </div>
                )}
                <button className="primary-button" type="submit" disabled={pending}>
                  <Plus size={16} aria-hidden="true" />
                  Agregar nota
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

      {showSaveAsModal ? (
        <Modal title="Guardar como nueva versión" onClose={() => setShowSaveAsModal(false)}>
          <form onSubmit={handleSaveAs} className="modal-body">
            <label className="field">
              <span>Nombre de la versión</span>
              <input
                type="text"
                placeholder="Ej. Backend_Developer"
                value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                required
                autoFocus
              />
            </label>
            <footer className="modal-footer">
              <button className="secondary-button" type="button" onClick={() => setShowSaveAsModal(false)}>
                Cancelar
              </button>
              <button className="primary-button" type="submit">
                Guardar
              </button>
            </footer>
          </form>
        </Modal>
      ) : null}

      {showRenameModal ? (
        <Modal title="Renombrar versión" onClose={() => setShowRenameModal(false)}>
          <form onSubmit={handleRenameSubmit} className="modal-body">
            <label className="field">
              <span>Nuevo nombre para "{renameTarget}"</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                required
                autoFocus
              />
            </label>
            <footer className="modal-footer">
              <button className="secondary-button" type="button" onClick={() => setShowRenameModal(false)}>
                Cancelar
              </button>
              <button className="primary-button" type="submit">
                Renombrar
              </button>
            </footer>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
