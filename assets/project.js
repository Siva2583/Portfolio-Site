import { ALGORITHM_OPTIONS, createAlgorithmFrames } from './algorithms.js';

const demoRoot = document.querySelector('[data-demo]');
if (demoRoot) {
  const demoName = demoRoot.dataset.demo;
  const renderers = {
    revertpay: renderRevertPay,
    algoviz: renderAlgoViz,
    voyager: renderVoyager,
    edu2job: renderEdu2Job,
  };
  renderers[demoName]?.(demoRoot);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className = 'button button-secondary', attributes = {}) {
  const node = el('button', className, label);
  node.type = 'button';
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
  return node;
}

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
}

function renderRevertPay(root) {
  root.replaceChildren();
  const heading = el('div', 'demo-panel-header');
  const title = el('div');
  title.append(el('span', 'demo-label', 'TRANSACTION SIMULATOR'), el('h3', '', 'One state change at a time'));
  heading.append(title, el('span', 'snapshot-tag', 'LOCAL · NOT PRODUCTION'));
  root.append(heading);

  const wrapper = el('div', 'simulator-grid');
  const controls = el('section', 'simulator-side');
  controls.setAttribute('aria-label', 'Transaction actions');
  const stateLine = el('div', 'status-readout');
  const stateName = el('strong', '', 'READY');
  stateLine.append(el('span', '', 'CURRENT STATE'), stateName);
  const amountRow = el('div', 'sim-amount-row');
  const amountLabel = el('label', '', 'Illustrative amount (INR)');
  amountLabel.htmlFor = 'sim-amount';
  const amountInput = el('input');
  amountInput.id = 'sim-amount';
  amountInput.type = 'number';
  amountInput.min = '1';
  amountInput.max = '1000000';
  amountInput.step = '1';
  amountInput.value = '1000';
  amountInput.inputMode = 'numeric';
  amountRow.append(amountLabel, amountInput);
  const actionGrid = el('div', 'sim-action-grid');
  const actions = [
    ['create', 'CREATE ESCROW'],
    ['confirm', 'CONFIRM'],
    ['fund', 'FUND'],
    ['ship', 'SHIP'],
    ['deliver', 'DELIVER'],
    ['dispute', 'DISPUTE'],
    ['resolve', 'RESOLVE → RELEASE'],
    ['refund', 'REFUND'],
  ];
  const actionButtons = new Map();
  actions.forEach(([key, label]) => {
    const actionButton = button(label, 'sim-action', { 'data-sim-action': key });
    actionButtons.set(key, actionButton);
    actionGrid.append(actionButton);
  });
  const eventTitle = el('div', 'sim-table-head sim-event-heading');
  eventTitle.append(el('span', '', 'EVENT LOG'), el('span', '', 'TIME'));
  const eventList = el('ol', 'sim-event-list');
  eventList.setAttribute('aria-label', 'Simulated transaction events');
  const resetButton = button('Reset scenario', 'text-link sim-reset');
  controls.append(stateLine, amountRow, actionGrid, eventTitle, eventList, resetButton);

  const ledger = el('section', 'simulator-ledger');
  ledger.setAttribute('aria-label', 'Simulated ledger entries');
  const ledgerIntro = el('p', 'ledger-note', 'Paired entries only. No balance column is stored or displayed; this panel shows the movement records created by this local model.');
  const tableHead = el('div', 'sim-table-head');
  tableHead.append(el('span', '', 'ACCOUNT'), el('span', '', 'ENTRY'), el('span', '', 'AMOUNT'));
  const ledgerLines = el('div');
  const empty = el('p', 'sim-empty', 'No ledger movement yet. Create and fund an escrow to record the first pair.');
  ledger.append(ledgerIntro, tableHead, ledgerLines, empty);
  wrapper.append(controls, ledger);
  root.append(wrapper);
  const status = el('p', 'demo-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.append(status);

  const state = { status: 'READY', entries: [], events: [] };
  const legalActions = {
    READY: ['create'],
    PAYMENT_INITIATED: ['confirm'],
    CREATED: ['fund'],
    FUNDED: ['ship'],
    SHIPPED: ['deliver', 'dispute'],
    UNDER_REVIEW: ['resolve', 'refund'],
    RELEASED: [],
    REFUNDED: [],
  };
  const actionTransitions = {
    create: ['PAYMENT_INITIATED', 'Buyer starts an escrow'],
    confirm: ['CREATED', 'Buyer confirms the payment request'],
    fund: ['FUNDED', 'Buyer funds escrow; paired ledger entries written'],
    ship: ['SHIPPED', 'Seller records shipment'],
    deliver: ['RELEASED', 'Buyer confirms delivery; escrow released to seller'],
    dispute: ['UNDER_REVIEW', 'Buyer requests a dispute review'],
    resolve: ['RELEASED', 'Admin resolves dispute by releasing escrow'],
    refund: ['REFUNDED', 'Admin resolves dispute by refunding the buyer'],
  };
  const actors = { create: 'BUYER', confirm: 'BUYER', fund: 'BUYER', ship: 'SELLER', deliver: 'BUYER', dispute: 'BUYER', resolve: 'ADMIN / DEMO', refund: 'ADMIN / DEMO' };
  const moneyActions = new Set(['fund', 'deliver', 'resolve', 'refund']);

  function updateButtons() {
    const enabled = new Set(legalActions[state.status] || []);
    actionButtons.forEach((node, action) => { node.disabled = !enabled.has(action); });
    amountInput.disabled = state.status !== 'READY';
    stateName.textContent = state.status;
  }

  function drawLedger() {
    ledgerLines.replaceChildren();
    empty.hidden = state.entries.length > 0;
    state.entries.forEach((entry) => {
      const row = el('div', 'sim-ledger-line');
      row.append(el('span', '', entry.account), el('span', '', entry.type), el('span', '', `₹${entry.amount.toLocaleString('en-IN')}`));
      ledgerLines.append(row);
    });
  }

  function drawEvents() {
    eventList.replaceChildren();
    [...state.events].reverse().forEach((event) => {
      const row = el('li');
      const label = el('b', '', event.label);
      const timestamp = el('time', 'sim-event-time', formatTime(event.at));
      timestamp.dateTime = event.at.toISOString();
      const actor = el('span', 'sim-event-actor', `ACTOR / ${event.actor}`);
      row.append(label, timestamp, actor);
      eventList.append(row);
    });
  }

  function applyAction(action) {
    const allowed = legalActions[state.status] || [];
    if (!allowed.includes(action)) return;
    const amount = Number(amountInput.value);
    if (moneyActions.has(action) && (!Number.isInteger(amount) || amount <= 0 || amount > 1000000)) {
      status.className = 'demo-status is-error';
      status.textContent = 'Enter a whole-number demo amount between 1 and 1,000,000.';
      amountInput.focus();
      return;
    }

    const [next, label] = actionTransitions[action];
    const at = new Date();
    state.status = next;
    state.events.push({ label, actor: actors[action], at });
    if (action === 'fund') {
      state.entries.push(
        { account: 'BUYER_WALLET', type: 'DEBIT', amount },
        { account: 'ESCROW_HOLDING', type: 'CREDIT', amount },
      );
    }
    if (action === 'deliver' || action === 'resolve') {
      state.entries.push(
        { account: 'ESCROW_HOLDING', type: 'DEBIT', amount },
        { account: 'SELLER_WALLET', type: 'CREDIT', amount },
      );
    }
    if (action === 'refund') {
      state.entries.push(
        { account: 'ESCROW_HOLDING', type: 'DEBIT', amount },
        { account: 'BUYER_WALLET', type: 'CREDIT', amount },
      );
    }
    status.className = 'demo-status is-success';
    status.textContent = `${action.toUpperCase()} → ${next}. Event timestamp is generated in your browser; all entries are illustrative.`;
    updateButtons();
    drawLedger();
    drawEvents();
  }

  actionButtons.forEach((node, action) => node.addEventListener('click', () => applyAction(action)));
  resetButton.addEventListener('click', () => {
    state.status = 'READY';
    state.entries = [];
    state.events = [];
    status.className = 'demo-status';
    status.textContent = 'Scenario reset. No backend request was made.';
    drawLedger();
    drawEvents();
    updateButtons();
    amountInput.focus();
  });
  updateButtons();
}

function renderAlgoViz(root) {
  root.replaceChildren();
  const heading = el('div', 'demo-panel-header');
  const title = el('div');
  title.append(el('span', 'demo-label', 'RECORDED-FRAME ENGINE'), el('h3', '', 'Generate first. Play second.'));
  heading.append(title, el('span', 'snapshot-tag', 'BOUNDED · LOCAL'));
  root.append(heading);

  const toolbar = el('div', 'algo-toolbar');
  const algorithmField = el('label', 'demo-field');
  algorithmField.append(el('span', '', 'Algorithm module'));
  const algorithmSelect = el('select');
  algorithmSelect.setAttribute('aria-label', 'Select an algorithm for the local demo');
  ALGORITHM_OPTIONS.forEach((option) => {
    const entry = el('option', '', option.label);
    entry.value = option.value;
    algorithmSelect.append(entry);
  });
  algorithmField.append(algorithmSelect);
  const speedField = el('label', 'demo-field');
  speedField.append(el('span', '', 'Playback speed'));
  const speedSelect = el('select');
  speedSelect.setAttribute('aria-label', 'Playback speed');
  [['slow', '0.5×'], ['normal', '1×'], ['fast', '2×']].forEach(([value, label]) => {
    const option = el('option', '', label);
    option.value = value;
    if (value === 'normal') option.selected = true;
    speedSelect.append(option);
  });
  speedField.append(speedSelect);
  toolbar.append(algorithmField, speedField);
  root.append(toolbar);

  const controls = el('div', 'demo-actions algo-playback');
  const runButton = button('Run demo', 'button button-primary');
  const backButton = button('←', 'playback-button', { 'aria-label': 'Previous frame' });
  const playButton = button('Play', 'playback-button', { 'aria-label': 'Play or pause recorded frames' });
  const nextButton = button('→', 'playback-button', { 'aria-label': 'Next frame' });
  const frameMeta = el('span', 'playback-meta', 'NO TRACE YET');
  const seek = el('input', 'algo-seek');
  seek.type = 'range';
  seek.min = '0';
  seek.max = '0';
  seek.value = '0';
  seek.disabled = true;
  seek.setAttribute('aria-label', 'Seek the recorded frame timeline');
  controls.append(runButton, backButton, playButton, nextButton, frameMeta);
  root.append(controls, seek);

  const visual = el('div', 'algo-visual-frame');
  visual.setAttribute('role', 'img');
  visual.setAttribute('aria-label', 'Run the demo to display a recorded algorithm state.');
  const caption = el('p', 'frame-caption', 'Select a module, then run it. The trace is created and stored in memory before the first frame appears.');
  caption.setAttribute('aria-live', 'polite');
  root.append(visual, caption);
  const status = el('p', 'demo-status');
  status.setAttribute('role', 'status');
  root.append(status);

  let frames = [];
  let cursor = 0;
  let timer = null;
  const delayForSpeed = () => ({ slow: 1500, normal: 850, fast: 430 })[speedSelect.value] || 850;

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
    playButton.textContent = 'Play';
  }

  function renderFrame() {
    if (!frames.length) return;
    cursor = Math.max(0, Math.min(cursor, frames.length - 1));
    drawAlgorithmFrame(visual, frames[cursor]);
    caption.textContent = frames[cursor].message;
    frameMeta.textContent = `FRAME ${String(cursor + 1).padStart(2, '0')} / ${String(frames.length).padStart(2, '0')}`;
    seek.value = String(cursor);
    seek.setAttribute('aria-valuetext', `Frame ${cursor + 1} of ${frames.length}`);
    backButton.disabled = cursor === 0;
    nextButton.disabled = cursor === frames.length - 1;
  }

  function run() {
    stop();
    try {
      frames = createAlgorithmFrames(algorithmSelect.value);
      cursor = 0;
      seek.max = String(frames.length - 1);
      seek.disabled = false;
      status.className = 'demo-status is-success';
      status.textContent = `${frames.length} immutable-style snapshots generated in memory before rendering. This is a local portfolio visualization.`;
      renderFrame();
    } catch {
      frames = [];
      seek.disabled = true;
      status.className = 'demo-status is-error';
      status.textContent = 'This module could not be generated. Choose another bounded demo and try again.';
    }
  }

  function step(delta) {
    if (!frames.length) return;
    stop();
    cursor += delta;
    renderFrame();
  }

  function play() {
    if (!frames.length) return;
    if (timer) {
      stop();
      return;
    }
    if (cursor >= frames.length - 1) cursor = 0;
    playButton.textContent = 'Pause';
    renderFrame();
    timer = window.setInterval(() => {
      if (cursor >= frames.length - 1) {
        stop();
        return;
      }
      cursor += 1;
      renderFrame();
    }, delayForSpeed());
  }

  runButton.addEventListener('click', run);
  backButton.addEventListener('click', () => step(-1));
  nextButton.addEventListener('click', () => step(1));
  playButton.addEventListener('click', play);
  seek.addEventListener('input', () => {
    stop();
    cursor = Number(seek.value);
    renderFrame();
  });
  speedSelect.addEventListener('change', () => {
    if (timer) {
      stop();
      play();
    }
  });
  algorithmSelect.addEventListener('change', () => {
    stop();
    frames = [];
    seek.disabled = true;
    seek.value = '0';
    seek.max = '0';
    visual.replaceChildren();
    visual.setAttribute('aria-label', 'Run the demo to display a recorded algorithm state.');
    caption.textContent = 'Selection changed. Run the demo to record a new trace.';
    frameMeta.textContent = 'NO TRACE YET';
    status.textContent = '';
  });
  root.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
    if (event.code === 'Space') {
      event.preventDefault();
      play();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop, { once: true });
}

