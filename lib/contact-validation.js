const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function singleLine(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function messageText(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/\p{Cc}/gu, (character) => character === '\n' || character === '\t' ? character : '')
    .trim();
}

function optionalLinkedIn(value) {
  const input = singleLine(value, 250);
  if (!input) return { value: '', error: null };
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== 'https:' || !['linkedin.com', 'www.linkedin.com'].includes(parsed.hostname)) {
      return { value: '', error: 'LinkedIn must be an https://www.linkedin.com URL.' };
    }
    return { value: parsed.toString(), error: null };
  } catch {
    return { value: '', error: 'LinkedIn must be an https://www.linkedin.com URL.' };
  }
}

export function validateContact(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Invalid request body.' };
  }

  if (singleLine(input.website, 200)) {
    return { ok: false, error: 'Invalid form submission.' };
  }

  const name = singleLine(input.name, 100);
  const email = singleLine(input.email, 254).toLowerCase();
  const company = singleLine(input.company, 100);
  const role = singleLine(input.role, 100);
  const subject = singleLine(input.subject, 160);
  const message = messageText(input.message);
  const linkedin = optionalLinkedIn(input.linkedin);

  if (!name) return { ok: false, error: 'Name is required.' };
  if (!email || !EMAIL_PATTERN.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (!subject) return { ok: false, error: 'Subject is required.' };
  if (message.length < 20 || message.length > 5000) return { ok: false, error: 'Message must contain 20–5,000 characters.' };
  if (linkedin.error) return { ok: false, error: linkedin.error };

  return {
    ok: true,
    value: { name, email, company, role, subject, message, linkedin: linkedin.value },
  };
}

export function validateReply(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Invalid request body.' };
  const message = messageText(input.message);
  if (message.length < 1 || message.length > 5000) return { ok: false, error: 'Reply must contain 1–5,000 characters.' };
  return { ok: true, value: { message } };
}

export function sanitizeSingleLine(value, maxLength = 200) {
  return singleLine(value, maxLength);
}
