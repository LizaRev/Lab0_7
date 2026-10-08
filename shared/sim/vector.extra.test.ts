import { describe, expect, test } from 'vitest';

import { Vector2 } from './vector.js';

describe('Vector2 extra cases', () => {
  test('normalizes a vector to length one', () => {
    const vector =
      new Vector2(3, 4);

    const normalized =
      vector.normalize();

    expect(normalized.x).toBeCloseTo(0.6);
    expect(normalized.y).toBeCloseTo(0.8);
    expect(normalized.length()).toBeCloseTo(1);
  });

  test('normalizes the zero vector without producing NaN', () => {
    const vector =
      new Vector2(0, 0);

    const normalized =
      vector.normalize();

    expect(normalized.x).toBe(0);
    expect(normalized.y).toBe(0);
  });

  test('rotates a vector by 90 degrees', () => {
    const vector =
      new Vector2(1, 0);

    const rotated =
      vector.rotate(Math.PI / 2);

    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(1);
  });
});
