"use client";
// Force recompile
import {
  AlertCircle,
  Clock,
  ExternalLink,
  FileText,
  FlaskConical,
  HelpCircle,
  MessageSquareText,
  Moon,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Save,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { wrappedLineIndent } from "codemirror-wrapped-line-indent";
import { EditorView } from '@codemirror/view';

import {
  createPostulacion,
  deletePostulacion,
  updatePostulacion,
  createNota,
  updateNota,
  deleteNota,
  compileCv,
  listCvVersions,
  getCvVersion,
  saveCvVersion,
  deleteCvVersion,
  renameCvVersion,
  updateStatusAction
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
  | { type: "previewCv"; applicationId: number }
  | null;

type PostulacionesClientProps = {
  applications: Application[];
};

type ApplicationFieldsProps = {
  application?: Application;
  includeInitialNote?: boolean;
  cvVersions?: string[];
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

function Modal({
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

function isApplicationStale(app: Application) {
  if (app.estado !== "aplicado") return false;
  const daysDiff = (Date.now() - new Date(app.updatedAt).getTime()) / (1000 * 3600 * 24);
  return daysDiff > 7;
}

export function PostulacionesClient({ applications }: PostulacionesClientProps) {
  const [modal, setModal] = useState<ModalState>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeTab, setActiveTab] = useState<"postulaciones" | "cv" | "dashboard">("postulaciones");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  // Table search/filter
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "todos">("todos");

  // CV Editor states
  const [cvYaml, setCvYaml] = useState("");
  const [cvVersions, setCvVersions] = useState<string[]>([]);
  const [activeVersion, setActiveVersion] = useState("");
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

  // Notes states
  const [activeNoteId, setActiveNoteId] = useState<number | "new" | null>(null);
  const [noteEditingTitle, setNoteEditingTitle] = useState("");
  const [noteEditingContent, setNoteEditingContent] = useState("");

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
    if (!activeVersionRef.current && versions.length > 0) {
      setActiveVersion(versions[0]);
    }
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

    if (!activeVersion) return;

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

    let contentToSave = cvYaml;
    if (!contentToSave.trim()) {
      contentToSave = `cv:
  name: "Tu Nombre"
  location: "Tu Ubicación"
  email: "tuemail@ejemplo.com"
  sections:
    summary:
      - "Este es un CV de ejemplo. Modifica este archivo YAML para empezar."
`;
    }

    await saveCvVersion(name, contentToSave);
    await loadVersions();
    setActiveVersion(name);
    setShowSaveAsModal(false);
    setSaveAsName("");
  };

  const handleDeleteVersion = async (versionToDelete: string) => {
    if (!confirm(`¿Eliminar la versión "${versionToDelete}"?`)) return;
    await deleteCvVersion(versionToDelete);

    // We update the state locally immediately to avoid lag
    const newVersions = cvVersions.filter(v => v !== versionToDelete);
    setCvVersions(newVersions);

    if (activeVersion === versionToDelete) {
      if (newVersions.length > 0) {
        setActiveVersion(newVersions[0]);
      } else {
        setActiveVersion("");
        setCvYaml("");
      }
    }
    // ensure server sync
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

  // ----- Drag and Drop -----
  const [draggedAppId, setDraggedAppId] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedAppId(id);
    e.dataTransfer.effectAllowed = "move";
    // For Firefox compatibility
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

  // ----- Helpers -----

  function openModal(state: ModalState) {
    setModal(state);
    setError("");
  }

  function closeModal() {
    setModal(null);
    setActiveNoteId(null);
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
            <button className="primary-button" type="button" onClick={() => openModal({ type: "create" })}>
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
          <button
            className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
            role="tab"
            aria-selected={activeTab === "dashboard"}
          >
            Dashboard
          </button>
        </nav>

        {/* ── DASHBOARD TAB ── */}
        {activeTab === "dashboard" ? (() => {
          const totalApplied = applications.filter(a => a.estado !== "pendiente").length;
          const totalInterviews = applications.filter(a => a.estado === "entrevista").length;
          const conversionRate = totalApplied > 0 ? ((totalInterviews / totalApplied) * 100).toFixed(1) : "0.0";
          const conversionNumber = parseFloat(conversionRate);

          const staleApps = applications.filter(isApplicationStale);

          const recentApps = applications.filter(a => {
            const daysDiff = (Date.now() - new Date(a.createdAt).getTime()) / (1000 * 3600 * 24);
            return daysDiff <= 7;
          });
          const weeklyGoal = 10;
          const weeklyProgress = Math.min((recentApps.length / weeklyGoal) * 100, 100);

          const cvStats = applications.reduce((acc, app) => {
            const version = app.cvVersion || "Sin especificar";
            if (!acc[version]) acc[version] = { total: 0, interviews: 0 };
            if (app.estado !== "pendiente") acc[version].total++;
            if (app.estado === "entrevista") acc[version].interviews++;
            return acc;
          }, {} as Record<string, { total: number; interviews: number }>);

          return (
            <div className="dashboard-grid">
              {/* Funnel Card */}
              <div className="dashboard-card">
                <h3>
                  <div className="widget-title-left">
                    <TrendingUp size={18} /> Embudo de Conversión
                  </div>
                  <div className="widget-help-container">
                    <HelpCircle size={16} className="widget-help-icon" />
                    <div className="widget-tooltip">
                      Compara el total de postulaciones enviadas con las que lograron avanzar a la etapa de entrevista. Te ayuda a diagnosticar si tu CV está funcionando.
                    </div>
                  </div>
                </h3>

                <div className="metric-hero">
                  <span className="metric-hero-value">{conversionRate}%</span>
                  <span className="metric-hero-label">Tasa de Éxito</span>
                </div>

                <div className="progress-container">
                  <div className="progress-label">
                    <span>Enviadas: {totalApplied}</span>
                    <span>Entrevistas: {totalInterviews}</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${conversionNumber}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Consistency Card */}
              <div className="dashboard-card">
                <h3>
                  <div className="widget-title-left">
                    <Target size={18} /> Consistencia Semanal
                  </div>
                  <div className="widget-help-container">
                    <HelpCircle size={16} className="widget-help-icon" />
                    <div className="widget-tooltip">
                      Mide cuántas postulaciones has realizado en los últimos 7 días. Buscar trabajo es un juego de números, intenta mantener el objetivo semanal para no perder el ritmo.
                    </div>
                  </div>
                </h3>

                <div className="metric-hero">
                  <span className="metric-hero-value">{recentApps.length}</span>
                  <span className="metric-hero-label">Postulaciones (7 días)</span>
                </div>

                <div className="progress-container">
                  <div className="progress-label">
                    <span>Progreso semanal</span>
                    <span>Objetivo: {weeklyGoal}</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${weeklyProgress}%`, background: weeklyProgress >= 100 ? 'linear-gradient(90deg, #10b981, #059669)' : undefined }}></div>
                  </div>
                  {recentApps.length >= weeklyGoal ? (
                    <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 8, fontWeight: 600, textAlign: 'center' }}>¡Objetivo cumplido! 🚀</p>
                  ) : (
                    <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>Faltan {weeklyGoal - recentApps.length} para tu meta.</p>
                  )}
                </div>
              </div>

              {/* A/B Testing Card */}
              <div className="dashboard-card">
                <h3>
                  <div className="widget-title-left">
                    <FlaskConical size={18} /> A/B Testing de CVs
                  </div>
                  <div className="widget-help-container">
                    <HelpCircle size={16} className="widget-help-icon" />
                    <div className="widget-tooltip">
                      Analiza la tasa de éxito de cada versión de tu CV. Útil para descubrir qué perfil o formato resuena mejor con los reclutadores y enfocarte en ese.
                    </div>
                  </div>
                </h3>
                {Object.keys(cvStats).length === 0 ? (
                  <div className="stale-empty">No hay suficientes datos todavía.</div>
                ) : (
                  <table className="dashboard-ab-table">
                    <thead>
                      <tr>
                        <th>Versión CV</th>
                        <th>Enviados</th>
                        <th>Conversión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(cvStats).map(([version, stats]) => {
                        const rateNum = stats.total > 0 ? (stats.interviews / stats.total) * 100 : 0;
                        const rateStr = rateNum.toFixed(1);
                        return (
                          <tr key={version}>
                            <td style={{ fontWeight: 600 }}>{version}</td>
                            <td>{stats.total}</td>
                            <td>
                              <div className="ab-rate-container">
                                <span className="highlight">{rateStr}%</span>
                                <div className="ab-rate-bar">
                                  <div className="ab-rate-fill" style={{ width: `${rateNum}%` }}></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Follow-ups Card */}
              <div className="dashboard-card">
                <h3>
                  <div className="widget-title-left">
                    <Clock size={18} /> Acción Requerida
                  </div>
                  <div className="widget-help-container">
                    <HelpCircle size={16} className="widget-help-icon" />
                    <div className="widget-tooltip">
                      Lista las postulaciones en estado 'Aplicado' que llevan más de 7 días sin novedades. ¡Es el momento perfecto para enviar un email de seguimiento!
                    </div>
                  </div>
                </h3>
                <div className="stale-list">
                  {staleApps.length === 0 ? (
                    <div className="stale-empty">¡Estás al día! 🎉<br /><span style={{ fontSize: 12, fontWeight: 400 }}>No hay follow-ups pendientes.</span></div>
                  ) : (
                    staleApps.map(app => (
                      <div key={app.id} className="stale-item">
                        <div className="stale-item-info">
                          <span className="stale-item-title">{app.nombreEmpresa}</span>
                          <span className="stale-item-date">
                            <AlertCircle size={12} /> Hace más de 7 días
                          </span>
                        </div>
                        <button
                          className="icon-button"
                          onClick={() => openModal({ type: "edit", applicationId: app.id })}
                          title="Actualizar estado"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })() : null}

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
                      <span>{v}</span>
                    </button>
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
                  </div>
                ))}
              </div>
            </div>

            {/* Editor panel */}
            {activeVersion ? (
              <>
                <div className="cv-editor-panel">
                  <div className="cv-top-bar">
                    <div className="cv-top-bar-left">
                      <span className="cv-version-label">Editando: {activeVersion}</span>
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
              </>
            ) : (
              <div className="cv-editor-panel" style={{ alignItems: "center", justifyContent: "center" }}>
                <div className="cv-preview-empty">
                  <p>No tienes ningún CV activo.</p>
                  <button className="primary-button" type="button" onClick={() => { setSaveAsName(""); setShowSaveAsModal(true); }}>
                    <Plus size={16} aria-hidden="true" />
                    Crear nuevo CV
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* ── MODALS ── */}

      {modal?.type === "create" ? (
        <Modal title="Nueva postulacion" onClose={closeModal}>
          <form action={runAction(createPostulacion, closeModal)} className="modal-body">
            <ApplicationFields includeInitialNote cvVersions={cvVersions} />
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
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("¿Estás seguro de que deseas eliminar esta nota?")) {
                          runAction(async () => {
                            await deleteNota(note.id);
                            if (activeNoteId === note.id) {
                              setActiveNoteId(null);
                            }
                          }, () => { })();
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
                    // Reset activeNoteId after create to let it select the new note if possible,
                    // but for simplicity we'll just let it refresh and we can clear state or close
                    setActiveNoteId(null);
                  } else {
                    await updateNota(activeNoteId, formData);
                  }
                }, () => { })}
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
