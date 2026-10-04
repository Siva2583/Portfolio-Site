const root = document.documentElement;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if ('IntersectionObserver' in window && !prefersReducedMotion) {
  root.classList.add('js-motion');
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('[data-reveal]').forEach((item) => revealObserver.observe(item));
}

const menuToggle = document.querySelector('[data-menu-toggle]');
const primaryNav = document.querySelector('#primary-nav');
if (menuToggle && primaryNav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = primaryNav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
  });
  primaryNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    primaryNav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation menu');
  }));
}

const commandDialog = document.querySelector('#command-dialog');
const recruiterDialog = document.querySelector('#recruiter-dialog');
const commandSearch = document.querySelector('#command-search');
const commandResults = document.querySelector('#command-results');
const dialogTriggers = new WeakMap();
let visibleCommands = [];
let activeCommand = 0;

const commands = [
  { label: 'Open RevertPay case study', hint: 'RP—001 · ledger', keywords: 'revertpay projects systems', run: () => navigate('/projects/revertpay.html') },
  { label: 'Open AlgoViz 2.0 case study', hint: 'AV—002 · recorded frames', keywords: 'algoviz algorithms projects', run: () => navigate('/projects/algoviz.html') },
  { label: 'Launch AlgoViz 2.0', hint: 'External application', keywords: 'algoviz live demo source', run: () => openExternal('https://algoviz-2-0.vercel.app/') },
  { label: 'Open Voyager case study', hint: 'VO—003 · verified AI', keywords: 'voyager ai projects', run: () => navigate('/projects/voyager.html') },
  { label: 'Launch Voyager', hint: 'External application', keywords: 'voyager live demo', run: () => openExternal('https://voyager-node-f-inal-fefq.vercel.app/') },
  { label: 'Open EDU2JOB case study', hint: 'EJ—004 · Java × Python', keywords: 'edu2job ml projects', run: () => navigate('/projects/edu2job.html') },
  { label: 'Recruiter mode · 90-second view', hint: 'Quick profile', keywords: 'recruiter candidate summary', run: openRecruiter },
  { label: 'Request resume PDF', hint: 'Email Siva', keywords: 'resume cv pdf', run: () => openExternal('mailto:kgsivacharan2005@gmail.com?subject=Resume%20request') },
  { label: 'Contact Siva', hint: 'Message form', keywords: 'contact email message', run: () => goToSection('contact') },
  { label: 'GitHub profile', hint: 'Siva2583', keywords: 'github code source', run: () => openExternal('https://github.com/Siva2583') },
  { label: 'LinkedIn profile', hint: 'Siva Charan', keywords: 'linkedin social', run: () => openExternal('https://www.linkedin.com/in/siva-charan-kg-72a900284/') },
  { label: 'LeetCode profile', hint: '500+ problems', keywords: 'leetcode dsa practice', run: () => openExternal('https://leetcode.com/u/siva_2853/') },
  { label: 'About Siva', hint: 'Engineering philosophy', keywords: 'about profile philosophy', run: () => goToSection('about') },
  { label: 'Engineering systems', hint: 'Four case studies', keywords: 'projects work systems', run: () => goToSection('systems') },
  { label: 'RevertPay architecture', hint: 'NO BALANCE COLUMN', keywords: 'architecture ledger escrow', run: () => navigate('/projects/revertpay.html#architecture') },
];

function navigate(path) {
  window.location.href = path;
}

