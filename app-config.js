'use strict';

const DEFAULT_PREFERENCES = Object.freeze({
  petScheme: 'black-hole',
  blackHoleSize: 0.11,
  diskColor: '#d8894f',
  gravityStrength: 1.25,
  performanceMode: 'auto',
});

const BLACK_HOLE_WINDOW = 414;
const NAILONG_WINDOW = 248;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function normalizePreferences(candidate = {}) {
  const size = Number(candidate.blackHoleSize);
  const gravity = Number(candidate.gravityStrength);
  return {
    petScheme: candidate.petScheme === 'nailong' ? 'nailong' : 'black-hole',
    blackHoleSize: Number.isFinite(size)
      ? clamp(size, 0.06, 0.22)
      : DEFAULT_PREFERENCES.blackHoleSize,
    diskColor: /^#[0-9a-f]{6}$/i.test(String(candidate.diskColor || ''))
      ? String(candidate.diskColor).toLowerCase()
      : DEFAULT_PREFERENCES.diskColor,
    gravityStrength: Number.isFinite(gravity)
      ? clamp(gravity, 0, 2)
      : DEFAULT_PREFERENCES.gravityStrength,
    performanceMode: ['auto', 'quality', 'balanced', 'battery'].includes(candidate.performanceMode)
      ? candidate.performanceMode
      : DEFAULT_PREFERENCES.performanceMode,
  };
}

function windowSizeFor(preferences, growth = 0) {
  if (preferences.petScheme === 'nailong') return NAILONG_WINDOW;
  const scale = preferences.blackHoleSize / DEFAULT_PREFERENCES.blackHoleSize;
  return Math.round(BLACK_HOLE_WINDOW * scale * (1 + clamp(growth, 0, 0.09)));
}

function colorAsRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

function rendererPreferences(preferences, growth = 0) {
  return {
    diskColor: colorAsRgb(preferences.diskColor),
    blackHoleSize: preferences.blackHoleSize,
    gravityStrength: preferences.gravityStrength,
    performanceMode: preferences.performanceMode,
    growth: clamp(growth, 0, 0.09),
  };
}

module.exports = {
  DEFAULT_PREFERENCES,
  BLACK_HOLE_WINDOW,
  NAILONG_WINDOW,
  normalizePreferences,
  windowSizeFor,
  rendererPreferences,
};
