import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostulacionesClient } from "@/app/postulaciones-client";
import * as actions from "@/app/actions";
import type { Application } from "@/lib/db";

// Mock the server actions
vi.mock("@/app/actions", () => ({
  createPostulacion: vi.fn(),
  updatePostulacion: vi.fn(),
  deletePostulacion: vi.fn(),
  createNota: vi.fn(),
  updateNota: vi.fn(),
  deleteNota: vi.fn(),
  compileCv: vi.fn(),
  listCvVersions: vi.fn().mockResolvedValue(["default"]),
  getCvVersion: vi.fn().mockResolvedValue("cv: test"),
  saveCvVersion: vi.fn(),
  deleteCvVersion: vi.fn(),
}));

// Mock ReactMarkdown
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="markdown-preview">{children}</div>,
}));

// Mock CodeMirror
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string, onChange: (val: string) => void }) => (
    <textarea 
      data-testid="mock-codemirror" 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
    />
  ),
}));

const mockApplications: Application[] = [
  {
    id: 1,
    nombreEmpresa: "Acme Corp",
    estado: "aplicado",
    linkPropuesta: "https://acme.com/jobs/1",
    textoPostulacion: "Here is my application text.",
    cvFilename: "resume.pdf",
    cvStoredName: "123.pdf",
    cvVersion: "default",
    notas: "First note",
    noteCount: 1,
    latestNote: "First note content",
    notes: [
      { id: 1, postulacionId: 1, title: "Nota 1", content: "First note content", createdAt: "2023-01-01", updatedAt: "2023-01-01", deletedAt: null }
    ],
    createdAt: "2023-01-01",
    updatedAt: "2023-01-01",
    deletedAt: null,
  },
  {
    id: 2,
    nombreEmpresa: "Globex",
    estado: "entrevista",
    linkPropuesta: "",
    textoPostulacion: "",
    cvFilename: "",
    cvStoredName: "",
    cvVersion: "",
    notas: "",
    noteCount: 0,
    latestNote: "",
    notes: [],
    createdAt: "2023-01-02",
    updatedAt: "2023-01-02",
    deletedAt: null,
  }
];

describe("PostulacionesClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation to pretend the server action does not throw
    vi.mocked(actions.createPostulacion).mockResolvedValue(undefined);
    vi.mocked(actions.updatePostulacion).mockResolvedValue(undefined);
    vi.mocked(actions.deletePostulacion).mockResolvedValue(undefined);
  });

  it("renders the table with applications", () => {
    render(<PostulacionesClient applications={mockApplications} />);
    
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
  });

  it("filters applications by text search", async () => {
    const user = userEvent.setup();
    render(<PostulacionesClient applications={mockApplications} />);
    
    const searchInput = screen.getByPlaceholderText(/buscar/i);
    await user.type(searchInput, "Acme");
    
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.queryByText("Globex")).not.toBeInTheDocument();
  });

  it("filters applications by status", async () => {
    const user = userEvent.setup();
    render(<PostulacionesClient applications={mockApplications} />);
    
    const filterBtn = screen.getByRole("button", { name: "Entrevista" });
    await user.click(filterBtn);
    
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
  });

  it("opens 'Nueva' modal and submits data", async () => {
    const user = userEvent.setup();
    render(<PostulacionesClient applications={mockApplications} />);
    
    await user.click(screen.getByRole("button", { name: "Nueva" }));
    
    expect(screen.getByRole("dialog", { name: "Nueva postulacion" })).toBeInTheDocument();
    
    const empresaInput = screen.getByPlaceholderText(/nombre empresa/i);
    await user.type(empresaInput, "New Startup");
    
    const submitBtn = screen.getByRole("button", { name: "Crear" });
    await user.click(submitBtn);
    
    await waitFor(() => {
      expect(actions.createPostulacion).toHaveBeenCalledOnce();
    });
    // The dialog should close (optimistic update or at least wait for submit)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens edit modal and submits data", async () => {
    const user = userEvent.setup();
    render(<PostulacionesClient applications={mockApplications} />);
    
    // Click edit on the first row
    const editBtns = screen.getAllByTitle("Editar");
    await user.click(editBtns[0]);
    
    expect(screen.getByRole("dialog", { name: "Editar postulacion" })).toBeInTheDocument();
    
    const empresaInput = screen.getByPlaceholderText(/nombre empresa/i);
    expect(empresaInput).toHaveValue("Acme Corp");
    
    await user.clear(empresaInput);
    await user.type(empresaInput, "Acme Edited");
    
    const submitBtn = screen.getByRole("button", { name: "Guardar" });
    await user.click(submitBtn);
    
    await waitFor(() => {
      expect(actions.updatePostulacion).toHaveBeenCalledWith(1, expect.any(FormData));
    });
  });

  it("opens delete modal and confirms deletion", async () => {
    const user = userEvent.setup();
    render(<PostulacionesClient applications={mockApplications} />);
    
    const deleteBtns = screen.getAllByRole("button", { name: "Eliminar" });
    fireEvent.click(deleteBtns[0]);
    
    const dialog = screen.getByRole("dialog", { name: "Confirmar eliminacion" });
    expect(dialog).toBeInTheDocument();
    
    const confirmBtns = screen.getAllByRole("button", { name: "Eliminar" });
    await user.click(confirmBtns[confirmBtns.length - 1]);
    
    await waitFor(() => {
      expect(actions.deletePostulacion).toHaveBeenCalledWith(1);
    });
  });

  it("opens notes modal and allows editing notas", async () => {
    const user = userEvent.setup();
    render(<PostulacionesClient applications={mockApplications} />);
    
    // Click on the notes button for the first application
    const noteBtns = screen.getAllByRole("button", { name: /ver notas/i });
    fireEvent.click(noteBtns[0]);
    
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    
    const saveNoteBtn = screen.getByRole("button", { name: "Guardar" });
    await user.click(saveNoteBtn);
    
    await waitFor(() => {
      // It should call updateNota since it has a note initially
      expect(actions.updateNota).toHaveBeenCalledWith(1, expect.any(FormData));
    });
  });
});
