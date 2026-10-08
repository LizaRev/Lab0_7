import { Vector2 } from './vector.js';
import type { EntityId } from '../types.js';

export type EntityKind =
  | 'entity'
  | 'ship'
  | 'asteroid'
  | 'bullet'
  | 'pickup'
  | 'explosion';

export interface EntityWorld {
  spawn(entity: Entity): Entity;
  dispatchEvent(event: Event): boolean;
  ofKind(kind: EntityKind): Generator<Entity>;
}

export interface HomingBehavior {
  target: Entity;
  update(entity: Entity, dt: number): void;
}

export class Entity {
  static #nextId = 1;

  readonly id: EntityId;

  pos: Vector2;
  previousPos: Vector2;
  vel: Vector2;

  angle: number;
  radius: number;
  alive: boolean;
  kind: EntityKind;

  homing: HomingBehavior | null;
  world: EntityWorld | null;

  constructor(
    x: number = 0,
    y: number = 0,
    vx: number = 0,
    vy: number = 0,
    angle: number = 0,
    radius: number = 10,
    kind: EntityKind = 'entity'
  ) {
    this.id = Entity.#nextId++ as EntityId;

    this.pos = new Vector2(x, y);
    this.previousPos = new Vector2(x, y);
    this.vel = new Vector2(vx, vy);

    this.angle = angle;
    this.radius = radius;
    this.alive = true;
    this.kind = kind;

    this.homing = null;
    this.world = null;
  }

  update(dt: number, _inputs?: unknown): void {
    this.previousPos = this.pos;

    this.pos = this.pos.add(
      this.vel.scale(dt)
    );
  }
}
