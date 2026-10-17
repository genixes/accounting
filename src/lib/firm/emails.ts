import { BRAND } from "./brand";

const wrap = (inner: string) =>
  `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px;color:#1c1917">${inner}<p style="color:#78716c;font-size:12px;margin-top:32px">${BRAND.name}</p></div>`;

export function otpEmail(code: string, minutes: number) {
  return {
    subject: `Your ${BRAND.name} sign-in code: ${code}`,
    text: `Your sign-in code is ${code}.\n\nIt expires in ${minutes} minutes. If you did not ask for it, you can ignore this email.`,
    html: wrap(`<p>Your sign-in code is</p><p style="font-size:32px;letter-spacing:.2em;font-weight:600">${code}</p><p>It expires in ${minutes} minutes. If you did not ask for it, ignore this email.</p>`),
  };
}

export function welcomeEmail(opts: { name: string; business: string; loginUrl: string }) {
  return {
    subject: `Welcome to ${BRAND.name}, ${opts.name}`,
    text: `Hi ${opts.name},\n\nThank you. Your private workspace for ${opts.business} is ready.\n\nSign in with this email address (we will send you a one-time code):\n${opts.loginUrl}\n\nA partner accountant will contact you to schedule your consultation.\n\n— ${BRAND.name}`,
    html: wrap(`<p>Hi ${esc(opts.name)},</p><p>Thank you. Your private workspace for <strong>${esc(opts.business)}</strong> is ready.</p><p><a href="${opts.loginUrl}">Sign in</a> with this email address — we will send you a one-time code.</p><p>A partner accountant will contact you to schedule your consultation.</p>`),
  };
}

export function staffNewClientEmail(opts: { business: string; plan: string; adminUrl: string }) {
  return {
    subject: `New paid client: ${opts.business} (${opts.plan})`,
    text: `A new client has paid and been provisioned.\n\nBusiness: ${opts.business}\nPlan: ${opts.plan}\n\nSchedule their consultation: ${opts.adminUrl}`,
  };
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
