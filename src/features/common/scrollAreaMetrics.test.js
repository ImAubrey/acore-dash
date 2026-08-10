import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateScrollMetrics, calculateTrackTarget, clampScrollValue } from './scrollAreaMetrics.js';

const globalStyles = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

test('calculateScrollMetrics maps viewport scroll to a bounded thumb', () => {
  assert.deepEqual(calculateScrollMetrics({
    clientSize: 200,
    scrollSize: 1000,
    scrollValue: 400,
    trackSize: 100
  }), {
    visible: true,
    thumbSize: 28,
    thumbOffset: 36,
    maximum: 800,
    value: 400
  });
});

test('calculateScrollMetrics hides a track without overflow and clamps stale positions', () => {
  assert.deepEqual(calculateScrollMetrics({
    clientSize: 300,
    scrollSize: 200,
    scrollValue: 80,
    trackSize: 120
  }), {
    visible: false,
    thumbSize: 0,
    thumbOffset: 0,
    maximum: 0,
    value: 0
  });
});

test('calculateTrackTarget centers the thumb on a track click and clamps the edges', () => {
  assert.equal(calculateTrackTarget({ clickPosition: 50, trackSize: 100, thumbSize: 20, maximum: 800 }), 400);
  assert.equal(calculateTrackTarget({ clickPosition: -20, trackSize: 100, thumbSize: 20, maximum: 800 }), 0);
  assert.equal(calculateTrackTarget({ clickPosition: 120, trackSize: 100, thumbSize: 20, maximum: 800 }), 800);
});

test('metric helpers keep malformed or transient layout values bounded', () => {
  assert.equal(clampScrollValue(Number.NaN, 4, 12), 4);
  assert.equal(clampScrollValue(30, 12, 4), 12);
  assert.equal(calculateTrackTarget({ clickPosition: 20, trackSize: 0, thumbSize: 5, maximum: 100 }), 0);
  assert.deepEqual(calculateScrollMetrics({
    clientSize: 0,
    scrollSize: 100,
    scrollValue: 20,
    trackSize: 80
  }), {
    visible: false,
    thumbSize: 0,
    thumbOffset: 0,
    maximum: 100,
    value: 20
  });
});

test('custom scrollbar keeps a full-size hit box around a thin centered thumb', () => {
  assert.match(globalStyles, /--scrollbar-hit-size:\s*12px/);
  assert.match(globalStyles, /--scrollbar-visual-size:\s*4px/);
  assert.match(globalStyles, /\.js-scroll-area__thumb::before\s*\{/);
  assert.match(globalStyles, /\.js-scroll-area__track--vertical \.js-scroll-area__thumb::before/);
  assert.match(globalStyles, /\.js-scroll-area__track--horizontal \.js-scroll-area__thumb::before/);
  assert.doesNotMatch(globalStyles, /\.js-scroll-area__thumb\s*\{[^}]*min-(?:width|height):\s*24px/s);
});
