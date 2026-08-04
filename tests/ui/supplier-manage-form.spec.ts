import { test, expect, type Page, type Route } from "@playwright/test";

const SUPPLIER_ID = "65a1b2c3d4e5f678901234ab";
const MANAGEMENT_JWT = "mgmt-session-jwt";

const EDITABLE_SUPPLIER = {
  id: SUPPLIER_ID,
  name: "BoisPlus Cameroun",
  categories: ["wood_lumber"],
  country: "Cameroun",
  region: "Littoral",
  city: "Douala",
  address: "12 rue des Scieries",
  postalCode: "0000",
  accountEmail: "compte@boisplus.cm",
  publicEmail: "ventes@boisplus.cm",
  phone: "+237 699 55 44 33",
  website: "https://boisplus.cm",
};

const PENDING_EMAIL = "nouveau@boisplus.cm";

type MockOptions = {
  getStatus?: number;
  patchStatus?: number;
  /** Serves the profile with a contact email awaiting verification. */
  pendingContactEmail?: string;
  /** Makes PATCH answer with `emailVerificationPending`. */
  patchPendingEmail?: string;
  resendStatus?: number;
  cancelStatus?: number;
};

async function mockManagementApis(page: Page, options: MockOptions = {}) {
  await page.route("**/api/suppliers/**", async (route: Route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    if (url.includes("/api/suppliers/management/contact-email/resend")) {
      const status = options.resendStatus ?? 200;
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(
          status === 200 ? { success: true } : { error: "Resend failed" }
        ),
      });
      return;
    }

    if (url.includes("/api/suppliers/management/contact-email/cancel")) {
      const status = options.cancelStatus ?? 200;
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(
          status === 200
            ? { supplier: EDITABLE_SUPPLIER }
            : { error: "Cancel failed" }
        ),
      });
      return;
    }

    if (url.includes("/api/suppliers/management")) {
      if (method === "GET") {
        const status = options.getStatus ?? 200;
        await route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(
            status === 200
              ? options.pendingContactEmail
                ? {
                    ...EDITABLE_SUPPLIER,
                    pendingContactEmail: options.pendingContactEmail,
                  }
                : EDITABLE_SUPPLIER
              : { error: "Session expired" }
          ),
        });
        return;
      }

      if (method === "PATCH") {
        const status = options.patchStatus ?? 200;
        const patch = request.postDataJSON() as Record<string, unknown>;
        const pending = options.patchPendingEmail;
        await route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(
            status !== 200
              ? { error: "Update failed" }
              : pending
                ? {
                    supplier: {
                      ...EDITABLE_SUPPLIER,
                      ...patch,
                      accountEmail: EDITABLE_SUPPLIER.accountEmail,
                      pendingContactEmail: pending,
                    },
                    emailVerificationPending: true,
                  }
                : { supplier: { ...EDITABLE_SUPPLIER, ...patch } }
          ),
        });
        return;
      }
    }

    if (method === "GET" && url.includes(`/api/suppliers/${SUPPLIER_ID}`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(EDITABLE_SUPPLIER),
      });
      return;
    }

    await route.continue();
  });
}