function drawAlgorithmFrame(container, frame) {
  container.replaceChildren();
  container.setAttribute('aria-label', frame.message);
  if (frame.kind === 'array') drawArray(container, frame);
  else if (frame.kind === 'grid') drawGrid(container, frame);
  else if (frame.kind === 'tree') drawTree(container, frame);
  else if (frame.kind === 'queens') drawQueens(container, frame);
  else if (frame.kind === 'pointers') drawPointers(container, frame);
}

function drawArray(container, frame) {
  const visual = el('div', 'array-visual');
  visual.setAttribute('aria-hidden', 'true');
  const low = Math.min(...frame.values);
  const high = Math.max(...frame.values);
  const span = Math.max(1, high - low);
  frame.values.forEach((value, index) => {
    const cell = el('div', 'array-cell');
    if (frame.active?.includes(index)) cell.classList.add('is-active');
    if (frame.current?.includes(index)) cell.classList.add('is-current');
    if (frame.found?.includes(index)) cell.classList.add('is-found');
    if (frame.left === index || frame.right === index) cell.classList.add('is-window');
    if (frame.sorted?.includes(index)) cell.classList.add('is-visited');
    const bar = el('div', 'array-bar');
    const heightClass = Math.max(1, Math.min(10, Math.round(((value - low) / span) * 9) + 1));
    bar.classList.add(`bar-level-${heightClass}`);
    const number = el('span', '', String(value));
    const pointer = el('span', 'array-pointer');
    const labels = [];
    if (frame.left === index) labels.push('L');
    if (frame.right === index) labels.push('R');
    pointer.textContent = labels.join('·');
    cell.append(bar, number, pointer);
    visual.append(cell);
  });
  container.append(visual);
  if (frame.prefix) {
    const prefix = el('p', 'demo-status', `Recorded prefix: [${frame.prefix.join(', ')}]`);
    container.append(prefix);
  }
  if (frame.query) {
    const query = el('p', 'demo-status', `Range [${frame.query.left}, ${frame.query.right}] → ${frame.query.sum}`);
    container.append(query);
  }
  if (Number.isFinite(frame.best)) {
    const best = el('p', 'demo-status', `Shortest qualifying window length: ${frame.best}`);
    container.append(best);
  }
}

