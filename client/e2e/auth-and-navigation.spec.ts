import { expect, test } from "@playwright/test";

test.describe("Authentication and Navigation", () => {
  test("loads landing page with branding and accessible controls", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Roll or Die/i);

    // Form inputs and buttons are visible
    const usernameInput = page.getByRole("textbox", { name: /username/i });
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.getByRole("button", { name: /enter table/i });

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test("toggles between Login and Registration forms smoothly", async ({ page }) => {
    await page.goto("/");

    const modeSwitchButton = page.getByRole("button", { name: /create one/i });
    if (await modeSwitchButton.isVisible()) {
      await modeSwitchButton.click();

      // In registration mode, display name input should be present
      await expect(page.getByPlaceholder(/your display name/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /join table/i })).toBeVisible();

      // Toggle back to login mode
      const backToLoginButton = page.getByRole("button", { name: /sign in instead/i });
      if (await backToLoginButton.isVisible()) {
        await backToLoginButton.click();
        await expect(page.getByRole("button", { name: /enter table/i })).toBeVisible();
      }
    }
  });
});
