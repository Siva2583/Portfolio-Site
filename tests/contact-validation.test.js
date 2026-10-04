import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContact, validateReply } from '../lib/contact-validation.js';

const validMessage = {
  name: 'Taylor Recruiter',
  email: 'Taylor@example.com',
  company: 'Northwind',
  role: 'Software Engineer',
  subject: 'Backend engineering opportunity',
  message: 'I would like to discuss a backend engineering role and your project work.',
};

test('contact payload accepts valid fields and normalizes email', () => {
  const result = validateContact(validMessage);
  assert.equal(result.ok, true);
  assert.equal(result.value.email, 'taylor@example.com');
  assert.equal(result.value.company, 'Northwind');
  assert.equal(result.value.linkedin, '');
});

test('contact payload enforces required fields and message length', () => {
  assert.match(validateContact({ ...validMessage, subject: '   ' }).error, /Subject is required/);
  assert.match(validateContact({ ...validMessage, message: 'short' }).error, /20–5,000/);
  assert.match(validateContact({ ...validMessage, name: '' }).error, /Name is required/);
});

test('email, LinkedIn URL, and honeypot are validated server-side', () => {
  assert.match(validateContact({ ...validMessage, email: 'not-an-email' }).error, /valid email/);
  assert.match(validateContact({ ...validMessage, linkedin: 'http://www.linkedin.com/in/person' }).error, /https/);
  assert.equal(validateContact({ ...validMessage, linkedin: 'https://www.linkedin.com/in/person' }).value.linkedin, 'https://www.linkedin.com/in/person');
  assert.match(validateContact({ ...validMessage, website: 'https://spam.invalid' }).error, /Invalid form/);
});

test('control characters are removed while message line breaks remain plain text', () => {
  const result = validateContact({
    ...validMessage,
    name: 'Taylor\u0000 Recruiter',
    message: 'First line\r\nSecond line with <b>literal text</b> and enough length.',
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.name, 'Taylor Recruiter');
  assert.equal(result.value.message, 'First line\nSecond line with <b>literal text</b> and enough length.');
});

test('reply validation bounds the message length', () => {
  assert.equal(validateReply({ message: 'Thanks for reaching out.' }).ok, true);
  assert.equal(validateReply({ message: '  ' }).ok, false);
  assert.equal(validateReply({ message: 'x'.repeat(5001) }).ok, false);
});
