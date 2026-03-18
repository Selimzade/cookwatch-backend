const nodemailer = require('nodemailer');

// ── Transport ─────────────────────────────────────────────────────────────────
// Supports any SMTP provider.
// Set in .env (local dev) or Railway Variables panel (production):
//   EMAIL_HOST=smtp.gmail.com
//   EMAIL_PORT=587
//   EMAIL_USER=you@gmail.com
//   EMAIL_PASS=yourAppPassword
//   EMAIL_FROM="CookWatch <you@gmail.com>"
//
// For Gmail: create an App Password at
// https://myaccount.google.com/apppasswords (2-FA must be enabled)

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST  || 'smtp.gmail.com',
    port:   Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
}

// ── Generate 6-digit OTP ─────────────────────────────────────────────────────
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Send registration OTP ────────────────────────────────────────────────────
async function sendRegisterOtp(email, otp) {
  const from = process.env.EMAIL_FROM || `"CookWatch" <${process.env.EMAIL_USER}>`;

  await getTransporter().sendMail({
    from,
    to: email,
    subject: 'CookWatch - Hesabınızı təsdiqləyin',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:16px;border:1px solid #e2e8f0">
        <div style="text-align:center;margin-bottom:24px">
          <span style="font-size:48px">🍳</span>
          <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:8px 0 4px">CookWatch</h1>
          <p style="font-size:14px;color:#64748b;margin:0">Hesabınızı təsdiqləyin</p>
        </div>
        <p style="font-size:15px;color:#334155;margin-bottom:24px">
          Qeydiyyatı tamamlamaq üçün aşağıdakı OTP kodunu daxil edin. Kod <strong>10 dəqiqə</strong> ərzində etibarlıdır.
        </p>
        <div style="background:#f1f5f9;border-radius:12px;padding:20px;text-align:center;letter-spacing:12px;font-size:36px;font-weight:700;color:#0f172a;margin-bottom:24px">
          ${otp}
        </div>
        <p style="font-size:13px;color:#94a3b8;text-align:center">
          Bu e-poçtu siz göndərməmisinizsə, lütfən nəzərə almayın.
        </p>
      </div>
    `,
  });
}

// ── Send password-reset OTP ──────────────────────────────────────────────────
async function sendResetOtp(email, otp) {
  const from = process.env.EMAIL_FROM || `"CookWatch" <${process.env.EMAIL_USER}>`;

  await getTransporter().sendMail({
    from,
    to: email,
    subject: 'CookWatch - Şifrə bərpası',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:16px;border:1px solid #e2e8f0">
        <div style="text-align:center;margin-bottom:24px">
          <span style="font-size:48px">🔑</span>
          <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:8px 0 4px">Şifrə bərpası</h1>
          <p style="font-size:14px;color:#64748b;margin:0">CookWatch</p>
        </div>
        <p style="font-size:15px;color:#334155;margin-bottom:24px">
          Yeni şifrə təyin etmək üçün aşağıdakı OTP kodunu daxil edin. Kod <strong>10 dəqiqə</strong> ərzində etibarlıdır.
        </p>
        <div style="background:#f1f5f9;border-radius:12px;padding:20px;text-align:center;letter-spacing:12px;font-size:36px;font-weight:700;color:#0f172a;margin-bottom:24px">
          ${otp}
        </div>
        <p style="font-size:13px;color:#94a3b8;text-align:center">
          Şifrə bərpasını siz tələb etməmisinizsə, bu e-poçtu nəzərə almayın.
        </p>
      </div>
    `,
  });
}

module.exports = { generateOtp, sendRegisterOtp, sendResetOtp };