function openExternal(url) {
  if (url.startsWith('mailto:')) {
    window.location.href = url;
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function goToSection(id) {
  const target = document.getElementById(id);
  if (!target) {
    navigate(`/#${id}`);
    return;
  }
  target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  window.setTimeout(() => target.focus({ preventScroll: true }), prefersReducedMotion ? 0 : 400);
}

function showDialog(dialog, trigger) {
  if (!dialog || typeof dialog.showModal !== 'function') return;
  dialogTriggers.set(dialog, trigger || document.activeElement);
  if (!dialog.open) dialog.showModal();
}

function openRecruiter(trigger = document.activeElement) {
  if (!recruiterDialog) {
    navigate('/?recruiter=1');
    return;
  }
  root.setAttribute('data-recruiter-mode', 'true');
  showDialog(recruiterDialog, trigger);
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

function openPalette(query = '') {
  if (!commandDialog || !commandSearch) return;
  showDialog(commandDialog, document.activeElement);
  commandSearch.value = query;
  renderCommands(query);
  window.requestAnimationFrame(() => commandSearch.focus());
}

function renderCommands(query) {
  if (!commandResults) return;
  const needle = query.trim().toLowerCase();
  visibleCommands = commands
    .map((command, index) => ({ ...command, originalIndex: index }))
    .filter((command) => !needle || needle === 'help' || `${command.label} ${command.hint} ${command.keywords}`.toLowerCase().includes(needle));
  activeCommand = Math.min(activeCommand, Math.max(0, visibleCommands.length - 1));
  commandResults.replaceChildren();
  if (visibleCommands.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'command-empty';
    empty.textContent = 'No matching command. Try “projects”, “recruiter”, or “help”.';
    commandResults.append(empty);
    commandSearch.removeAttribute('aria-activedescendant');
    return;
  }
  visibleCommands.forEach((command, index) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'command-option';
    option.id = `command-option-${command.originalIndex}`;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(index === activeCommand));
    const number = document.createElement('span');
    number.className = 'command-option-index';
    number.textContent = String(index + 1).padStart(2, '0');
    const label = document.createElement('span');
    label.className = 'command-option-label';
    label.textContent = command.label;
    const hint = document.createElement('span');
    hint.className = 'command-option-hint';
    hint.textContent = command.hint;
    option.append(number, label, hint);
    option.addEventListener('mouseenter', () => {
      activeCommand = index;
      updateActiveCommand();
    });
    option.addEventListener('click', () => executeCommand(index));
    commandResults.append(option);
  });
  updateActiveCommand();
}

function updateActiveCommand() {
  if (!commandResults || !visibleCommands.length) return;
  commandResults.querySelectorAll('[role="option"]').forEach((option, index) => option.setAttribute('aria-selected', String(index === activeCommand)));
  const id = `command-option-${visibleCommands[activeCommand].originalIndex}`;
  commandSearch?.setAttribute('aria-activedescendant', id);
  document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
}

function executeCommand(index) {
  const command = visibleCommands[index];
  if (!command) return;
  const opener = dialogTriggers.get(commandDialog) || document.activeElement;
  closeDialog(commandDialog);
  if (command.run === openRecruiter) {
    window.setTimeout(() => openRecruiter(opener), 0);
    return;
  }
  command.run();
}

if (commandSearch) {
  commandSearch.addEventListener('input', () => {
    activeCommand = 0;
    renderCommands(commandSearch.value);
  });
  commandSearch.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && visibleCommands.length) {
      event.preventDefault();
      activeCommand = (activeCommand + 1) % visibleCommands.length;
      updateActiveCommand();
    } else if (event.key === 'ArrowUp' && visibleCommands.length) {
      event.preventDefault();
      activeCommand = (activeCommand - 1 + visibleCommands.length) % visibleCommands.length;
      updateActiveCommand();
    } else if (event.key === 'Enter' && visibleCommands.length) {
      event.preventDefault();
      executeCommand(activeCommand);
    }
  });
}

document.querySelectorAll('[data-open-palette]').forEach((trigger) => trigger.addEventListener('click', () => openPalette()));
document.querySelectorAll('[data-open-recruiter]').forEach((trigger) => trigger.addEventListener('click', openRecruiter));
document.querySelectorAll('[data-close-dialog]').forEach((trigger) => trigger.addEventListener('click', () => closeDialog(trigger.closest('dialog'))));

[commandDialog, recruiterDialog].filter(Boolean).forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
  dialog.addEventListener('close', () => {
    if (dialog === recruiterDialog) root.removeAttribute('data-recruiter-mode');
    if (dialog === commandDialog) commandSearch?.removeAttribute('aria-activedescendant');
    const opener = dialogTriggers.get(dialog);
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  });
});

recruiterDialog?.querySelector('a[href="#contact"]')?.addEventListener('click', () => closeDialog(recruiterDialog));

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openPalette();
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing || event.key.length !== 1) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.target?.isContentEditable) return;
  runSecretCommand(event.key);
});

