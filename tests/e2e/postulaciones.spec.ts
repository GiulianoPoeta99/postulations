/**
 * E2E tests for postulaciones CRUD using Playwright.
 * Requires the dev server running on http://localhost:3000.
 */
import { test, expect } from "@playwright/test";

test.describe("Postulaciones CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Ensure we're on the postulaciones tab
    await page.getByRole("tab", { name: "Postulaciones" }).click();
  });

  test("should show empty state initially or application list", async ({ page }) => {
    // Either "Sin postulaciones" or a table with rows is visible
    const hasEmpty = await page.getByText("Sin postulaciones").isVisible().catch(() => false);
    const hasTable = await page.locator("table tbody tr").count();
    expect(hasEmpty || hasTable > 0).toBe(true);
  });

  test("should open Nueva modal and create a postulación", async ({ page }) => {
    await page.getByRole("button", { name: "Nueva" }).click();

    // Modal should appear
    await expect(page.getByRole("dialog", { name: "Nueva postulacion" })).toBeVisible();

    // Fill in form
    await page.getByLabel(/empresa/i).fill("Test Company E2E");
    await page.getByLabel(/estado/i).selectOption("entrevista");

    await page.getByRole("button", { name: "Crear" }).click();

    // After submit, modal should close and company should appear in table
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("Test Company E2E")).toBeVisible();
  });

  test("should edit an existing postulación", async ({ page }) => {
    // Create one first via API call is not available in E2E, so just click edit on first row
    // If table is empty, create first
    const isEmpty = await page.getByText("Sin postulaciones").isVisible().catch(() => false);
    if (isEmpty) {
      await page.getByRole("button", { name: "Nueva" }).click();
      await page.getByLabel(/empresa/i).fill("Edit Me");
      await page.getByRole("button", { name: "Crear" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }

    // Click the edit (pencil) icon on the first row
    await page.locator("table tbody tr").first().getByTitle("Editar").click();

    await expect(page.getByRole("dialog", { name: "Editar postulacion" })).toBeVisible();

    // Change the company name
    const empresaInput = page.getByLabel(/empresa/i);
    await empresaInput.clear();
    await empresaInput.fill("Updated Company E2E");

    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("Updated Company E2E")).toBeVisible();
  });

  test("should delete a postulación after confirmation", async ({ page }) => {
    // Create if table is empty
    const isEmpty = await page.getByText("Sin postulaciones").isVisible().catch(() => false);
    if (isEmpty) {
      await page.getByRole("button", { name: "Nueva" }).click();
      await page.getByLabel(/empresa/i).fill("Delete Me E2E");
      await page.getByRole("button", { name: "Crear" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }

    const initialCount = await page.locator("table tbody tr").count();

    // Click the delete (trash) icon on the first row
    await page.locator("table tbody tr").first().getByTitle("Eliminar").click();

    await expect(page.getByRole("dialog", { name: "Confirmar eliminacion" })).toBeVisible();
    await page.getByRole("button", { name: "Eliminar" }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Count should decrease by 1 OR show empty state
    const newCount = await page.locator("table tbody tr").count();
    const nowEmpty = await page.getByText("Sin postulaciones").isVisible().catch(() => false);
    expect(newCount < initialCount || nowEmpty).toBe(true);
  });

  test("should close modal when clicking backdrop", async ({ page }) => {
    await page.getByRole("button", { name: "Nueva" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Click the backdrop (outside the modal card)
    await page.locator(".modal-backdrop").click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

test.describe("Search and Filters", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should filter by search text", async ({ page }) => {
    // Create a uniquely-named application to search for
    await page.getByRole("button", { name: "Nueva" }).click();
    await page.getByLabel(/empresa/i).fill("UniqueSearchTermXYZ");
    await page.getByRole("button", { name: "Crear" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Type in search
    await page.getByPlaceholder(/buscar/i).fill("UniqueSearchTermXYZ");

    await expect(page.getByText("UniqueSearchTermXYZ")).toBeVisible();

    // Search for something that doesn't match
    await page.getByPlaceholder(/buscar/i).fill("ZZZNOMATCH999");
    await expect(page.getByText("Sin resultados")).toBeVisible();
  });

  test("should filter by status button", async ({ page }) => {
    // Create application with known status
    await page.getByRole("button", { name: "Nueva" }).click();
    await page.getByLabel(/empresa/i).fill("StatusFilterTest");
    await page.getByLabel(/estado/i).selectOption("rechazado");
    await page.getByRole("button", { name: "Crear" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Filter by "Entrevista" — should hide our "rechazado" app
    await page.getByRole("button", { name: "Entrevista" }).click();
    await expect(page.getByText("StatusFilterTest")).not.toBeVisible();

    // Filter by "Rechazado" — should show our app
    await page.getByRole("button", { name: "Rechazado" }).click();
    await expect(page.getByText("StatusFilterTest")).toBeVisible();

    // Reset to "Todos"
    await page.getByRole("button", { name: "Todos" }).click();
    await expect(page.getByText("StatusFilterTest")).toBeVisible();
  });
});

test.describe("Dark / Light mode toggle", () => {
  test("should toggle theme and persist preference", async ({ page }) => {
    await page.goto("/");

    const html = page.locator("html");
    const initialTheme = await html.getAttribute("data-theme");

    // Click the theme toggle button
    await page.getByRole("button", { name: /modo/i }).click();

    const newTheme = await html.getAttribute("data-theme");
    expect(newTheme).not.toBe(initialTheme);
    expect(["light", "dark"]).toContain(newTheme);

    // Reload and verify the preference is persisted
    await page.reload();
    const persistedTheme = await html.getAttribute("data-theme");
    expect(persistedTheme).toBe(newTheme);
  });
});
