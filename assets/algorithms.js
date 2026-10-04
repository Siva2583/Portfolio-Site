const SORT_INPUT = [7, 3, 6, 2, 5, 1];
const WINDOW_INPUT = [2, 1, 5, 2, 3, 2];
const PREFIX_INPUT = [3, 2, 4, 1];
const TREE_VALUES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function clone(values) {
  return values.map((value) => (Array.isArray(value) ? [...value] : value));
}

function arrayFrame(values, properties = {}) {
  return {
    kind: 'array',
    values: [...values],
    active: [],
    current: [],
    found: [],
    sorted: [],
    message: '',
    ...properties,
  };
}

export function createBubbleSortFrames(input = SORT_INPUT) {
  if (!Array.isArray(input) || input.length < 2 || input.length > 24) {
    throw new RangeError('Sorting input must contain between 2 and 24 integers.');
  }
  if (input.some((value) => !Number.isInteger(value) || value < -999 || value > 999)) {
    throw new TypeError('Sorting values must be integers from -999 to 999.');
  }

  const values = [...input];
  const frames = [arrayFrame(values, { message: 'Input validated. The trace is recorded before playback.' })];
  let comparisons = 0;
  const sorted = [];

  for (let end = values.length - 1; end > 0; end -= 1) {
    let swapped = false;
    for (let index = 0; index < end; index += 1) {
      comparisons += 1;
      frames.push(arrayFrame(values, {
        active: [index, index + 1],
        sorted: [...sorted],
        message: `Compare ${values[index]} and ${values[index + 1]}.`,
        comparisons,
      }));
      if (values[index] > values[index + 1]) {
        [values[index], values[index + 1]] = [values[index + 1], values[index]];
        swapped = true;
        frames.push(arrayFrame(values, {
          active: [index, index + 1],
          sorted: [...sorted],
          message: 'Swap the out-of-order pair; this snapshot is now on the timeline.',
          comparisons,
        }));
      }
    }
    sorted.unshift(end);
    frames.push(arrayFrame(values, {
      sorted: [...sorted],
      message: `${values[end]} is in its final position.`,
      comparisons,
    }));
    if (!swapped) break;
  }

  frames.push(arrayFrame(values, {
    sorted: values.map((_, index) => index),
    message: `Complete. ${comparisons} comparisons were recorded for this demo input.`,
    comparisons,
  }));
  return frames;
}

const GRID_ROWS = 5;
const GRID_COLS = 7;
const GRID_WALLS = ['1,1', '1,4', '2,4', '3,2', '3,3'];
const START = '0,0';
const GOAL = '4,6';

function parseCell(key) {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}

function gridFrame(visited, current, path, message) {
  return {
    kind: 'grid',
    rows: GRID_ROWS,
    cols: GRID_COLS,
    walls: [...GRID_WALLS],
    visited: [...visited],
    current,
    path: [...path],
    start: START,
    goal: GOAL,
    message,
  };
}

export function createGridSearchFrames(mode = 'bfs') {
  if (mode !== 'bfs' && mode !== 'dfs') throw new TypeError('Grid mode must be bfs or dfs.');

  const pending = [START];
  const seen = new Set([START]);
  const parents = new Map();
  const visited = [];
  const frames = [gridFrame([], null, [], `${mode.toUpperCase()} starts at the upper-left cell.`)];
  let found = false;

  while (pending.length > 0 && visited.length < GRID_ROWS * GRID_COLS) {
    const current = mode === 'bfs' ? pending.shift() : pending.pop();
    if (!current) break;
    visited.push(current);
    frames.push(gridFrame(visited, current, [], `${mode.toUpperCase()} visits ${current}.`));
    if (current === GOAL) {
      found = true;
      break;
    }

    const { row, col } = parseCell(current);
    const neighbors = [
      [row - 1, col],
      [row, col + 1],
      [row + 1, col],
      [row, col - 1],
    ]
      .filter(([nextRow, nextCol]) => nextRow >= 0 && nextRow < GRID_ROWS && nextCol >= 0 && nextCol < GRID_COLS)
      .map(([nextRow, nextCol]) => `${nextRow},${nextCol}`);
    if (mode === 'dfs') neighbors.reverse();

    for (const neighbor of neighbors) {
      if (seen.has(neighbor) || GRID_WALLS.includes(neighbor)) continue;
      seen.add(neighbor);
      parents.set(neighbor, current);
      pending.push(neighbor);
    }
  }

  let path = [];
  if (found) {
    let cursor = GOAL;
    while (cursor) {
      path.unshift(cursor);
      cursor = parents.get(cursor);
    }
  }
  frames.push(gridFrame(visited, found ? GOAL : null, path, found
    ? `${mode.toUpperCase()} reached the goal. The highlighted route is the discovered path.`
    : `${mode.toUpperCase()} finished without reaching the goal.`));
  return frames;
}

