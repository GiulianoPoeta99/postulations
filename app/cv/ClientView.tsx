"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Pencil, Play, Plus, Trash2 } from "lucide-react";
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { wrappedLineIndent } from "codemirror-wrapped-line-indent";
import { EditorView } from '@codemirror/view';

import {
  compileCv,
  listCvVersions,
  getCvVersion,
  saveCvVersion,
  deleteCvVersion,
  renameCvVersion
} from "@/app/actions";
import { Modal } from "../components/Shared";

export function CvClientView() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [cvLanguage, setCvLanguage] = useState<"es" | "en">("es");
  
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

  // Ref to avoid stale closure in debounce
  const cvYamlRef = useRef(cvYaml);
  const activeVersionRef = useRef(activeVersion);
  const cvLanguageRef = useRef(cvLanguage);
  useEffect(() => { cvYamlRef.current = cvYaml; }, [cvYaml]);
  useEffect(() => { activeVersionRef.current = activeVersion; }, [activeVersion]);
  useEffect(() => { cvLanguageRef.current = cvLanguage; }, [cvLanguage]);

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
    
    return () => observer.disconnect();
  }, []);

  const loadVersions = useCallback(async () => {
    const versions = await listCvVersions();
    setCvVersions(versions);
    if (!activeVersionRef.current && versions.length > 0) {
      setActiveVersion(versions[0]);
    }
  }, []);

  const doCompile = useCallback(async (version: string, yaml: string, lang: string) => {
    setCompileStatus("compiling");
    setCompileError("");
    try {
      const res = await compileCv(version, yaml, lang);
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
    doCompile(activeVersionRef.current, cvYamlRef.current, cvLanguageRef.current);
  }, [doCompile]);

  useEffect(() => {
    let cancelled = false;
    loadVersions();

    if (!activeVersion) return;

    getCvVersion(activeVersion).then((yaml) => {
      if (cancelled) return;
      setCvYaml(yaml);
      doCompile(activeVersion, yaml, cvLanguageRef.current);
    });

    return () => { cancelled = true; };
  }, [activeVersion, loadVersions, doCompile]);

  const isDirtyRef = useRef(false);
  useEffect(() => {
    if (!isDirtyRef.current) return;

    const timer = setTimeout(() => {
      isDirtyRef.current = false;
      doCompile(activeVersionRef.current, cvYamlRef.current, cvLanguageRef.current);
    }, 800);

    return () => clearTimeout(timer);
  }, [cvYaml, doCompile]);

  useEffect(() => {
    if (!activeVersionRef.current || !cvYamlRef.current) return;
    doCompile(activeVersionRef.current, cvYamlRef.current, cvLanguage);
  }, [cvLanguage, doCompile]);

  const handleYamlChange = (val: string) => {
    setCvYaml(val);
    isDirtyRef.current = true;
  };

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

  return (
    <>
      <div className="cv-workspace" style={{ marginTop: 0 }}>
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
                  <select 
                    value={cvLanguage} 
                    onChange={(e) => setCvLanguage(e.target.value as "es" | "en")}
                    style={{ marginLeft: 16, padding: "2px 8px", borderRadius: 4, background: "var(--bg-elevated)", color: "var(--text-main)", border: "1px solid var(--border-color)", fontSize: "0.9em" }}
                  >
                    <option value="es">🇪🇸 Español</option>
                    <option value="en">🇬🇧 English</option>
                  </select>
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
                    href={`/api/cv/pdf?version=${activeVersion}&lang=${cvLanguage}&v=${previewVersion}`}
                    download={`${activeVersion}_${cvLanguage}_cv.pdf`}
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
                          src={`/api/cv/preview?version=${activeVersion}&lang=${cvLanguage}&page=${i + 1}&v=${previewVersion}`}
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
    </>
  );
}
