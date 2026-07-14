"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon, Plus, LayoutDashboard, ListTodo, FileBadge } from "lucide-react";
import { ApplicationFields, Modal, runAction } from "./Shared";
import { createPostulacion, listCvVersions } from "@/app/actions";

export function SidebarLayout({
  children,
  applicationsCount
}: {
  children: React.ReactNode;
  applicationsCount: number;
}) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [cvVersions, setCvVersions] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    setTheme(saved === "dark" ? "dark" : "light");
    
    // Load CV versions for the create modal
    listCvVersions().then(setCvVersions);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setError("");
  };

  return (
    <div className="page-shell">
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <p className="eyebrow">Postulaciones</p>
          <h2 style={{ fontSize: 24 }}>Seguimiento</h2>
        </div>
        
        <nav className="sidebar-nav">
          <Link href="/" className={`sidebar-link ${pathname === "/" ? "active" : ""}`}>
            <LayoutDashboard size={18} />
            Dashboard
          </Link>
          <Link href="/postulaciones" className={`sidebar-link ${pathname === "/postulaciones" ? "active" : ""}`}>
            <ListTodo size={18} />
            Postulaciones
          </Link>
          <Link href="/cv" className={`sidebar-link ${pathname === "/cv" ? "active" : ""}`}>
            <FileBadge size={18} />
            Mi CV
          </Link>
        </nav>
      </aside>

      <div className="workspace">
        <header className="app-header">
          <div className="header-actions">
            <button
              className="icon-button"
              type="button"
              onClick={toggleTheme}
              title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <div className="counter" title={`${applicationsCount} postulaciones`}>
              {applicationsCount}
            </div>
            <button className="primary-button" type="button" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Nueva
            </button>
          </div>
        </header>

        <main className="main-content">
          <div className="page-container">
            {children}
          </div>
        </main>
      </div>

      {showCreateModal && (
        <Modal title="Nueva postulacion" onClose={closeModal} wide>
          <form action={runAction(createPostulacion, setPending, setError, closeModal)} className="modal-body">
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
      )}
    </div>
  );
}