export function createSlidingWindowFrames(input = WINDOW_INPUT, target = 7) {
  if (!Array.isArray(input) || input.length < 1 || input.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new TypeError('The demo sliding-window input must contain positive numbers.');
  }
  if (!Number.isFinite(target) || target <= 0) throw new TypeError('Target must be a positive number.');

  const frames = [arrayFrame(input, { left: 0, right: -1, sum: 0, message: `Find the shortest positive-number window with sum ≥ ${target}.` })];
  let left = 0;
  let sum = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let right = 0; right < input.length; right += 1) {
    sum += input[right];
    frames.push(arrayFrame(input, {
      left,
      right,
      sum,
      message: `Add ${input[right]} at the right edge; the window sum is ${sum}.`,
    }));
    while (sum >= target) {
      best = Math.min(best, right - left + 1);
      frames.push(arrayFrame(input, {
        left,
        right,
        sum,
        found: Array.from({ length: right - left + 1 }, (_, offset) => left + offset),
        best,
        message: `Sum ${sum} meets the target. Record length ${right - left + 1}, then shrink from the left.`,
      }));
      sum -= input[left];
      left += 1;
      frames.push(arrayFrame(input, {
        left,
        right,
        sum,
        best,
        message: `Remove the outgoing value; the current sum is ${sum}.`,
      }));
    }
  }
  frames.push(arrayFrame(input, {
    left,
    right: input.length - 1,
    sum,
    best: Number.isFinite(best) ? best : 0,
    message: Number.isFinite(best) ? `Complete. Shortest qualifying window length: ${best}.` : 'No qualifying window exists.',
  }));
  return frames;
}

export function createPrefixSumFrames(input = PREFIX_INPUT, left = 1, right = 3) {
  if (!Array.isArray(input) || input.length < 1 || input.some((value) => !Number.isFinite(value))) {
    throw new TypeError('Prefix-sum input must be a non-empty numeric array.');
  }
  if (!Number.isInteger(left) || !Number.isInteger(right) || left < 0 || right < left || right >= input.length) {
    throw new RangeError('Prefix-sum query bounds are outside the input.');
  }

  const prefix = [0];
  const frames = [arrayFrame(input, { prefix: [...prefix], current: [], message: 'Start with prefix[0] = 0.' })];
  input.forEach((value, index) => {
    prefix.push(prefix[index] + value);
    frames.push(arrayFrame(input, {
      prefix: [...prefix],
      current: [index],
      message: `prefix[${index + 1}] = prefix[${index}] + ${value} = ${prefix[index + 1]}.`,
    }));
  });
  const sum = prefix[right + 1] - prefix[left];
  frames.push(arrayFrame(input, {
    prefix: [...prefix],
    found: Array.from({ length: right - left + 1 }, (_, offset) => left + offset),
    query: { left, right, sum },
    message: `Range sum [${left}, ${right}] = prefix[${right + 1}] − prefix[${left}] = ${sum}.`,
  }));
  return frames;
}

export function createTwoPointerFrames(text = 'racecar') {
  if (typeof text !== 'string' || text.length < 1 || text.length > 32) throw new TypeError('Text must contain 1–32 characters.');
  const normalized = text.toLowerCase();
  const frames = [{ kind: 'pointers', text, left: 0, right: text.length - 1, matched: [], message: 'Compare characters from both ends.' }];
  const matched = [];
  let left = 0;
  let right = text.length - 1;
  let palindrome = true;
  while (left < right) {
    const same = normalized[left] === normalized[right];
    frames.push({ kind: 'pointers', text, left, right, matched: [...matched], message: `Compare “${text[left]}” with “${text[right]}”: ${same ? 'match' : 'mismatch'}.` });
    if (!same) {
      palindrome = false;
      break;
    }
    matched.push(left, right);
    left += 1;
    right -= 1;
  }
  frames.push({ kind: 'pointers', text, left, right, matched: [...matched], palindrome, message: palindrome ? 'Complete. The two-pointer check confirms a palindrome.' : 'Complete. The characters do not form a palindrome.' });
  return frames;
}

