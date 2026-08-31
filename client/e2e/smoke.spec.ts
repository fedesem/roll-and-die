import { expect, test } from "@playwright/test";

test.describe("Roll or Die Smoke Tests", () => {
  test("loads landing page and presents authentication form", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Roll or Die/i);
    await expect(page.getByRole("button", { name: /enter the table/i })).toBeVisible();
  });

  test("allows toggling between login and register modes", async ({ page }) => {
    await page.goto("/");
    const registerTab = page.getByRole("button", { name: /^register$/i });
    await expect(registerTab).toBeVisible();
    await registerTab.click();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();

    const loginTab = page.getByRole("button", { name: /^login$/i });
    await loginTab.click();
    await expect(page.getByRole("button", { name: /enter the table/i })).toBeVisible();
  });
});