function drawGrid(container, frame) {
  const grid = el('div', 'grid-visual');
  grid.classList.add('grid-visual-seven-columns');
  const visited = new Set(frame.visited);
  const walls = new Set(frame.walls);
  const path = new Set(frame.path);
  for (let row = 0; row < frame.rows; row += 1) {
    for (let col = 0; col < frame.cols; col += 1) {
      const key = `${row},${col}`;
      const cell = el('div', 'grid-cell');
      if (walls.has(key)) cell.classList.add('is-wall');
      if (visited.has(key)) cell.classList.add('is-visited');
      if (path.has(key)) cell.classList.add('is-path');
      if (frame.current === key) cell.classList.add('is-current');
      if (key === frame.start) cell.textContent = 'S';
      else if (key === frame.goal) cell.textContent = 'G';
      else if (walls.has(key)) cell.textContent = '×';
      cell.setAttribute('aria-hidden', 'true');
      grid.append(cell);
    }
  }
  grid.setAttribute('aria-label', `Pathfinding grid, ${frame.visited.length} cells visited.`);
  container.append(grid);
}

function drawTree(container, frame) {
  const tree = el('div', 'tree-visual');
  const levels = [[0], [1, 2], [3, 4, 5, 6]];
  const visited = new Set(frame.visited);
  levels.forEach((indices) => {
    const row = el('div', 'tree-level');
    indices.forEach((index) => {
      const node = el('span', 'tree-node', frame.values[index]);
      if (visited.has(index)) node.classList.add('is-visited');
      if (frame.current === index) node.classList.add('is-current');
      row.append(node);
    });
    tree.append(row);
  });
  tree.setAttribute('aria-label', `Preorder tree traversal. Visited nodes: ${frame.visited.map((index) => frame.values[index]).join(', ') || 'none'}.`);
  container.append(tree);
}