export function createTreeTraversalFrames() {
  const order = [0, 1, 3, 4, 2, 5, 6];
  const visited = [];
  const frames = [{ kind: 'tree', values: [...TREE_VALUES], visited: [], current: null, message: 'Preorder: visit node, then left subtree, then right subtree.' }];
  for (const index of order) {
    visited.push(index);
    frames.push({ kind: 'tree', values: [...TREE_VALUES], visited: [...visited], current: index, message: `Visit node ${TREE_VALUES[index]} (${index === 0 || index === 2 ? 'root/branch' : 'leaf'}).` });
  }
  return frames;
}

export function createNQueensFrames(size = 4) {
  if (size !== 4) throw new RangeError('This bounded portfolio demo uses a 4×4 board.');
  const positions = [];
  const frames = [{ kind: 'queens', size, positions: [], attempt: null, message: 'Place one queen per row without sharing a column or diagonal.' }];
  let solved = false;

  function isSafe(row, col) {
    for (let previousRow = 0; previousRow < row; previousRow += 1) {
      const previousCol = positions[previousRow];
      if (previousCol === col || Math.abs(previousCol - col) === row - previousRow) return false;
    }
    return true;
  }

  function search(row) {
    if (row === size) return true;
    for (let col = 0; col < size; col += 1) {
      const valid = isSafe(row, col);
      frames.push({ kind: 'queens', size, positions: [...positions], attempt: { row, col, valid }, message: valid ? `Try row ${row + 1}, column ${col + 1}.` : `Reject row ${row + 1}, column ${col + 1}; it conflicts with an earlier queen.` });
      if (!valid) continue;
      positions[row] = col;
      frames.push({ kind: 'queens', size, positions: [...positions], attempt: null, message: `Record queen at row ${row + 1}, column ${col + 1}.` });
      if (search(row + 1)) return true;
      positions.pop();
      frames.push({ kind: 'queens', size, positions: [...positions], attempt: null, message: `Backtrack from row ${row + 1}; try another column.` });
    }
    return false;
  }

  solved = search(0);
  frames.push({ kind: 'queens', size, positions: [...positions], attempt: null, solved, message: solved ? 'Complete. A valid 4-queen arrangement was found.' : 'No arrangement found.' });
  return frames;
}

export const ALGORITHM_OPTIONS = [
  { value: 'sort', label: 'Sorting · Bubble sort' },
  { value: 'bfs', label: 'BFS · grid pathfinder' },
  { value: 'dfs', label: 'DFS · grid pathfinder' },
  { value: 'tree', label: 'Tree traversal · preorder' },
  { value: 'queens', label: 'N-Queens · 4 × 4' },
  { value: 'window', label: 'Sliding window · shortest qualifying range' },
  { value: 'pointers', label: 'Two pointers · palindrome check' },
  { value: 'prefix', label: 'Prefix sum · range query' },
];

export function createAlgorithmFrames(name) {
  switch (name) {
    case 'sort': return createBubbleSortFrames();
    case 'bfs': return createGridSearchFrames('bfs');
    case 'dfs': return createGridSearchFrames('dfs');
    case 'tree': return createTreeTraversalFrames();
    case 'queens': return createNQueensFrames();
    case 'window': return createSlidingWindowFrames();
    case 'pointers': return createTwoPointerFrames();
    case 'prefix': return createPrefixSumFrames();
    default: throw new TypeError('Unknown algorithm demo.');
  }
}

export function getAlgorithmDemoInput() {
  return {
    sorting: clone(SORT_INPUT),
    slidingWindow: clone(WINDOW_INPUT),
    prefixSum: clone(PREFIX_INPUT),
    tree: clone(TREE_VALUES),
  };
}