test.describe("Supplier management edit form", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((jwt) => {
      window.localStorage.setItem("sawaka-locale", "en");
      window.localStorage.setItem("supplierManagementJwt", jwt);
    }, MANAGEMENT_JWT);
  });

  test("pre-populates the form from the management API", async ({ page }) => {
    await mockManagementApis(page);
    await page.goto("/supplier/manage");

    await expect(page.getByTestId("manage-supplier-form")).toBeVisible({
      timeout: 10000,
    });

    await expect(page.getByTestId("manage-supplier-input-name")).toHaveValue(
      EDITABLE_SUPPLIER.name
    );
    await expect(page.getByTestId("manage-supplier-input-country")).toHaveValue(
      EDITABLE_SUPPLIER.country
    );
    await expect(page.getByTestId("manage-supplier-input-city")).toHaveValue(
      EDITABLE_SUPPLIER.city
    );
    await expect(page.getByTestId("manage-supplier-input-phone")).toHaveValue(
      EDITABLE_SUPPLIER.phone
    );
    await expect(
      page.getByTestId("manage-supplier-input-account-email")
    ).toHaveValue(EDITABLE_SUPPLIER.accountEmail);
    await expect(
      page.getByTestId("manage-supplier-input-public-email")
    ).toHaveValue(EDITABLE_SUPPLIER.publicEmail);
    await expect(page.getByTestId("manage-supplier-input-website")).toHaveValue(
      EDITABLE_SUPPLIER.website
    );
    await expect(
      page.getByTestId("manage-supplier-category-wood_lumber")
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("save stays disabled until the form is dirty", async ({ page }) => {
    await mockManagementApis(page);
    await page.goto("/supplier/manage");

    const save = page.getByTestId("manage-supplier-save");
    await expect(save).toBeDisabled({ timeout: 10000 });
    await expect(page.getByTestId("manage-supplier-save-hint")).toBeVisible();

    await page.getByTestId("manage-supplier-input-city").fill("Yaoundé");
    await expect(save).toBeEnabled();

    await page
      .getByTestId("manage-supplier-input-city")
      .fill(EDITABLE_SUPPLIER.city);
    await expect(save).toBeDisabled();
  });

  test("saving a change shows success feedback", async ({ page }) => {
    await mockManagementApis(page);
    await page.goto("/supplier/manage");

    await expect(page.getByTestId("manage-supplier-form")).toBeVisible({
      timeout: 10000,
    });
    await page.getByTestId("manage-supplier-input-city").fill("Yaoundé");
    await page.getByTestId("manage-supplier-save").click();

    await expect(page.getByTestId("manage-supplier-success")).toBeVisible();
    await expect(page.getByTestId("manage-supplier-input-city")).toHaveValue(
      "Yaoundé"
    );
    await expect(page.getByTestId("manage-supplier-save")).toBeDisabled();
  });

  test("invalid values block saving", async ({ page }) => {
    await mockManagementApis(page);
    await page.goto("/supplier/manage");

    await expect(page.getByTestId("manage-supplier-form")).toBeVisible({
      timeout: 10000,
    });

    await page.getByTestId("manage-supplier-input-name").fill("");
    await expect(page.getByTestId("manage-supplier-error-name")).toBeVisible();
    await expect(page.getByTestId("manage-supplier-save")).toBeDisabled();

    await page.getByTestId("manage-supplier-input-name").fill("BoisPlus SARL");
    await page.getByTestId("manage-supplier-input-phone").fill("123");
    await expect(page.getByTestId("manage-supplier-error-phone")).toBeVisible();
    await expect(page.getByTestId("manage-supplier-save")).toBeDisabled();

    await page
      .getByTestId("manage-supplier-input-phone")
      .fill(EDITABLE_SUPPLIER.phone);
    await expect(page.getByTestId("manage-supplier-save")).toBeEnabled();
  });

  test("cancel with unsaved changes asks for confirmation", async ({ page }) => {
    await mockManagementApis(page);
    await page.goto("/supplier/manage");

    await expect(page.getByTestId("manage-supplier-form")).toBeVisible({
      timeout: 10000,
    });
    await page.getByTestId("manage-supplier-input-name").fill("BoisPlus SARL");
    await page.getByTestId("manage-supplier-cancel").click();

    const dialog = page.getByTestId("manage-supplier-discard-dialog");
    await expect(dialog).toBeVisible();

    await page.getByTestId("manage-supplier-discard-cancel").click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId("manage-supplier-input-name")).toHaveValue(
      "BoisPlus SARL"
    );

    await page.getByTestId("manage-supplier-cancel").click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    await page.getByTestId("manage-supplier-cancel").click();
    await page.getByTestId("manage-supplier-discard-confirm").click();
    await expect(page).toHaveURL(new RegExp(`/fournisseurs/${SUPPLIER_ID}$`));
  });

  test("cancel without changes leaves immediately", async ({ page }) => {
    await mockManagementApis(page);
    await page.goto("/supplier/manage");

    await expect(page.getByTestId("manage-supplier-form")).toBeVisible({
      timeout: 10000,
    });
    await page.getByTestId("manage-supplier-cancel").click();

    await expect(
      page.getByTestId("manage-supplier-discard-dialog")
    ).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/fournisseurs/${SUPPLIER_ID}$`));
  });

  test("shows the pending verification banner for a pending contact email", async ({
    page,
  }) => {
    await mockManagementApis(page, { pendingContactEmail: PENDING_EMAIL });
    await page.goto("/supplier/manage");

    const banner = page.getByTestId("manage-supplier-pending-email");
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByTestId("manage-supplier-pending-email-body")
    ).toContainText(PENDING_EMAIL);
    await expect(
      page.getByTestId("manage-supplier-input-account-email")
    ).toHaveValue(EDITABLE_SUPPLIER.accountEmail);
    await expect(
      page.getByTestId("manage-supplier-input-account-email")
    ).toBeEditable();
  });

  test("changing the account email shows the partial success notice", async ({
    page,
  }) => {
    await mockManagementApis(page, { patchPendingEmail: PENDING_EMAIL });
    await page.goto("/supplier/manage");

    await expect(page.getByTestId("manage-supplier-form")).toBeVisible({
      timeout: 10000,
    });
    await page
      .getByTestId("manage-supplier-input-account-email")
      .fill(PENDING_EMAIL);
    await page.getByTestId("manage-supplier-save").click();

    await expect(
      page.getByTestId("manage-supplier-saved-pending-email")
    ).toBeVisible();
    await expect(page.getByTestId("manage-supplier-success")).toHaveCount(0);
    await expect(page.getByTestId("manage-supplier-pending-email")).toBeVisible();
  });

  test("resending the verification email reports success", async ({ page }) => {
    await mockManagementApis(page, { pendingContactEmail: PENDING_EMAIL });
    await page.goto("/supplier/manage");

    await expect(page.getByTestId("manage-supplier-pending-email")).toBeVisible({
      timeout: 10000,
    });
    await page.getByTestId("manage-supplier-pending-email-resend").click();

    await expect(
      page.getByTestId("manage-supplier-pending-email-feedback")
    ).toBeVisible();
    await expect(page.getByTestId("manage-supplier-pending-email")).toBeVisible();
  });

  test("a failed resend reports an error", async ({ page }) => {
    await mockManagementApis(page, {
      pendingContactEmail: PENDING_EMAIL,
      resendStatus: 500,
    });
    await page.goto("/supplier/manage");

    await expect(page.getByTestId("manage-supplier-pending-email")).toBeVisible({
      timeout: 10000,
    });
    await page.getByTestId("manage-supplier-pending-email-resend").click();

    const feedback = page.getByTestId("manage-supplier-pending-email-feedback");
    await expect(feedback).toBeVisible();
    await expect(feedback).toHaveAttribute("role", "alert");
  });

  test("cancelling the email change removes the banner", async ({ page }) => {
    await mockManagementApis(page, { pendingContactEmail: PENDING_EMAIL });
    await page.goto("/supplier/manage");

    await expect(page.getByTestId("manage-supplier-pending-email")).toBeVisible({
      timeout: 10000,
    });
    await page.getByTestId("manage-supplier-pending-email-cancel").click();

    await expect(page.getByTestId("manage-supplier-pending-email")).toHaveCount(
      0
    );
    await expect(
      page.getByTestId("manage-supplier-pending-email-feedback")
    ).toBeVisible();
    await expect(
      page.getByTestId("manage-supplier-input-account-email")
    ).toHaveValue(EDITABLE_SUPPLIER.accountEmail);
  });

  test("expired session shows the session expired message", async ({ page }) => {
    await mockManagementApis(page, { getStatus: 401 });
    await page.goto("/supplier/manage");

    await expect(
      page.getByTestId("supplier-manage-session-expired")
    ).toBeVisible({ timeout: 10000 });
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("supplierManagementJwt")
    );
    expect(stored).toBeNull();
  });
});
