jest.mock("../../utils/mailer");

const transporter = require("../../utils/mailer");
const EmailService = require("../../services/EmailService");

function expectedActivationUrl(frontendBase, token) {
  const raw = String(frontendBase).trim().replace(/\/$/, "");
  const base = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return `${base}/activate?token=${encodeURIComponent(token)}`;
}

describe("EmailService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = "https://app.example.com";
    process.env.MAIL_FROM = "noreply@example.com";
    delete process.env.BREVO_SMTP_USER;
    delete process.env.BREVO_SMTP_PASSWORD;
    delete process.env.STRIPE_SECRET_KEY;
  });

  describe("sendMagicLink", () => {
    it("succeeds and calls transporter.sendMail with from, to, subject and activation link", async () => {
      transporter.sendMail.mockResolvedValue({ messageId: "ok" });
      const token = "magic-token-abc";
      const email = "  user@example.com  ";

      const result = await EmailService.sendMagicLink(email, token);

      expect(result).toBe(true);
      expect(transporter.sendMail).toHaveBeenCalledTimes(1);
      const mailOpts = transporter.sendMail.mock.calls[0][0];

      expect(mailOpts).toEqual(
        expect.objectContaining({
          from: "noreply@example.com",
          to: "user@example.com",
          subject: "Activate your Sawaka account",
        })
      );

      const url = expectedActivationUrl(
        process.env.FRONTEND_URL,
        token
      );
      expect(url).toMatch(/\/activate\?token=/);
      expect(mailOpts.text).toBe(
        `Click the following link to activate your account: ${url}`
      );
      expect(mailOpts.html).toContain(url);
      expect(mailOpts.html).toContain(`href="${url}"`);
    });

    it("retries sendMail on failure then succeeds with the same mail payload each attempt", async () => {
      transporter.sendMail
        .mockRejectedValueOnce(new Error("temporary smtp failure"))
        .mockResolvedValueOnce({ messageId: "ok" });

      const result = await EmailService.sendMagicLink(
        "user@example.com",
        "the-token"
      );

      expect(result).toBe(true);
      expect(transporter.sendMail).toHaveBeenCalledTimes(2);

      const first = transporter.sendMail.mock.calls[0][0];
      const second = transporter.sendMail.mock.calls[1][0];
      expect(first).toEqual(second);
      expect(transporter.sendMail).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          to: "user@example.com",
          from: "noreply@example.com",
        })
      );
      expect(transporter.sendMail).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          to: "user@example.com",
          from: "noreply@example.com",
        })
      );
    });

    it("builds /activate?token= with encodeURIComponent for special characters", async () => {
      transporter.sendMail.mockResolvedValue({});
      const token = "a b+c/d?x=1&y=2";
      await EmailService.sendMagicLink("u@example.org", token);

      const mailOpts = transporter.sendMail.mock.calls[0][0];
      const expected = expectedActivationUrl(process.env.FRONTEND_URL, token);
      expect(expected).toContain("/activate?token=");
      expect(expected).toContain(encodeURIComponent(token));
      expect(mailOpts.text).toContain(expected);
      expect(mailOpts.html).toContain(expected);
    });

    it("does not include unrelated secrets in text or html bodies", async () => {
      process.env.BREVO_SMTP_PASSWORD = "smtp-secret-do-not-leak";
      process.env.STRIPE_SECRET_KEY = "sk_test_do_not_leak";
      transporter.sendMail.mockResolvedValue({});

      await EmailService.sendMagicLink("user@example.com", "public-token");

      const mailOpts = transporter.sendMail.mock.calls[0][0];
      const combined = `${mailOpts.text}\n${mailOpts.html}`;
      expect(combined).not.toContain("smtp-secret-do-not-leak");
      expect(combined).not.toContain("sk_test_do_not_leak");
      expect(combined).toContain("public-token");
    });

    it("returns false when email is missing or blank", async () => {
      await expect(EmailService.sendMagicLink("", "tok")).resolves.toBe(false);
      await expect(EmailService.sendMagicLink("   ", "tok")).resolves.toBe(
        false
      );
      expect(transporter.sendMail).not.toHaveBeenCalled();
    });

    it("returns false when token is missing or not a string", async () => {
      await expect(
        EmailService.sendMagicLink("user@example.com", "")
      ).resolves.toBe(false);
      await expect(
        EmailService.sendMagicLink("user@example.com", null)
      ).resolves.toBe(false);
      expect(transporter.sendMail).not.toHaveBeenCalled();
    });

    it("returns false when MAIL_FROM and BREVO_SMTP_USER are unset", async () => {
      delete process.env.MAIL_FROM;
      delete process.env.BREVO_SMTP_USER;
      const result = await EmailService.sendMagicLink(
        "user@example.com",
        "the-token"
      );
      expect(result).toBe(false);
      expect(transporter.sendMail).not.toHaveBeenCalled();
    });

    it("returns false when FRONTEND_URL is missing", async () => {
      delete process.env.FRONTEND_URL;
      const result = await EmailService.sendMagicLink(
        "user@example.com",
        "the-token"
      );
      expect(result).toBe(false);
      expect(transporter.sendMail).not.toHaveBeenCalled();
    });

    it("returns false when sendMail fails after all retries", async () => {
      transporter.sendMail.mockRejectedValue(
        new Error("SMTP permanent failure")
      );
      const result = await EmailService.sendMagicLink(
        "user@example.com",
        "the-token"
      );
      expect(result).toBe(false);
      expect(transporter.sendMail).toHaveBeenCalledTimes(3);
    });
  });
});
