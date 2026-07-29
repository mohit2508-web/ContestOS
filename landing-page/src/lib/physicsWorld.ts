import Matter from 'matter-js';
import { Cell } from './shatter';

const { Engine, World, Bodies, Body, Composite } = Matter;

export interface PhysicsWorld {
  engine: Matter.Engine;
  floor: Matter.Body;
  shards: Map<Matter.Body, { cell: Cell; opacity: number }>;
}

const MAX_SHARDS = 150;
const FLOOR_THICKNESS = 60;

export function createWorld(width: number, height: number): PhysicsWorld {
  const engine = Engine.create({
    gravity: { x: 0, y: 1.2 },
  });

  const floor = Bodies.rectangle(width / 2, height + FLOOR_THICKNESS / 2, width * 2, FLOOR_THICKNESS, {
    isStatic: true,
    friction: 0.3,
    restitution: 0.2,
  });

  World.add(engine.world, [floor]);

  return {
    engine,
    floor,
    shards: new Map(),
  };
}

export function addShard(
  world: PhysicsWorld,
  cell: Cell,
  impulseX: number,
  impulseY: number,
): Matter.Body | null {
  if (world.shards.size >= MAX_SHARDS) return null;

  const { polygon, center, area } = cell;

  const maxDim = Math.sqrt(area) * 0.8;
  const clampedRadius = Math.max(4, Math.min(maxDim, 50));

  const body = Bodies.circle(center[0], center[1], clampedRadius, {
    friction: 0.4,
    restitution: 0.3,
    density: 0.002,
    frictionAir: 0.01,
  });

  Body.setVelocity(body, {
    x: impulseX * 0.3 + (Math.random() - 0.5) * 2,
    y: impulseY * 0.3,
  });

  Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.15);

  Composite.add(world.engine.world, body);
  world.shards.set(body, { cell, opacity: 1 });

  return body;
}

export function step(world: PhysicsWorld, delta: number = 1000 / 60) {
  Engine.update(world.engine, delta);
}

export function removeExitedShards(world: PhysicsWorld, viewportHeight: number) {
  const toRemove: Matter.Body[] = [];

  for (const [body, data] of world.shards) {
    if (body.position.y > viewportHeight + 100) {
      toRemove.push(body);
      data.opacity = Math.max(0, data.opacity - 0.1);
    }
  }

  for (const body of toRemove) {
    Composite.remove(world.engine.world, body);
    world.shards.delete(body);
  }
}

export function destroy(world: PhysicsWorld) {
  for (const [body] of world.shards) {
    Composite.remove(world.engine.world, body);
  }
  World.clear(world.engine.world, false);
  Engine.clear(world.engine);
  world.shards.clear();
}
