const loadingView = document.querySelector('#loading-view');
const loginView = document.querySelector('#login-view');
const unavailableView = document.querySelector('#unavailable-view');
const inboxView = document.querySelector('#inbox-view');
const loginForm = document.querySelector('#login-form');
const loginFeedback = document.querySelector('#login-feedback');
const unavailableFeedback = document.querySelector('#unavailable-feedback');
const inboxFeedback = document.querySelector('#inbox-feedback');
const messageList = document.querySelector('#message-list');
const messageDetail = document.querySelector('#message-detail');
const emptyState = document.querySelector('#empty-state');
const messageTotal = document.querySelector('#message-total');
const unreadCount = document.querySelector('#unread-count');
const sessionEmail = document.querySelector('#session-email');
const loginLabel = document.querySelector('[data-login-label]');
let messages = [];
let selectedId = null;

function showView(name) {
  loadingView.hidden = name !== 'loading';
  loginView.hidden = name !== 'login';
  unavailableView.hidden = name !== 'unavailable';
  inboxView.hidden = name !== 'inbox';
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function setFeedback(node, message, kind = '') {
  if (!node) return;
  node.textContent = message;
  node.className = `admin-feedback${kind ? ` is-${kind}` : ''}`;
}

function renderMessageList() {
  messageList.replaceChildren();
  messageTotal.textContent = String(messages.length);
  const unread = messages.filter((message) => message.status === 'unread').length;
  unreadCount.textContent = `${unread} unread`;
  emptyState.hidden = messages.length > 0;

  messages.forEach((message) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `message-item${message.status === 'unread' ? ' is-unread' : ''}`;
    button.setAttribute('aria-current', String(message.id === selectedId));
    const dot = document.createElement('span');
    dot.className = 'message-unread-dot';
    dot.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.className = 'message-copy';
    const name = document.createElement('strong');
    name.textContent = message.name || 'Unknown sender';
    const subject = document.createElement('span');
    subject.className = 'message-subject';
    subject.textContent = message.subject || '(no subject)';
    const date = document.createElement('small');
    date.textContent = formatDate(message.created_at);
    const status = document.createElement('span');
    status.className = `message-status ${safeStatusClass(message.status)}`;
    status.textContent = message.status || 'unread';
    copy.append(name, subject, date, status);
    button.append(dot, copy);
    button.addEventListener('click', () => selectMessage(message.id));
    item.append(button);
    messageList.append(item);
  });
}

