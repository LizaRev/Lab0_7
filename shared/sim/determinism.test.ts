import { describe, expect, test } from 'vitest';

import { World } from './world.js';

describe('World', () => {
  test('is deterministic with the same seed', () => {
    const worldA = new World(12345);
    const worldB = new World(12345);

    worldA.width = 800;
    worldA.height = 500;

    worldB.width = 800;
    worldB.height = 500;

    const asteroidA1 = worldA.createAsteroid();
    const asteroidA2 = worldA.createAsteroid();

    const asteroidB1 = worldB.createAsteroid();
    const asteroidB2 = worldB.createAsteroid();

    expect({
      x: asteroidA1.pos.x,
      y: asteroidA1.pos.y,
      vx: asteroidA1.vel.x,
      vy: asteroidA1.vel.y,
      radius: asteroidA1.radius,
    }).toEqual({
      x: asteroidB1.pos.x,
      y: asteroidB1.pos.y,
      vx: asteroidB1.vel.x,
      vy: asteroidB1.vel.y,
      radius: asteroidB1.radius,
    });

    expect({
      x: asteroidA2.pos.x,
      y: asteroidA2.pos.y,
      vx: asteroidA2.vel.x,
      vy: asteroidA2.vel.y,
      radius: asteroidA2.radius,
    }).toEqual({
      x: asteroidB2.pos.x,
      y: asteroidB2.pos.y,
      vx: asteroidB2.vel.x,
      vy: asteroidB2.vel.y,
      radius: asteroidB2.radius,
    });
  });

  test('produces the same state after the same step', () => {
    const worldA = new World(12345);
    const worldB = new World(12345);

    const asteroidA = worldA.createAsteroid();
    const asteroidB = worldB.createAsteroid();

    worldA.spawn(asteroidA);
    worldB.spawn(asteroidB);

    const input = {
      width: 800,
      height: 500,
    };

    worldA.step(1 / 30, input);
    worldB.step(1 / 30, input);

    const entitiesA = [...worldA].map((entity) => ({
      kind: entity.kind,
      x: entity.pos.x,
      y: entity.pos.y,
      vx: entity.vel.x,
      vy: entity.vel.y,
      radius: entity.radius,
      alive: entity.alive,
    }));

    const entitiesB = [...worldB].map((entity) => ({
      kind: entity.kind,
      x: entity.pos.x,
      y: entity.pos.y,
      vx: entity.vel.x,
      vy: entity.vel.y,
      radius: entity.radius,
      alive: entity.alive,
    }));

    expect(entitiesA).toEqual(entitiesB);
    expect(worldA.score).toBe(worldB.score);
    expect(worldA.respawnTimer).toBe(worldB.respawnTimer);
    expect(worldA.asteroidRespawnTimers).toEqual(
      worldB.asteroidRespawnTimers
    );
  });
});
