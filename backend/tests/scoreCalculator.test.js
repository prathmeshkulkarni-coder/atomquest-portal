import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore } from '../utils/scoreCalculator.js';

describe('calculateScore', () => {
  it('computes min numeric as actual / target * 100', () => {
    assert.equal(calculateScore('Numeric', '100', '80', 'Revenue growth'), 80);
  });

  it('computes max numeric as target / actual * 100', () => {
    assert.equal(calculateScore('Numeric', '10', '8', 'Max'), 125);
  });

  it('uses Min direction by default for numeric', () => {
    assert.equal(calculateScore('Numeric', '100', '80', 'Min'), 80);
  });

  it('returns 100 for zero-based when actual is 0', () => {
    assert.equal(calculateScore('Zero-based', '0', '0'), 100);
    assert.equal(calculateScore('Zero-based', '0', '2'), 0);
  });

  it('returns 100 for timeline when actual is on or before target', () => {
    assert.equal(calculateScore('Timeline', '2026-05-20', '2026-05-18'), 100);
    assert.equal(calculateScore('Timeline', '2026-05-20', '2026-05-25'), 0);
  });

  it('caps scores between 0 and 200', () => {
    const score = calculateScore('Numeric', '10', '1', 'Reduce cost');
    assert.ok(score <= 200);
    assert.ok(score >= 0);
  });
});