function drawQueens(container, frame) {
  const board = el('div', 'queen-board');
  for (let row = 0; row < frame.size; row += 1) {
    for (let col = 0; col < frame.size; col += 1) {
      const square = el('div', 'queen-square');
      if (frame.positions[row] === col) square.textContent = '♛';
      if (frame.attempt?.row === row && frame.attempt?.col === col) square.classList.add(frame.attempt.valid ? 'is-current' : 'is-wall');
      board.append(square);
    }
  }
  board.setAttribute('aria-label', `Four queens board. ${frame.positions.filter((col) => Number.isInteger(col)).length} queens placed.`);
  container.append(board);
}

function drawPointers(container, frame) {
  const row = el('div', 'array-visual');
  row.setAttribute('aria-hidden', 'true');
  [...frame.text].forEach((character, index) => {
    const cell = el('div', 'array-cell');
    if (frame.matched.includes(index)) cell.classList.add('is-visited');
    if (index === frame.left || index === frame.right) cell.classList.add('is-active');
    const bar = el('div', 'array-bar bar-level-5');
    const value = el('span', '', character);
    const pointers = [];
    if (index === frame.left) pointers.push('L');
    if (index === frame.right) pointers.push('R');
    cell.append(bar, value, el('span', 'array-pointer', pointers.join('·')));
    row.append(cell);
  });
  container.append(row);
}

