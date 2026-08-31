import { expect, test } from "@playwright/test";

test.describe("Authentication and Navigation", () => {
  test("loads landing page with branding and accessible controls", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Roll or Die/i);

    // Form inputs and buttons are visible
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.getByRole("button", { name: /enter the table/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test("toggles between Login and Registration forms smoothly", async ({ page }) => {
    await page.goto("/");

    const registerButton = page.getByRole("button", { name: /^register$/i });
    await expect(registerButton).toBeVisible();
    await registerButton.click();

    // In registration mode, name input and create account button should be present
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();

    // Toggle back to login mode
    const loginButton = page.getByRole("button", { name: /^login$/i });
    await loginButton.click();
    await expect(page.getByRole("button", { name: /enter the table/i })).toBeVisible();
  });
});
