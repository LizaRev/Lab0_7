export class Vector2 {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}

  add(other: Vector2): Vector2 {
    return new Vector2(
      this.x + other.x,
      this.y + other.y
    );
  }

  sub(other: Vector2): Vector2 {
    return new Vector2(
      this.x - other.x,
      this.y - other.y
    );
  }

  scale(value: number): Vector2 {
    return new Vector2(
      this.x * value,
      this.y * value
    );
  }

  addInPlace(other: Vector2): Vector2 {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  scaleInPlace(value: number): Vector2 {
    this.x *= value;
    this.y *= value;
    return this;
  }

  set(x: number, y: number): Vector2 {
    this.x = x;
    this.y = y;
    return this;
  }

  length(): number {
    return Math.hypot(
      this.x,
      this.y
    );
  }

  normalize(): Vector2 {
    const length = this.length();

    if (length === 0) {
      return new Vector2(0, 0);
    }

    return new Vector2(
      this.x / length,
      this.y / length
    );
  }

  normalizeInPlace(): Vector2 {
    const length = this.length();

    if (length === 0) {
      this.x = 0;
      this.y = 0;
      return this;
    }

    this.x /= length;
    this.y /= length;

    return this;
  }

  rotate(angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return new Vector2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  dot(other: Vector2): number {
    return (
      this.x * other.x +
      this.y * other.y
    );
  }

  static fromAngle(angle: number): Vector2 {
    return new Vector2(
      Math.cos(angle),
      Math.sin(angle)
    );
  }
}
