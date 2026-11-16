import { CONTENT, type Content } from './content';
import type { GameState } from './state';
import type { SkillId } from './content/types';
import { skillSystem } from './systems/skillSystem';

/** Something notable that happened during simulation (for logs/notifications). */
export type SimEvent =
  | { type: 'actionComplete'; actionId: string; time: number }
  | { type: 'itemGained'; itemId: string; qty: number; time: number }
  | { type: 'levelUp'; skillId: SkillId; level: number; time: number };

export interface SimContext {
  readonly content: Content;
  emit(event: SimEvent): void;
}

/**
 * The engine is event-driven: each system reports the absolute sim time of its
 * next event, and `advance` jumps straight from event to event. No fixed ticks,
 * so very long offline periods cost time proportional to the number of events.
 *
 * Invariant: after `processEvent`, the system's nextEventTime must be strictly
 * later than the time it fired at (otherwise the sim would loop forever).
 */
export interface System {
  readonly id: string;
  nextEventTime(state: GameState): number;
  processEvent(state: GameState, ctx: SimContext): void;
}

/** Registration order is also the tie-break order for simultaneous events. */
export const SYSTEMS: readonly System[] = [skillSystem];

export interface AdvanceOptions {
  systems?: readonly System[];
  content?: Content;
  onEvent?: (event: SimEvent) => void;
}

export interface AdvanceResult {
  eventsProcessed: number;
}

/** Advance the simulation to `toTime` (absolute sim ms). Mutates state. */
export function advance(
  state: GameState,
  toTime: number,
  opts: AdvanceOptions = {},
): AdvanceResult {
  if (toTime < state.time) throw new Error(`Cannot advance backwards (${state.time} -> ${toTime})`);
  const systems = opts.systems ?? SYSTEMS;
  const ctx: SimContext = {
    content: opts.content ?? CONTENT,
    emit: opts.onEvent ?? (() => {}),
  };
  let eventsProcessed = 0;

  for (;;) {
    let nextTime = Infinity;
    let next: System | undefined;
    for (const sys of systems) {
      const t = sys.nextEventTime(state);
      if (t < nextTime) {
        nextTime = t;
        next = sys;
      }
    }
    if (!next || nextTime > toTime) break;

    if (nextTime < state.time) throw new Error(`System ${next.id} scheduled an event in the past`);
    state.time = nextTime;
    next.processEvent(state, ctx);
    eventsProcessed++;

    if (next.nextEventTime(state) <= nextTime)
      throw new Error(`System ${next.id} did not move its next event forward`);
  }

  state.time = toTime;
  return { eventsProcessed };
}