function renderVoyager(root) {
  root.replaceChildren();
  const heading = el('div', 'demo-panel-header');
  const title = el('div');
  title.append(el('span', 'demo-label', 'PORTFOLIO MOCK · NO NETWORK CALL'), el('h3', '', 'Build a sample trip envelope'));
  heading.append(title, el('span', 'snapshot-tag', 'DETERMINISTIC DEMO'));
  root.append(heading);

  const form = el('form', 'demo-form');
  form.noValidate = true;
  const destination = demoInput(form, 'Destination', 'destination', 'text', 'e.g. Bengaluru');
  destination.value = 'Bengaluru';
  destination.required = true;
  destination.maxLength = 80;
  const days = demoInput(form, 'Days', 'days', 'number');
  days.min = '1';
  days.max = '15';
  days.step = '1';
  days.value = '3';
  days.required = true;
  const budget = demoInput(form, 'Total budget cap (INR)', 'budget', 'number');
  budget.min = '1000';
  budget.max = '1000000';
  budget.step = '500';
  budget.value = '15000';
  budget.required = true;
  const styleWrap = el('label', 'demo-field');
  styleWrap.append(el('span', '', 'Travel style'));
  const style = el('select');
  style.name = 'style';
  [['balanced', 'Balanced'], ['slow', 'Slow travel'], ['active', 'Active'], ['culture', 'Culture-led']].forEach(([value, label]) => {
    const option = el('option', '', label);
    option.value = value;
    style.append(option);
  });
  styleWrap.append(style);
  form.append(styleWrap);
  const run = button('Generate mock itinerary', 'button button-primary demo-field-full');
  run.type = 'submit';
  form.append(run);
  root.append(form);

  const pipeline = el('div', 'pipeline-track');
  const stageData = [
    ['INPUT', 'destination · days · cap'],
    ['MODEL OUTPUT', 'mock itinerary array'],
    ['VALIDATION', 'shape checked locally'],
    ['LOCATION', 'placeholder · not geocoded'],
    ['COST', 'shares recomputed'],
    ['DISPLAY', 'mock result only'],
  ];
  const stages = stageData.map(([label, note]) => {
    const step = el('div', 'pipeline-step');
    step.append(el('b', '', label), el('small', '', note));
    pipeline.append(step);
    return step;
  });
  root.append(pipeline);
  const status = el('p', 'demo-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.append(status);
  const result = el('div', 'mock-itinerary');
  result.hidden = true;
  result.setAttribute('aria-label', 'Mock itinerary output');
  root.append(result);
  const costNote = el('p', 'demo-status');
  root.append(costNote);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    result.replaceChildren();
    costNote.textContent = '';
    stages.forEach((stage) => stage.classList.remove('is-done', 'is-unavailable'));
    const cleanDestination = destination.value.trim().replace(/\p{Cc}/gu, '');
    const count = Number(days.value);
    const cap = Number(budget.value);
    if (!cleanDestination || !Number.isInteger(count) || count < 1 || count > 15 || !Number.isInteger(cap) || cap < 1000 || cap > 1000000) {
      status.className = 'demo-status is-error';
      status.textContent = 'Enter a destination, 1–15 days, and a whole-number budget cap from ₹1,000 to ₹1,000,000.';
      (cleanDestination ? (!Number.isInteger(count) || count < 1 || count > 15 ? days : budget) : destination).focus();
      return;
    }
    stages.forEach((stage, index) => stage.classList.add(index === 3 ? 'is-unavailable' : 'is-done'));
    status.className = 'demo-status is-success';
    status.textContent = `Mock plan for ${cleanDestination}: ${count} day${count === 1 ? '' : 's'} · ${style.options[style.selectedIndex].text}. No LLM or geocoding request was made.`;
    result.hidden = false;
    for (let index = 1; index <= count; index += 1) {
      const day = el('div', 'mock-day');
      day.append(el('b', '', `DAY ${String(index).padStart(2, '0')}`), el('span', '', `${cleanDestination} · sample planning blocks A and B`), el('small', '', 'PLACEHOLDERS · NOT VERIFIED'));
      result.append(day);
    }
    const shares = [40, 25, 25, 10];
    const totalShare = shares.reduce((sum, value) => sum + value, 0);
    costNote.textContent = `Cost guardrail illustration: ${shares.join('% + ')}% = ${totalShare}% of your entered ₹${cap.toLocaleString('en-IN')} cap. These synthetic shares demonstrate recomputation only; they are not price estimates or a model result.`;
  });
}

