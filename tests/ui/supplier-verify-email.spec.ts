import { test, expect, type Page, type Route } from "@playwright/test";

async function mockVerify(
  page: Page,
  options: { status?: number } = {}
) {
  await page.route("**/api/suppliers/contact-email/verify", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const status = options.status ?? 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status === 200
          ? { success: true }
          : { error: "Invalid magic link" }
      ),
    });
  });
}

test.describe("Supplier contact email verification page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
  });

  test("shows success after a valid verification token", async ({ page }) => {
    await mockVerify(page);
    await page.goto("/supplier/verify-email?token=valid-verify-token");

    await expect(page.getByTestId("supplier-verify-email-success")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText(/contact email has been verified/i)
    ).toBeVisible();
  });

  test("shows error for an invalid verification token", async ({ page }) => {
    await mockVerify(page, { status: 400 });
    await page.goto("/supplier/verify-email?token=bad-token");

    await expect(page.getByTestId("supplier-verify-email-error")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText(/invalid or has expired/i)
    ).toBeVisible();
  });

  test("posts the token from the URL to the verification endpoint", async ({
    page,
  }) => {
    const sentTokens: string[] = [];
    await page.route(
      "**/api/suppliers/contact-email/verify",
      async (route: Route) => {
        const payload = route.request().postDataJSON() as { token?: string };
        sentTokens.push(payload?.token ?? "");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      }
    );

    await page.goto("/supplier/verify-email?token=valid-verify-token");

    await expect(page.getByTestId("supplier-verify-email-success")).toBeVisible({
      timeout: 10000,
    });
    expect(sentTokens).toEqual(["valid-verify-token"]);
  });

  test("retrying after a server error can succeed", async ({ page }) => {
    let attempts = 0;
    await page.route(
      "**/api/suppliers/contact-email/verify",
      async (route: Route) => {
        attempts += 1;
        const failing = attempts === 1;
        await route.fulfill({
          status: failing ? 500 : 200,
          contentType: "application/json",
          body: JSON.stringify(
            failing ? { error: "Server error" } : { success: true }
          ),
        });
      }
    );

    await page.goto("/supplier/verify-email?token=retry-token");
    await expect(page.getByTestId("supplier-verify-email-error")).toBeVisible({
      timeout: 10000,
    });

    await page.getByTestId("supplier-verify-email-retry").click();
    await expect(page.getByTestId("supplier-verify-email-success")).toBeVisible();
  });

  test("a missing token shows the error state without calling the API", async ({
    page,
  }) => {
    let called = false;
    await page.route(
      "**/api/suppliers/contact-email/verify",
      async (route: Route) => {
        called = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      }
    );

    await page.goto("/supplier/verify-email");

    await expect(page.getByTestId("supplier-verify-email-error")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("supplier-verify-email-retry")).toHaveCount(0);
    expect(called).toBe(false);
  });
});