function safeStatusClass(status) {
  return ['unread', 'read', 'replied', 'archived'].includes(status) ? status : 'read';
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function appendDetailField(dl, label, value, href = '') {
  const wrapper = document.createElement('div');
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  if (href) {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.textContent = value || '—';
    if (href.startsWith('http')) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    description.append(anchor);
  } else {
    description.textContent = value || '—';
  }
  wrapper.append(term, description);
  dl.append(wrapper);
}

function selectMessage(id) {
  const message = messages.find((item) => item.id === id);
  if (!message) return;
  selectedId = id;
  renderMessageList();
  renderMessageDetail(message);
  if (message.status === 'unread') updateStatus(id, 'read', { quiet: true });
}

function renderMessageDetail(message) {
  messageDetail.replaceChildren();
  const header = document.createElement('div');
  header.className = 'message-detail-header';
  const heading = document.createElement('div');
  const overline = document.createElement('div');
  overline.className = 'detail-overline';
  overline.textContent = `${message.name || 'SENDER'} / ${safeStatusClass(message.status).toUpperCase()}`;
  const subject = document.createElement('h2');
  subject.textContent = message.subject || '(no subject)';
  const from = document.createElement('a');
  from.className = 'detail-from';
  from.href = `mailto:${encodeURIComponent(message.email || '')}`;
  from.textContent = message.email || 'No sender email';
  heading.append(overline, subject, from);
  const received = document.createElement('span');
  received.className = 'detail-overline';
  received.textContent = formatDate(message.created_at);
  header.append(heading, received);

  const details = document.createElement('dl');
  details.className = 'detail-meta';
  appendDetailField(details, 'Name', message.name);
  appendDetailField(details, 'Email', message.email, `mailto:${encodeURIComponent(message.email || '')}`);
  appendDetailField(details, 'Company', message.company);
  appendDetailField(details, 'Role', message.role);
  if (message.linkedin) appendDetailField(details, 'LinkedIn', message.linkedin, message.linkedin);
  appendDetailField(details, 'Status', message.status || 'unread');

  const body = document.createElement('div');
  body.className = 'message-body';
  body.textContent = message.message || '';
  body.setAttribute('aria-label', 'Message content');

  const actions = document.createElement('div');
  actions.className = 'detail-actions';
  const readButton = makeAction(message.status === 'read' ? 'Mark unread' : 'Mark as read', () => updateStatus(message.id, message.status === 'read' ? 'unread' : 'read'));
  const archiveButton = makeAction('Archive', () => updateStatus(message.id, 'archived'));
  const deleteButton = makeAction('Delete', () => deleteMessage(message.id), true);
  actions.append(readButton, archiveButton, deleteButton);

  const replySection = document.createElement('section');
  replySection.className = 'reply-section';
  const replyTitle = document.createElement('h3');
  replyTitle.textContent = 'Reply securely';
  const replyForm = document.createElement('form');
  replyForm.className = 'reply-form';
  const reply = document.createElement('textarea');
  reply.name = 'message';
  reply.required = true;
  reply.minLength = 1;
  reply.maxLength = 5000;
  reply.placeholder = 'Write a reply…';
  reply.setAttribute('aria-label', 'Reply message');
  const send = document.createElement('button');
  send.type = 'submit';
  send.className = 'admin-button admin-button-primary';
  send.textContent = 'Send reply';
  const replyStatus = document.createElement('p');
  replyStatus.className = 'admin-feedback';
  replyStatus.setAttribute('role', 'status');
  replyStatus.setAttribute('aria-live', 'polite');
  replyForm.append(reply, send, replyStatus);
  replyForm.addEventListener('submit', (event) => sendReply(event, message, reply, send, replyStatus));
  replySection.append(replyTitle, replyForm);
  messageDetail.append(header, details, body, actions, replySection);
}

function makeAction(label, action, danger = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `admin-button admin-button-quiet${danger ? ' is-danger' : ''}`;
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

async function loadMessages({ preserveSelection = true } = {}) {
  setFeedback(inboxFeedback, 'LOADING MESSAGES…');
  try {
    const { response, payload } = await request('/api/admin/messages');
    if (response.status === 401) {
      showView('login');
      setFeedback(loginFeedback, 'Please sign in to continue.', 'error');
      return;
    }
    if (!response.ok) {
      setFeedback(inboxFeedback, 'Messages could not be loaded. Retry in a moment.', 'error');
      return;
    }
    messages = Array.isArray(payload.messages) ? payload.messages : [];
    if (!preserveSelection || !messages.some((item) => item.id === selectedId)) selectedId = null;
    renderMessageList();
    if (selectedId) {
      const current = messages.find((item) => item.id === selectedId);
      renderMessageDetail(current);
    } else {
      messageDetail.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'detail-empty';
      const label = document.createElement('span');
      label.className = 'detail-index';
      label.textContent = 'SELECT A MESSAGE';
      const text = document.createElement('p');
      text.textContent = 'Choose a message to inspect its details and reply securely.';
      empty.append(label, text);
      messageDetail.append(empty);
    }
    setFeedback(inboxFeedback, 'Inbox synchronized.', 'success');
  } catch {
    setFeedback(inboxFeedback, 'The private inbox is temporarily unavailable.', 'error');
  }
}

async function updateStatus(id, status, { quiet = false } = {}) {
  if (!quiet) setFeedback(inboxFeedback, 'UPDATING MESSAGE…');
  try {
    const { response, payload } = await request('/api/admin/messages', {
      method: 'PATCH',
      body: JSON.stringify({ id, status }),
    });
    if (response.status === 401) {
      showView('login');
      setFeedback(loginFeedback, 'Session expired. Sign in again.', 'error');
      return;
    }
    if (!response.ok || !payload.message) {
      setFeedback(inboxFeedback, 'Status could not be updated.', 'error');
      return;
    }
    const index = messages.findIndex((item) => item.id === id);
    if (index >= 0) messages[index] = payload.message;
    renderMessageList();
    renderMessageDetail(payload.message);
    if (!quiet) setFeedback(inboxFeedback, `Message marked ${status}.`, 'success');
  } catch {
    setFeedback(inboxFeedback, 'Status could not be updated. Retry in a moment.', 'error');
  }
}

function confirmDelete() {
  const dialog = document.querySelector('#delete-confirm-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return Promise.resolve(false);
  dialog.returnValue = '';
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'delete'), { once: true });
    dialog.showModal();
  });
}

