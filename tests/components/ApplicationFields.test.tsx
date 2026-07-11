import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ApplicationFields } from "@/app/postulaciones-client";

// Mock the ReactMarkdown component to avoid testing remark plugins
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="markdown-preview">{children}</div>,
}));

describe("ApplicationFields", () => {
  it("renders with default empty fields", () => {
    render(<ApplicationFields />);
    
    expect(screen.getByPlaceholderText(/nombre empresa/i)).toHaveValue("");
    expect(screen.getByRole("combobox", { name: /estado/i })).toHaveValue("aplicado");
    expect(screen.getByPlaceholderText(/https:\/\//i)).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /texto/i })).toHaveValue("");
  });

  it("renders with application data", () => {
    const app = {
      id: 1,
      nombreEmpresa: "Test Inc",
      estado: "entrevista" as const,
      linkPropuesta: "https://test.com",
      textoPostulacion: "My application text",
      cvFilename: "resume.pdf",
      cvStoredName: "resume.pdf",
      noteCount: 0,
      latestNote: "",
      notes: [],
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
    };

    render(<ApplicationFields application={app} />);
    
    expect(screen.getByPlaceholderText(/nombre empresa/i)).toHaveValue("Test Inc");
    expect(screen.getByRole("combobox", { name: /estado/i })).toHaveValue("entrevista");
    expect(screen.getByPlaceholderText(/https:\/\//i)).toHaveValue("https://test.com");
    expect(screen.getByRole("textbox", { name: /texto/i })).toHaveValue("My application text");
    // Should show existing CV info
    expect(screen.getByText(/resume\.pdf/)).toBeInTheDocument();
  });

  it("does not render initial note field by default", () => {
    render(<ApplicationFields />);
    expect(screen.queryByPlaceholderText(/nota opcional/i)).not.toBeInTheDocument();
  });

  it("renders initial note field and live preview when includeInitialNote is true", async () => {
    const user = userEvent.setup();
    render(<ApplicationFields includeInitialNote={true} />);
    
    const noteInput = screen.getByPlaceholderText(/nota opcional/i);
    expect(noteInput).toBeInTheDocument();

    await user.type(noteInput, "Hello **world**");

    // The preview box should appear once there is text
    const previewBox = screen.getByTestId("markdown-preview");
    expect(previewBox).toBeInTheDocument();
    expect(previewBox).toHaveTextContent("Hello **world**");
  });
});
