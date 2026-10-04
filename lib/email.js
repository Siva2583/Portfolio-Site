import { fetchWithTimeout } from './supabase.js';

export function hasNotificationConfig(env = process.env) {
  return Boolean(env.RESEND_API_KEY?.trim() && env.CONTACT_TO_EMAIL?.trim() && env.CONTACT_FROM_EMAIL?.trim());
}

export async function sendEmail({ to, subject, text, env = process.env, fetchImpl = fetch }) {
  if (!hasNotificationConfig(env)) return { sent: false, reason: 'not-configured' };
  let response;
  try {
    response = await fetchWithTimeout(fetchImpl, 'https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM_EMAIL.trim(),
        to: [to],
        subject,
        text,
      }),
    }, 8000);
  } catch {
    return { sent: false, reason: 'provider-unavailable' };
  }
  if (!response.ok) return { sent: false, reason: 'provider-rejected' };
  return { sent: true };
}
