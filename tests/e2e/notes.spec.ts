/**
 * E2E tests for notes CRUD using Playwright.
 */
import { test, expect } from "@playwright/test";

test.describe("Notes CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    // Make sure there's at least one application to work with
    const isEmpty = await page.getByText("Sin postulaciones").isVisible().catch(() => false);
    if (isEmpty) {
      await page.getByRole("button", { name: "Nueva" }).click();
      await page.getByLabel(/empresa/i).fill("Notes Test Company");
      await page.getByRole("button", { name: "Crear" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
  });

  test("should open notes modal and show empty state", async ({ page }) => {
    // Click the notes button on the first row (the count badge/button)
    await page.locator("table tbody tr").first().getByRole("button", { name: /\d/ }).first().click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/Notas:/i)).toBeVisible();
    await expect(page.getByText("Selecciona una nota o crea una nueva.")).toBeVisible();
  });

  test("should create a note and see it in the list", async ({ page }) => {
    await page.locator("table tbody tr").first().getByRole("button", { name: /\d/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Click 'Nueva Nota'
    await page.getByTitle("Nueva Nota").click();

    // Wait for editor pane
    await expect(page.getByPlaceholder("Título de la nota...")).toBeVisible();

    // Fill title
    await page.getByPlaceholder("Título de la nota...").fill("My Test Note");

    // The CodeMirror input requires clicking and typing
    const cm = page.locator(".cm-content");
    await cm.click();
    await page.keyboard.type("# Live Title\n\nSome **bold** content");

    // Live preview should appear on the right
    await expect(page.getByText("Vista previa")).not.toBeVisible(); // Not present anymore
    await expect(page.locator(".markdown-note").getByRole("heading", { name: "Live Title" })).toBeVisible();

    // Submit
    await page.getByRole("button", { name: "Guardar" }).click();

    // Note should appear in the sidebar list
    await expect(page.locator(".note-sidebar-item-title").filter({ hasText: "My Test Note" })).toBeVisible();
  });

  test("should edit an existing note", async ({ page }) => {
    await page.locator("table tbody tr").first().getByRole("button", { name: /\d/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Ensure a note exists
    const hasNote = await page.locator(".note-sidebar-item").count();
    if (hasNote === 0) {
      await page.getByTitle("Nueva Nota").click();
      await page.getByPlaceholder("Título de la nota...").fill("To Edit");
      await page.locator(".cm-content").click();
      await page.keyboard.type("Initial content");
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator(".note-sidebar-item-title").filter({ hasText: "To Edit" })).toBeVisible();
    }

    // Click the note in the sidebar
    await page.locator(".note-sidebar-item").first().click();

    // Change title
    await page.getByPlaceholder("Título de la nota...").fill("Edited Title");

    // Save
    await page.getByRole("button", { name: "Guardar" }).click();

    // Sidebar should reflect change
    await expect(page.locator(".note-sidebar-item-title").filter({ hasText: "Edited Title" })).toBeVisible();
  });

  test("should delete a note", async ({ page }) => {
    await page.locator("table tbody tr").first().getByRole("button", { name: /\d/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Ensure a note exists
    const hasNote = await page.locator(".note-sidebar-item").count();
    if (hasNote === 0) {
      await page.getByTitle("Nueva Nota").click();
      await page.getByPlaceholder("Título de la nota...").fill("To Delete");
      await page.locator(".cm-content").click();
      await page.keyboard.type("Content");
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator(".note-sidebar-item-title").filter({ hasText: "To Delete" })).toBeVisible();
    }

    // Auto-accept the confirmation dialog
    page.on('dialog', dialog => dialog.accept());

    const noteCountBefore = await page.locator(".note-sidebar-item").count();

    // Click the trash icon on the first note
    await page.locator(".note-sidebar-item").first().getByTitle("Eliminar").click();

    // Note count should decrease
    await expect(page.locator(".note-sidebar-item")).toHaveCount(noteCountBefore - 1);
  });

  test("should close notes modal", async ({ page }) => {
    await page.locator("table tbody tr").first().getByRole("button", { name: /\d/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Close button (X icon) or click outside
    await page.locator(".modal-close").click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