let secretBuffer = '';
let secretTimer = null;
function runSecretCommand(key) {
  secretBuffer = `${secretBuffer}${key.toLowerCase()}`.slice(-12);
  if (secretTimer) window.clearTimeout(secretTimer);
  secretTimer = window.setTimeout(() => { secretBuffer = ''; }, 1300);
  if (secretBuffer.endsWith('help')) {
    secretBuffer = '';
    openPalette('help');
  } else if (secretBuffer.endsWith('projects')) {
    secretBuffer = '';
    goToSection('systems');
  } else if (secretBuffer.endsWith('revertpay')) {
    secretBuffer = '';
    navigate('/projects/revertpay.html');
  } else if (secretBuffer.endsWith('recruiter')) {
    secretBuffer = '';
    openRecruiter();
  }
}

function readQueryEntry(key) {
  const url = new URL(window.location.href);
  const value = url.searchParams.get(key);
  if (!value) return null;
  url.searchParams.delete(key);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  return value;
}

const recruiterRequested = readQueryEntry('recruiter');
const paletteRequested = readQueryEntry('palette');
if (recruiterRequested && recruiterDialog) window.setTimeout(openRecruiter, 0);
if (paletteRequested && commandDialog) window.setTimeout(() => openPalette(), 0);

const resumeDownload = document.querySelector('#resume-download');
if (resumeDownload) {
  fetch('/resume.pdf', { method: 'HEAD', cache: 'no-store' })
    .then((response) => {
      if (!response.ok) return;
      resumeDownload.hidden = false;
      const request = document.querySelector('#resume-request');
      const recruiterRequest = document.querySelector('#recruiter-resume-request');
      const recruiterDownload = document.querySelector('#recruiter-resume-download');
      const note = document.querySelector('#resume-note');
      if (request) request.hidden = true;
      if (recruiterRequest) recruiterRequest.hidden = true;
      if (recruiterDownload) recruiterDownload.hidden = false;
      if (note) note.hidden = true;
    })
    .catch(() => {});
}

const contactForm = document.querySelector('#contact-form');
if (contactForm) {
  const feedback = document.querySelector('#contact-feedback');
  const submitButton = contactForm.querySelector('[type="submit"]');
  const submitLabel = contactForm.querySelector('[data-submit-label]');
  const directEmail = 'kgsivacharan2005@gmail.com';

  contactForm.addEventListener('input', () => {
    if (!feedback?.textContent) return;
    feedback.textContent = '';
    feedback.className = 'form-feedback';
  });

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!feedback || !submitButton || !submitLabel) return;
    feedback.replaceChildren();
    feedback.className = 'form-feedback';
    if (!contactForm.reportValidity()) return;

    const values = Object.fromEntries(new FormData(contactForm).entries());
    for (const key of ['name', 'email', 'subject', 'message']) {
      if (!String(values[key] || '').trim()) {
        feedback.className = 'form-feedback is-error';
        feedback.textContent = `Please add a ${key}.`;
        contactForm.elements.namedItem(key)?.focus();
        return;
      }
    }

    submitButton.disabled = true;
    submitLabel.textContent = 'Processing message…';
    feedback.textContent = 'VALIDATING / TRANSMITTING';

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values),
        credentials: 'same-origin',
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.stored === true) {
        feedback.className = 'form-feedback is-success';
        feedback.textContent = payload.notification === 'sent'
          ? 'Message stored. Email notification sent.'
          : 'Message stored securely. Email notification is delayed; the inbox retains your message.';
        contactForm.reset();
      } else {
        throw new Error(payload.error || 'Service unavailable');
      }
    } catch {
      feedback.className = 'form-feedback is-error';
      const message = document.createElement('span');
      message.textContent = 'MESSAGE NOT TRANSMITTED. The secure contact service is unavailable or not configured. Email directly: ';
      const link = document.createElement('a');
      link.href = `mailto:${directEmail}?subject=Portfolio%20message`;
      link.textContent = directEmail;
      feedback.append(message, link);
    } finally {
      submitButton.disabled = false;
      submitLabel.textContent = 'Send message';
    }
  });
}