function demoInput(form, labelText, name, type, placeholder = '') {
  const label = el('label', 'demo-field');
  label.append(el('span', '', labelText));
  const input = el('input');
  input.name = name;
  input.type = type;
  if (placeholder) input.placeholder = placeholder;
  label.append(input);
  form.append(label);
  return input;
}

function renderEdu2Job(root) {
  root.replaceChildren();
  const heading = el('div', 'demo-panel-header');
  const title = el('div');
  title.append(el('span', 'demo-label', 'SCHEMA VISUALIZATION · NO MODEL CALL'), el('h3', '', 'Inspect the feature handoff'));
  heading.append(title, el('span', 'snapshot-tag', 'LOCAL ONLY'));
  root.append(heading);

  const form = el('form', 'demo-form');
  form.noValidate = true;
  const degreeWrap = el('label', 'demo-field');
  degreeWrap.append(el('span', '', 'Degree'));
  const degree = el('select');
  degree.name = 'degree';
  ['B.Tech', 'B.Sc', 'M.Tech', 'M.Sc', 'MBA'].forEach((label) => degree.append(el('option', '', label)));
  degreeWrap.append(degree);
  const majorWrap = el('label', 'demo-field');
  majorWrap.append(el('span', '', 'Major'));
  const major = el('select');
  major.name = 'major';
  ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Business'].forEach((label) => major.append(el('option', '', label)));
  majorWrap.append(major);
  const cgpa = demoInput(form, 'CGPA (0.00–10.00)', 'cgpa', 'number');
  cgpa.min = '0';
  cgpa.max = '10';
  cgpa.step = '0.01';
  cgpa.value = '8.10';
  cgpa.required = true;
  const skills = demoInput(form, 'Skills (comma-separated)', 'skills', 'text', 'Java, Python, SQL, data structures');
  skills.value = 'Java, Python, SQL, Data Structures';
  skills.maxLength = 500;
  skills.required = true;
  skills.closest('label')?.classList.add('demo-field-full');
  const run = button('Visualize feature pipeline', 'button button-primary demo-field-full');
  run.type = 'submit';
  form.append(degreeWrap, majorWrap, run);
  root.append(form);

  const pipeline = el('div', 'pipeline-track');
  const pipelineLabels = [
    ['REACT INPUT', 'student profile'],
    ['SPRING BOOT', 'application API'],
    ['PREPROCESSING', 'encode + scale'],
    ['FLASK', 'model boundary'],
    ['RANDOM FOREST', 'not called here'],
    ['TOP FIVE', 'not simulated'],
  ];
  const stages = pipelineLabels.map(([label, note], index) => {
    const item = el('div', 'pipeline-step');
    if (index >= 3) item.classList.add('is-unavailable');
    item.append(el('b', '', label), el('small', '', note));
    pipeline.append(item);
    return item;
  });
  root.append(pipeline);
  const preview = el('div', 'edu-feature-preview');
  preview.hidden = true;
  root.append(preview);
  const status = el('p', 'demo-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.append(status);
  const boundary = el('div', 'edu-demo-boundary', 'Model inference is intentionally not connected in this portfolio. No job-role probabilities or recommendations are fabricated.');
  root.append(boundary);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const score = Number(cgpa.value);
    const tokens = skills.value.split(',').map((item) => item.trim().replace(/\p{Cc}/gu, '')).filter(Boolean).slice(0, 20);
    if (!Number.isFinite(score) || score < 0 || score > 10 || tokens.length === 0) {
      status.className = 'demo-status is-error';
      status.textContent = 'Enter a CGPA from 0 to 10 and at least one skill token.';
      (!Number.isFinite(score) || score < 0 || score > 10 ? cgpa : skills).focus();
      return;
    }
    stages.forEach((stage, index) => {
      stage.classList.toggle('is-done', index < 3);
      stage.classList.toggle('is-unavailable', index >= 3);
    });
    preview.replaceChildren();
    const fields = [
      ['CATEGORICAL · DEGREE', degree.value],
      ['CATEGORICAL · MAJOR', major.value],
      ['NUMERIC · CGPA INPUT', score.toFixed(2)],
      ['MULTI-LABEL · SKILLS', tokens.map((token) => token.toUpperCase()).join(' · ')],
    ];
    fields.forEach(([label, value]) => {
      const cell = el('div', 'feature-preview-cell');
      cell.append(el('small', '', label), el('b', '', value));
      preview.append(cell);
    });
    preview.hidden = false;
    status.className = 'demo-status is-success';
    status.textContent = 'Input accepted by the local schema view. Scaler parameters and encoder vocabularies are not loaded from the production model.';
  });
}
