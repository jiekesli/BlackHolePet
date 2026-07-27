'use strict';

const assert = require('assert');
const {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  rendererPreferences,
  windowSizeFor,
} = require('../app-config');

const defaults = normalizePreferences({});
assert.deepStrictEqual(defaults, DEFAULT_PREFERENCES);

const clamped = normalizePreferences({
  petScheme: 'nailong',
  blackHoleSize: 99,
  gravityStrength: -4,
  diskColor: '#ABCDEF',
  performanceMode: 'battery',
});
assert.strictEqual(clamped.petScheme, 'nailong');
assert.strictEqual(clamped.blackHoleSize, 0.22);
assert.strictEqual(clamped.gravityStrength, 0);
assert.strictEqual(clamped.diskColor, '#abcdef');
assert.strictEqual(clamped.performanceMode, 'battery');
assert.strictEqual(windowSizeFor(clamped), 248);

const blackHole = normalizePreferences(DEFAULT_PREFERENCES);
assert.strictEqual(windowSizeFor(blackHole), 414);
assert(windowSizeFor(blackHole, 0.08) > 414);

const payload = rendererPreferences(blackHole, 0.04);
assert.strictEqual(payload.diskColor.length, 3);
assert.strictEqual(payload.growth, 0.04);

console.log('config tests passed');
