import test from 'node:test';
import assert from 'node:assert/strict';
import { pickImageAtLine, pickVisibleImage } from '../src/follow';

test('returns source-order indexes for the nearest image reached', () => {
  const lines = [8, 25, 41, 90];
  assert.deepEqual([9, 30, 50, 100].map(line => pickImageAtLine(lines, line)), [0, 1, 2, 3]);
  assert.deepEqual(lines, [8, 25, 41, 90]);
});

test('empty images and NaN anchor have no selected image', () => {
  assert.equal(pickImageAtLine([], 0), -1);
  assert.equal(pickImageAtLine([], Number.NaN), -1);
  assert.equal(pickImageAtLine([5, 9], Number.NaN), -1);
});

test('the first image is selected before the first source position', () => {
  assert.equal(pickImageAtLine([20, 50], 0), 0);
  assert.equal(pickImageAtLine([20, 50], 19.999), 0);
  assert.equal(pickImageAtLine([20], -1), 0);
});

test('image boundaries include their exact source line and fractional anchors', () => {
  const lines = [5, 15, 30];
  assert.equal(pickImageAtLine(lines, 5), 0);
  assert.equal(pickImageAtLine(lines, 14.999), 0);
  assert.equal(pickImageAtLine(lines, 15), 1);
  assert.equal(pickImageAtLine(lines, 29.5), 1);
  assert.equal(pickImageAtLine(lines, 30), 2);
  assert.equal(pickImageAtLine(lines, 200), 2);
});

test('images on the same source line select the last occurrence once reached', () => {
  const lines = [5, 5, 10, 10, 10, 20];
  assert.equal(pickImageAtLine(lines, 4), 0);
  assert.equal(pickImageAtLine(lines, 5), 1);
  assert.equal(pickImageAtLine(lines, 9.9), 1);
  assert.equal(pickImageAtLine(lines, 10), 4);
  assert.equal(pickImageAtLine(lines, 19), 4);
  assert.equal(pickImageAtLine(lines, 20), 5);
});

test('one image remains selected across the whole article', () => {
  assert.equal(pickImageAtLine([0], 0), 0);
  assert.equal(pickImageAtLine([0], 1000.5), 0);
});

test('selects the next completely visible figure after the previous figure leaves the viewport', () => {
  assert.equal(pickVisibleImage([
    { index: 0, top: -500, bottom: -10 },
    { index: 1, top: 160, bottom: 280 },
  ], { top: 0, bottom: 600 }), 1);
});

test('a completely visible short image competes by position, not visible area', () => {
  assert.equal(pickVisibleImage([
    { index: 0, top: -500, bottom: 130 },
    { index: 1, top: 240, bottom: 280 },
  ], { top: 0, bottom: 600 }), 1);
});

test('an image covering the reading center takes priority over other visible images', () => {
  assert.equal(pickVisibleImage([
    { index: 0, top: 220, bottom: 280 },
    { index: 1, top: 290, bottom: 900 },
    { index: 2, top: 400, bottom: 500 },
  ], { top: 0, bottom: 600 }), 1);
});

test('follows figures in both scroll directions using viewport coordinates', () => {
  const candidates = [{ index: 0, top: 0, bottom: 160 }, { index: 1, top: 400, bottom: 560 }];
  assert.equal(pickVisibleImage(candidates, { top: 0, bottom: 200 }), 0);
  assert.equal(pickVisibleImage(candidates, { top: 360, bottom: 600 }), 1);
  assert.equal(pickVisibleImage(candidates, { top: 0, bottom: 200 }), 0);
});

test('excludes grazing edges while retaining tiny but genuinely visible images', () => {
  assert.equal(pickVisibleImage([{ index: 0, top: -180, bottom: 20 }], { top: 0, bottom: 600 }), -1);
  assert.equal(pickVisibleImage([{ index: 0, top: 590, bottom: 630 }], { top: 0, bottom: 600 }), 0);
  assert.equal(pickVisibleImage([{ index: 0, top: 300, bottom: 308 }], { top: 0, bottom: 600 }), 0);
  assert.equal(pickVisibleImage([{ index: 0, top: 599, bottom: 607 }], { top: 0, bottom: 600 }), -1);
});

test('empty, invisible or invalid geometry yields no active figure', () => {
  assert.equal(pickVisibleImage([], { top: 0, bottom: 600 }), -1);
  assert.equal(pickVisibleImage([{ index: 0, top: 600, bottom: 800 }], { top: 0, bottom: 600 }), -1);
  assert.equal(pickVisibleImage([{ index: 0, top: -300, bottom: -20 }], { top: 0, bottom: 600 }), -1);
  assert.equal(pickVisibleImage([{ index: 0, top: 20, bottom: 40 }], { top: 0, bottom: 0 }), -1);
  assert.equal(pickVisibleImage([{ index: 0, top: Number.NaN, bottom: 40 }], { top: 0, bottom: 600 }), -1);
});
