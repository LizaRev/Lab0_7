import { describe, expect, test } from 'vitest';

import {
  encodeSnapshot,
  decodeSnapshot,
} from '../../shared/protocol/binary.js';

import type {
  SnapshotMessageWithWorld,
} from '../../shared/protocol/binary.js';

describe('binary protocol', () => {
  test('binary snapshot encode/decode keeps data', () => {
    const snapshot: SnapshotMessageWithWorld = {
      version: 1,

      type: 'snapshot',

      roomId: 'alpha',

      playerId: 'player-1',

      playerShipId: '1',

      lastProcessedSeq: 5,

      world: {
        width: 800,

        height: 500,

        score: 100,

        entities: [
          {
            id: '1',

            kind: 'ship',

            x: 100,

            y: 200,

            angle: 1,

            vx: 10,

            vy: 20,

            radius: 20,

            hp: 3,

            thrust: 0.5,

            shield: true,

            alive: true,
          },
        ],
      },
    };

    const encoded = encodeSnapshot(snapshot);

    const decoded = decodeSnapshot(encoded);

    expect(decoded.version).toBe(
      snapshot.version
    );

    expect(decoded.type).toBe(
      snapshot.type
    );

    expect(decoded.roomId).toBe(
      snapshot.roomId
    );

    expect(decoded.lastProcessedSeq).toBe(
      snapshot.lastProcessedSeq
    );

    expect(decoded.playerShipId).toBe(
      '1'
    );

    expect(decoded.world.width).toBe(
      snapshot.world.width
    );

    expect(decoded.world.height).toBe(
      snapshot.world.height
    );

    expect(decoded.world.score).toBe(
      snapshot.world.score
    );

    expect(decoded.world.entities.length).toBe(
      1
    );

    const entity =
      decoded.world.entities[0];

    expect(entity).toBeDefined();

    if (!entity) {
      return;
    }

    expect(entity.id).toBe(
      '1'
    );

    expect(entity.kind).toBe(
      'ship'
    );

    expect(entity.x).toBe(
      100
    );

    expect(entity.y).toBe(
      200
    );

    expect(entity.vx).toBe(
      10
    );

    expect(entity.vy).toBe(
      20
    );

    expect(entity.radius).toBe(
      20
    );

    expect(entity.hp).toBe(
      3
    );

    expect(entity.thrust).toBe(
      0.5
    );

    expect(
      Math.abs(
        (entity.angle ?? 0) - 1
      )
    ).toBeLessThan(0.001);
  });
});