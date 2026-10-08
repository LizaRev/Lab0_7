import { describe, expect, test } from 'vitest';

import { Vector2 } from './vector.js';

describe('Vector2', () => {
  test('creates vector with given coordinates', () => {
    const vector = new Vector2(3, 4);

    expect(vector.x).toBe(3);
    expect(vector.y).toBe(4);
  });

  test('adds two vectors', () => {
    const result = new Vector2(2, 3).add(new Vector2(4, 5));

    expect(result.x).toBe(6);
    expect(result.y).toBe(8);
  });

  test('subtracts two vectors', () => {
    const result = new Vector2(7, 6).sub(new Vector2(2, 4));

    expect(result.x).toBe(5);
    expect(result.y).toBe(2);
  });

  test('scales vector', () => {
    const result = new Vector2(2, 3).scale(4);

    expect(result.x).toBe(8);
    expect(result.y).toBe(12);
  });

  test('calculates length', () => {
    const result = new Vector2(3, 4).length();

    expect(result).toBe(5);
  });

  test('normalizes vector', () => {
    const result = new Vector2(3, 4).normalize();

    expect(result.x).toBeCloseTo(0.6);
    expect(result.y).toBeCloseTo(0.8);
    expect(result.length()).toBeCloseTo(1);
  });

  test('normalizes zero vector', () => {
    const result = new Vector2(0, 0).normalize();

    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  test('rotates vector by 90 degrees', () => {
    const result = new Vector2(1, 0).rotate(Math.PI / 2);

    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(1);
  });

  test('calculates dot product', () => {
    const result = new Vector2(2, 3).dot(new Vector2(4, 5));

    expect(result).toBe(23);
  });

  test('creates vector from angle', () => {
    const result = Vector2.fromAngle(0);

    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(0);
  });
});
