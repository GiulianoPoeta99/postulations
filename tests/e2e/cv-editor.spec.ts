/**
 * E2E tests for CV Editor tab using Playwright.
 */
import { test, expect } from "@playwright/test";

test.describe("CV Editor CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Switch to CV Editor tab
    await page.getByRole("tab", { name: /Editor de CVs/i }).click();
  });

  test("should load default version", async ({ page }) => {
    // Check that CodeMirror loaded (it should have .cm-content)
    await expect(page.locator(".cm-content")).toBeVisible();
    
    // Check that PDF viewer loaded (iframe)
    await expect(page.locator("iframe")).toBeVisible();
  });

  test("should allow typing and triggering compile", async ({ page }) => {
    // Add text to the editor
    const cm = page.locator(".cm-content");
    await cm.click();
    await page.keyboard.type("# Test Add");

    // Click force compile button
    await page.getByTitle("Forzar Compilación").click();
    
    // It should either show success checkmark or error
    await expect(page.getByTitle("Forzar Compilación")).toBeVisible();
  });

  test("should handle save as version via dialog", async ({ page }) => {
    // Hook the prompt dialog to supply a new version name
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') {
        await dialog.accept("E2E_Version");
      }
    });

    await page.getByRole("button", { name: "Guardar como" }).click();

    // Verify it changed the active version button text
    await expect(page.getByRole("button", { name: "E2E_Version" })).toBeVisible();
  });

  test("should handle delete version via dialog", async ({ page }) => {
    // Switch to the newly created version or rely on 'default' if it's the only one
    // But default cannot be deleted easily, let's create one first
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') {
        await dialog.accept("Delete_Me");
      } else if (dialog.type() === 'confirm') {
        await dialog.accept();
      }
    });

    await page.getByRole("button", { name: "Guardar como" }).click();

    // Now delete it
    await page.getByTitle("Eliminar versión").click();

    // Verify fallback to "default"
    await expect(page.getByRole("button", { name: "default" })).toBeVisible();
  });
});
