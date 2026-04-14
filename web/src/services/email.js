const logger = require('../../logger');
let Resend;
try { Resend = require('resend').Resend; } catch (_) { Resend = null; }

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const PORT = parseInt(process.env.PORT) || 3000;
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

const resend = (Resend && RESEND_KEY) ? new Resend(RESEND_KEY) : null;
if (!resend) logger.warn('Resend not configured — email features disabled');

async function sendVerificationEmail(to, username, token) {
    if (!resend) return { error: 'Email not configured' };
    const link = `${APP_URL}/api/auth/verify-email?token=${token}`;
    try {
        await resend.emails.send({
            from: 'LitAssist <onboarding@resend.dev>',
            to,
            subject: '[LitAssist] Verifikasi Email Kamu',
            html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;">
  <h2 style="color:#4f46e5;margin-bottom:8px;">LitAssist</h2>
  <p style="color:#374151;">Halo <strong>${username}</strong>,</p>
  <p style="color:#374151;">Terima kasih sudah daftar! Klik tombol di bawah untuk verifikasi email kamu.</p>
  <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
    Verifikasi Email
  </a>
  <p style="color:#9ca3af;font-size:13px;">Link ini berlaku selama 24 jam. Kalau bukan kamu yang daftar, abaikan email ini.</p>
</div>`
        });
        return { ok: true };
    } catch (err) {
        logger.error('sendVerificationEmail failed', { error: err.message });
        return { error: err.message };
    }
}

async function sendPremiumTokenEmail(to, username, token) {
    if (!resend) return { error: 'Email not configured' };
    try {
        await resend.emails.send({
            from: 'LitAssist <onboarding@resend.dev>',
            to,
            subject: '[LitAssist] Token Aktivasi Premium Kamu',
            html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;">
  <h2 style="color:#4f46e5;margin-bottom:8px;">LitAssist Premium</h2>
  <p style="color:#374151;">Halo <strong>${username}</strong>,</p>
  <p style="color:#374151;">Pembayaranmu sudah dikonfirmasi. Berikut token aktivasi Premium kamu:</p>
  <div style="margin:20px 0;padding:16px 20px;background:#f5f3ff;border-radius:10px;text-align:center;">
    <code style="font-size:22px;font-weight:700;letter-spacing:4px;color:#4f46e5;">${token}</code>
  </div>
  <p style="color:#374151;font-size:14px;">Cara aktivasi:</p>
  <ol style="color:#374151;font-size:14px;padding-left:18px;">
    <li>Login ke LitAssist</li>
    <li>Buka halaman <strong>Profile</strong></li>
    <li>Masukkan token di section <strong>Aktivasi Premium</strong></li>
    <li>Klik <strong>Aktifkan</strong></li>
  </ol>
  <p style="color:#9ca3af;font-size:13px;margin-top:16px;">Token berlaku 7 hari. Jangan bagikan token ini ke siapapun.</p>
</div>`
        });
        return { ok: true };
    } catch (err) {
        logger.error('sendPremiumTokenEmail failed', { error: err.message });
        return { error: err.message };
    }
}

module.exports = {
    sendVerificationEmail,
    sendPremiumTokenEmail
};
