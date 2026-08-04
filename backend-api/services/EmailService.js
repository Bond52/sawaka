const transporter = require("../utils/mailer");
const {
  buildSupplierActivationUrl,
  buildSupplierManagementUrl,
  buildContactEmailVerificationUrl,
} = require("../utils/supplierActivationUrl");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMagicLinkHtml({ title, intro, ctaLabel, link }) {
  const safeUrl = escapeHtml(link);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:32px 28px 8px 28px;">
              <p style="margin:0;font-size:18px;font-weight:600;color:#18181b;">${escapeHtml(title)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 8px 28px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#3f3f46;">${escapeHtml(intro)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 8px 28px;" align="center">
              <a href="${link}" style="display:inline-block;padding:12px 28px;background-color:#734c2c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;">${escapeHtml(ctaLabel)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px 28px;">
              <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:#71717a;">Or copy and paste this link into your browser:</p>
              <p style="margin:0;word-break:break-all;font-size:13px;line-height:1.5;color:#52525b;">${safeUrl}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function resolveFromAddress() {
  return process.env.MAIL_FROM || process.env.BREVO_SMTP_USER;
}

/**
 * Shared SMTP delivery with the same retry behavior for all magic-link emails.
 * @returns {Promise<boolean>}
 */
async function sendWithRetry(mailOptions, logLabel) {
  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      return true;
    } catch (err) {
      lastErr = err;
    }
  }
  console.error(`${logLabel}: sendMail failed`, {
    message: lastErr && lastErr.message,
    code: lastErr && lastErr.code,
    stack: lastErr && lastErr.stack,
  });
  return false;
}

/**
 * @param {string} email
 * @param {string} token
 * @param {{
 *   subject: string,
 *   title: string,
 *   intro: string,
 *   ctaLabel: string,
 *   buildUrl: (token: string) => string,
 *   logLabel: string,
 * }} template
 * @returns {Promise<boolean>}
 */
async function sendTemplatedMagicLink(email, token, template) {
  try {
    if (!email || typeof email !== "string" || !email.trim()) {
      console.error(`${template.logLabel}: invalid or missing email`);
      return false;
    }
    if (!token || typeof token !== "string") {
      console.error(`${template.logLabel}: invalid or missing token`);
      return false;
    }

    const to = email.trim();
    const from = resolveFromAddress();
    if (!from) {
      console.error(
        `${template.logLabel}: MAIL_FROM or BREVO_SMTP_USER is required`
      );
      return false;
    }

    const link = template.buildUrl(token);
    const textLead = template.textIntro || template.intro;
    const mailOptions = {
      from,
      to,
      subject: template.subject,
      headers: {
        "X-Mailin-track": "0",
      },
      text: `${textLead} ${link}`,
      html: buildMagicLinkHtml({
        title: template.title,
        intro: template.intro,
        ctaLabel: template.ctaLabel,
        link,
      }),
    };

    return await sendWithRetry(mailOptions, template.logLabel);
  } catch (err) {
    console.error(`${template.logLabel}: sendMail failed`, {
      message: err && err.message,
      code: err && err.code,
      stack: err && err.stack,
    });
    return false;
  }
}

const ACTIVATION_TEMPLATE = {
  subject: "Activate your Sawaka account",
  title: "Activate your Sawaka account",
  textIntro: "Click the following link to activate your account:",
  intro:
    "Click the button below to confirm your email and activate your account.",
  ctaLabel: "Activate account",
  buildUrl: buildSupplierActivationUrl,
  logLabel: "EmailService.sendSupplierActivationEmail",
};

const MANAGEMENT_TEMPLATE = {
  subject: "Access your Sawaka supplier account",
  title: "Manage your Sawaka supplier account",
  intro:
    "Click the button below to securely access and manage your supplier account.",
  ctaLabel: "Manage account",
  buildUrl: buildSupplierManagementUrl,
  logLabel: "EmailService.sendSupplierManagementEmail",
};

const CONTACT_EMAIL_TEMPLATE = {
  subject: "Verify your contact email on Sawaka",
  title: "Verify your contact email",
  intro:
    "Click the button below to confirm this contact email for your supplier profile.",
  ctaLabel: "Verify email",
  buildUrl: buildContactEmailVerificationUrl,
  logLabel: "EmailService.sendContactEmailVerification",
};

const EmailService = {
  /**
   * @param {string} email
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async sendSupplierActivationEmail(email, token) {
    return sendTemplatedMagicLink(email, token, ACTIVATION_TEMPLATE);
  },

  /**
   * @param {string} email
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async sendSupplierManagementEmail(email, token) {
    return sendTemplatedMagicLink(email, token, MANAGEMENT_TEMPLATE);
  },

  /**
   * @param {string} email
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async sendContactEmailVerification(email, token) {
    return sendTemplatedMagicLink(email, token, CONTACT_EMAIL_TEMPLATE);
  },

  /**
   * Backward-compatible alias for supplier activation emails.
   * @param {string} email
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async sendMagicLink(email, token) {
    return EmailService.sendSupplierActivationEmail(email, token);
  },
};

module.exports = EmailService;
