import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTopbarLayout } from './topbarLayout.js';

test('keeps a fitting desktop navigation expanded for page centering', () => {
  assert.deepEqual(resolveTopbarLayout({
    viewportWidth: 1600,
    containerWidth: 1200,
    navContentWidth: 760
  }), {
    collapsed: false,
    aligned: true
  });
});

test('uses the compact menu when the navigation cannot fit', () => {
  assert.deepEqual(resolveTopbarLayout({
    viewportWidth: 1600,
    containerWidth: 600,
    navContentWidth: 760
  }), {
    collapsed: true,
    aligned: false
  });
});

test('keeps the compact menu at narrow viewport widths', () => {
  assert.deepEqual(resolveTopbarLayout({
    viewportWidth: 1023,
    containerWidth: 1200,
    navContentWidth: 760
  }), {
    collapsed: true,
    aligned: false
  });
});
