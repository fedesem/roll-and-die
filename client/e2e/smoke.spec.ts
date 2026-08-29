import { expect, test } from "@playwright/test";

test.describe("Roll or Die Smoke Tests", () => {
  test("loads landing page and presents authentication form", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Roll or Die/i);
    await expect(page.getByRole("button", { name: /enter table/i })).toBeVisible();
  });

  test("allows toggling between login and register modes", async ({ page }) => {
    await page.goto("/");
    const modeSwitchButton = page.getByRole("button", { name: /create one/i });
    if (await modeSwitchButton.isVisible()) {
      await modeSwitchButton.click();
      await expect(page.getByPlaceholder(/your display name/i)).toBeVisible();
    }
  });
});
