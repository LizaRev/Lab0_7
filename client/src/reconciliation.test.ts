import { describe, expect, test } from 'vitest';

import { reconcilePredictedBullets } from './reconciliation.js';

describe('reconcilePredictedBullets', () => {
  test('removes predicted bullets confirmed by server', () => {
    const predictedBullets = new Map<string, unknown>([
      ['1', {}],
      ['2', {}],
    ]);

    reconcilePredictedBullets(predictedBullets, {
      world: {
        entities: [
          {
            id: '1',
            kind: 'bullet',
          },
        ],
      },
    });

    expect([...predictedBullets.keys()]).toEqual(['2']);
  });

  test('keeps predicted bullets that are not on server', () => {
    const predictedBullets = new Map<string, unknown>([
      ['1', {}],
      ['2', {}],
    ]);

    reconcilePredictedBullets(predictedBullets, {
      world: {
        entities: [
          {
            id: '3',
            kind: 'bullet',
          },
        ],
      },
    });

    expect(predictedBullets.size).toBe(2);
  });

  test('ignores non-bullet server entities', () => {
    const predictedBullets = new Map<string, unknown>([
      ['1', {}],
    ]);

    reconcilePredictedBullets(predictedBullets, {
      world: {
        entities: [
          {
            id: '1',
            kind: 'ship',
          },
        ],
      },
    });

    expect(predictedBullets.size).toBe(1);
  });

  test('handles null snapshot', () => {
    const predictedBullets = new Map<string, unknown>([
      ['1', {}],
    ]);

    reconcilePredictedBullets(predictedBullets, null);

    expect(predictedBullets.size).toBe(1);
  });
});
