const transporter = require("../utils/mailer");

function buildActivationUrl(token) {
  const raw = (process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
  if (!raw) return null;
  const base = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return `${base}/activate?token=${encodeURIComponent(token)}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const EmailService = {
  /**
   * @param {string} email
   * @param {string} token
   * @returns {Promise<boolean>} true if sent, false on validation or send failure
   */
  async sendMagicLink(email, token) {
    try {
      if (!email || typeof email !== "string" || !email.trim()) {
        console.error("EmailService.sendMagicLink: invalid or missing email");
        return false;
      }
      if (!token || typeof token !== "string") {
        console.error("EmailService.sendMagicLink: invalid or missing token");
        return false;
      }

      const to = email.trim();
      const from = process.env.MAIL_FROM || process.env.BREVO_SMTP_USER;
      if (!from) {
        console.error(
          "EmailService.sendMagicLink: MAIL_FROM or BREVO_SMTP_USER is required"
        );
        return false;
      }

      const url = buildActivationUrl(token);
      if (!url) {
        console.error(
          "EmailService.sendMagicLink: FRONTEND_URL is required to build activation link"
        );
        return false;
      }

      const safeUrl = escapeHtml(url);

      const mailOptions = {
        from,
        to,
        subject: "Activate your Sawaka account",
        text: `Click the following link to activate your account: ${url}`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Activate your account</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:32px 28px 8px 28px;">
              <p style="margin:0;font-size:18px;font-weight:600;color:#18181b;">Activate your Sawaka account</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 8px 28px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#3f3f46;">Click the button below to confirm your email and activate your account.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 8px 28px;" align="center">
              <a href="${url}" style="display:inline-block;padding:12px 28px;background-color:#734c2c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;">Activate account</a>
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
</html>`.trim(),
      };

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
      console.error("EmailService.sendMagicLink: sendMail failed", {
        message: lastErr && lastErr.message,
        code: lastErr && lastErr.code,
        stack: lastErr && lastErr.stack,
      });
      return false;
    } catch (err) {
      console.error("EmailService.sendMagicLink: sendMail failed", {
        message: err && err.message,
        code: err && err.code,
        stack: err && err.stack,
      });
      return false;
    }
  },
};

module.exports = EmailService;
