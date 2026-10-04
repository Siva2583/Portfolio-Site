import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAlgorithmFrames,
  createBubbleSortFrames,
  createGridSearchFrames,
  createNQueensFrames,
  createPrefixSumFrames,
  createSlidingWindowFrames,
  createTreeTraversalFrames,
  createTwoPointerFrames,
} from '../assets/algorithms.js';

function bruteForceShortestWindow(values, target) {
  let best = Number.POSITIVE_INFINITY;
  for (let left = 0; left < values.length; left += 1) {
    let sum = 0;
    for (let right = left; right < values.length; right += 1) {
      sum += values[right];
      if (sum >= target) best = Math.min(best, right - left + 1);
    }
  }
  return Number.isFinite(best) ? best : 0;
}

test('sorting records isolated snapshots and leaves its input untouched', () => {
  const input = [4, 1, 3, 2];
  const frames = createBubbleSortFrames(input);
  assert.deepEqual(input, [4, 1, 3, 2]);
  assert.deepEqual(frames.at(-1).values, [1, 2, 3, 4]);
  assert.notEqual(frames[0].values, frames.at(-1).values);
  assert.notEqual(frames[0].values, frames[1].values);
  assert.throws(() => createBubbleSortFrames([1]), RangeError);
  assert.throws(() => createBubbleSortFrames([1, 1000]), TypeError);
});

test('BFS finds a shortest path on the bounded unweighted grid; DFS reaches the same goal', () => {
  const bfs = createGridSearchFrames('bfs').at(-1);
  const dfs = createGridSearchFrames('dfs').at(-1);
  assert.equal(bfs.path[0], '0,0');
  assert.equal(bfs.path.at(-1), '4,6');
  assert.equal(dfs.path[0], '0,0');
  assert.equal(dfs.path.at(-1), '4,6');
  assert.ok(bfs.path.length <= dfs.path.length);
});

test('sliding-window frames agree with a brute-force oracle on positive demo inputs', () => {
  let seed = 29;
  for (let caseNumber = 0; caseNumber < 50; caseNumber += 1) {
    seed = (seed * 48271) % 2147483647;
    const length = 1 + (seed % 8);
    const values = [];
    for (let index = 0; index < length; index += 1) {
      seed = (seed * 48271) % 2147483647;
      values.push(1 + (seed % 9));
    }
    const target = 1 + (seed % 24);
    const frames = createSlidingWindowFrames(values, target);
    assert.equal(frames.at(-1).best, bruteForceShortestWindow(values, target));
  }
});

test('prefix-sum trace computes a validated inclusive range', () => {
  const frames = createPrefixSumFrames([3, 2, 4, 1], 1, 3);
  assert.deepEqual(frames[1].prefix, [0, 3]);
  assert.equal(frames.at(-1).query.sum, 7);
  assert.throws(() => createPrefixSumFrames([1, 2], 1, 3), RangeError);
});

test('two pointers, preorder tree, and 4-queens produce bounded traces', () => {
  assert.equal(createTwoPointerFrames('racecar').at(-1).palindrome, true);
  assert.equal(createTwoPointerFrames('racer').at(-1).palindrome, false);
  assert.deepEqual(createTreeTraversalFrames().at(-1).visited, [0, 1, 3, 4, 2, 5, 6]);
  const queens = createNQueensFrames().at(-1);
  assert.equal(queens.solved, true);
  assert.equal(queens.positions.length, 4);
  assert.throws(() => createNQueensFrames(8), RangeError);
});

test('algorithm selector only exposes implemented portfolio demos', () => {
  for (const name of ['sort', 'bfs', 'dfs', 'tree', 'queens', 'window', 'pointers', 'prefix']) {
    assert.ok(createAlgorithmFrames(name).length > 1, `${name} should record more than one frame`);
  }
  assert.throws(() => createAlgorithmFrames('dijkstra'), TypeError);
});
