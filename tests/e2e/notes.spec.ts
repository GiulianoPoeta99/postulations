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
    await expect(page.getByText(/notas?/i)).toBeVisible();
  });

  test("should create a note and see it in the list", async ({ page }) => {
    await page.locator("table tbody tr").first().getByRole("button", { name: /\d/ }).first().click();

    await expect(page.getByRole("dialog")).toBeVisible();

    // Type in the compose box
    await page.getByPlaceholder(/escribe markdown/i).fill("# My Test Note\n\nSome **bold** content.");

    // Live preview should appear
    await expect(page.getByText("Vista previa")).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Test Note" })).toBeVisible();

    // Submit
    await page.getByRole("button", { name: "Agregar nota" }).click();

    // Note should appear in the list
    await expect(page.getByText("My Test Note")).toBeVisible();
  });

  test("should edit an existing note with live preview", async ({ page }) => {
    // Create a note first if there are none
    await page.locator("table tbody tr").first().getByRole("button", { name: /\d/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Check if there are notes; if not, create one
    const hasNote = await page.locator(".note-item").count();
    if (hasNote === 0) {
      await page.getByPlaceholder(/escribe markdown/i).fill("Note to edit later");
      await page.getByRole("button", { name: "Agregar nota" }).click();
    }

    // Click pencil icon on first note
    await page.locator(".note-item").first().getByTitle("Editar nota").click();

    // Editor should appear
    await expect(page.locator(".note-item-editing")).toBeVisible();

    // Type something new to trigger live preview
    const editTextarea = page.locator(".note-item-editing textarea");
    await editTextarea.fill("## Edited note content");

    // Wait for live preview box
    await expect(page.locator(".note-item-editing .note-live-preview-box")).toBeVisible();

    // Save
    await page.locator(".note-item-editing").getByRole("button", { name: "Guardar" }).click();

    // Check edited content appears
    await expect(page.getByText("Edited note content")).toBeVisible();
  });

  test("should delete a note", async ({ page }) => {
    await page.locator("table tbody tr").first().getByRole("button", { name: /\d/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Ensure at least one note exists
    const hasNote = await page.locator(".note-item").count();
    if (hasNote === 0) {
      await page.getByPlaceholder(/escribe markdown/i).fill("Note to delete");
      await page.getByRole("button", { name: "Agregar nota" }).click();
      await expect(page.locator(".note-item")).toHaveCount(1);
    }

    const noteCountBefore = await page.locator(".note-item").count();

    // Click the trash icon on the first note
    await page.locator(".note-item").first().getByTitle("Eliminar nota").click();

    // Note count should decrease
    await expect(page.locator(".note-item")).toHaveCount(noteCountBefore - 1);
  });

  test("should close notes modal", async ({ page }) => {
    await page.locator("table tbody tr").first().getByRole("button", { name: /\d/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("note compose area clears after submitting", async ({ page }) => {
    await page.locator("table tbody tr").first().getByRole("button", { name: /\d/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const textarea = page.getByPlaceholder(/escribe markdown/i);
    await textarea.fill("This will be cleared");
    await page.getByRole("button", { name: "Agregar nota" }).click();

    // Textarea should be empty after submit
    await expect(textarea).toHaveValue("");
  });
});
