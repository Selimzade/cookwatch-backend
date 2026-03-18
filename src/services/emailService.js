const nodemailer = require('nodemailer');

// ── Transport ─────────────────────────────────────────────────────────────────
// In production: set EMAIL_HOST / EMAIL_USER / EMAIL_PASS in Railway Variables
// In development with no credentials: Ethereal (fake SMTP) is used automatically
//   → emails are NOT delivered to inbox, but a preview URL is printed to console

let transporter = null;
let etherealUser = null;

async function getTransporter() {
  if (transporter) return transporter;

  const isDev = process.env.NODE_ENV !== 'production';
  const hasCredentials =
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_PASS !== 'your_16char_app_password_here';

  if (isDev && !hasCredentials) {
    // Auto-create a free Ethereal test account — no sign-up needed
    const testAccount = await nodemailer.createTestAccount();
    etherealUser = testAccount.user;

    transporter = nodemailer.createTransport({
      host:   'smtp.ethereal.email',
      port:    587,
      secure:  false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log('');
    console.log('📧  Email: Ethereal test mode aktiv');
    console.log(`    İstifadəçi: ${testAccount.user}`);
    console.log('    Göndərilən emaillər ethereal.email/messages saytında görünür');
    console.log('');
    return transporter;
  }

  // Real SMTP (production or dev with credentials)
  transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST  || 'smtp.gmail.com',
    port:   Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 6000,
    greetingTimeout:   4000,
    socketTimeout:     6000,
  });

  return transporter;
}

// Verify connection on startup — logs status without crashing
async function verifyEmailConnection() {
  try {
    const t = await getTransporter();
    await t.verify();
    console.log('✅  Email SMTP bağlantısı uğurlu');
  } catch (err) {
    console.warn('⚠️   Email SMTP bağlantısı uğursuz:', err.message);
    if (process.env.NODE_ENV === 'production') {
      console.warn('    OTP emailləri göndərilməyəcək. EMAIL_PASS-ı yoxlayın.');
    }
  }
}

// ── Generate 6-digit OTP ──────────────────────────────────────────────────────
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Internal send helper ──────────────────────────────────────────────────────
async function sendMail(to, subject, html) {
  const t    = await getTransporter();
  const from = process.env.EMAIL_FROM ||
    (etherealUser ? `"CookWatch" <${etherealUser}>` : `"CookWatch" <${process.env.EMAIL_USER}>`);

  const info = await t.sendMail({ from, to, subject, html });

  // In Ethereal mode print the preview URL so developer can open the email
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) {
    console.log(`\n📬  Email göndərildi (Ethereal preview):\n    ${preview}\n`);
  }
}

// ── Send registration OTP ─────────────────────────────────────────────────────
async function sendRegisterOtp(email, otp) {
  await sendMail(
    email,
    'CookWatch - Hesabınızı təsdiqləyin',
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;
                background:#fff;border-radius:16px;border:1px solid #e2e8f0">
      <div style="text-align:center;margin-bottom:24px">
        <span style="font-size:48px">🍳</span>
        <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:8px 0 4px">CookWatch</h1>
        <p style="font-size:14px;color:#64748b;margin:0">Hesabınızı təsdiqləyin</p>
      </div>
      <p style="font-size:15px;color:#334155;margin-bottom:24px">
        Qeydiyyatı tamamlamaq üçün aşağıdakı OTP kodunu daxil edin.
        Kod <strong>10 dəqiqə</strong> ərzində etibarlıdır.
      </p>
      <div style="background:#f1f5f9;border-radius:12px;padding:20px;text-align:center;
                  letter-spacing:12px;font-size:36px;font-weight:700;color:#0f172a;margin-bottom:24px">
        ${otp}
      </div>
      <p style="font-size:13px;color:#94a3b8;text-align:center">
        Bu e-poçtu siz göndərməmisinizsə, lütfən nəzərə almayın.
      </p>
    </div>
    `
  );
}

// ── Send password-reset OTP ───────────────────────────────────────────────────
async function sendResetOtp(email, otp) {
  await sendMail(
    email,
    'CookWatch - Şifrə bərpası',
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;
                background:#fff;border-radius:16px;border:1px solid #e2e8f0">
      <div style="text-align:center;margin-bottom:24px">
        <span style="font-size:48px">🔑</span>
        <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:8px 0 4px">Şifrə bərpası</h1>
        <p style="font-size:14px;color:#64748b;margin:0">CookWatch</p>
      </div>
      <p style="font-size:15px;color:#334155;margin-bottom:24px">
        Yeni şifrə təyin etmək üçün aşağıdakı OTP kodunu daxil edin.
        Kod <strong>10 dəqiqə</strong> ərzində etibarlıdır.
      </p>
      <div style="background:#f1f5f9;border-radius:12px;padding:20px;text-align:center;
                  letter-spacing:12px;font-size:36px;font-weight:700;color:#0f172a;margin-bottom:24px">
        ${otp}
      </div>
      <p style="font-size:13px;color:#94a3b8;text-align:center">
        Şifrə bərpasını siz tələb etməmisinizsə, bu e-poçtu nəzərə almayın.
      </p>
    </div>
    `
  );
}

module.exports = { generateOtp, sendRegisterOtp, sendResetOtp, verifyEmailConnection };