async function deleteMessage(id) {
  if (!await confirmDelete()) return;
  try {
    const { response } = await request(`/api/admin/messages?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) {
      setFeedback(inboxFeedback, 'Message could not be deleted.', 'error');
      return;
    }
    messages = messages.filter((item) => item.id !== id);
    selectedId = null;
    renderMessageList();
    messageDetail.replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'detail-empty';
    empty.textContent = 'Message deleted.';
    messageDetail.append(empty);
    setFeedback(inboxFeedback, 'Message deleted.', 'success');
  } catch {
    setFeedback(inboxFeedback, 'Message could not be deleted. Retry in a moment.', 'error');
  }
}

async function sendReply(event, original, reply, send, replyStatus) {
  event.preventDefault();
  const message = reply.value.trim();
  if (!message) {
    setFeedback(replyStatus, 'Write a reply first.', 'error');
    reply.focus();
    return;
  }
  send.disabled = true;
  send.textContent = 'Sending…';
  setFeedback(replyStatus, 'SENDING THROUGH SECURE EMAIL PROVIDER…');
  try {
    const { response, payload } = await request('/api/admin/reply', {
      method: 'POST',
      body: JSON.stringify({ id: original.id, message }),
    });
    if (!response.ok) {
      setFeedback(replyStatus, 'Reply was not sent. The original message remains in the inbox.', 'error');
      return;
    }
    reply.value = '';
    if (payload.statusUpdated) {
      const index = messages.findIndex((item) => item.id === original.id);
      if (index >= 0) messages[index].status = 'replied';
      renderMessageList();
      await loadMessages();
    } else {
      setFeedback(replyStatus, 'Reply sent. Message status could not be updated; refresh the inbox.', 'success');
    }
  } catch {
    setFeedback(replyStatus, 'Reply was not sent. Please retry.', 'error');
  } finally {
    send.disabled = false;
    send.textContent = 'Send reply';
  }
}

async function checkSession() {
  showView('loading');
  try {
    const { response, payload } = await request('/api/admin/messages');
    if (response.ok) {
      const userEmail = payload.email || '';
      sessionEmail.textContent = userEmail;
      showView('inbox');
      messages = Array.isArray(payload.messages) ? payload.messages : [];
      renderMessageList();
      if (messages.length > 0) selectMessage(messages[0].id);
      else {
        selectedId = null;
        messageDetail.replaceChildren();
        const empty = document.createElement('div');
        empty.className = 'detail-empty';
        empty.textContent = 'No message selected.';
        messageDetail.append(empty);
      }
      setFeedback(inboxFeedback, 'Inbox synchronized.', 'success');
    } else if (response.status === 401) {
      showView('login');
    } else {
      showView('unavailable');
    }
  } catch {
    showView('unavailable');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!loginForm.reportValidity()) return;
  const email = String(loginForm.elements.namedItem('email').value || '').trim();
  const password = String(loginForm.elements.namedItem('password').value || '');
  const submit = loginForm.querySelector('[type="submit"]');
  submit.disabled = true;
  loginLabel.textContent = 'Checking credentials…';
  setFeedback(loginFeedback, 'AUTHENTICATING WITH SERVER…');
  try {
    const { response, payload } = await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      setFeedback(loginFeedback, payload.error || 'Sign-in failed. Check the credentials and try again.', 'error');
      return;
    }
    loginForm.reset();
    sessionEmail.textContent = payload.email || email;
    showView('inbox');
    await loadMessages({ preserveSelection: false });
  } catch {
    setFeedback(loginFeedback, 'Inbox authentication is unavailable. Try again later.', 'error');
  } finally {
    submit.disabled = false;
    loginLabel.textContent = 'Sign in';
  }
});

document.querySelector('[data-refresh]')?.addEventListener('click', () => loadMessages());
document.querySelector('[data-retry]')?.addEventListener('click', () => {
  setFeedback(unavailableFeedback, 'Retrying connection…');
  checkSession();
});
document.querySelector('[data-logout]')?.addEventListener('click', async () => {
  try {
    await request('/api/admin/logout', { method: 'POST', body: '{}' });
  } catch {
    // The server clears cookies even if session revocation is temporarily unavailable.
  }
  messages = [];
  selectedId = null;
  showView('login');
  setFeedback(loginFeedback, 'Signed out.', 'success');
});

checkSession();
