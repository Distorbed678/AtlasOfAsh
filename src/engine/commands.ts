import { CONTENT, type Content } from './content';
import type { GameState } from './state';

/** Player intents. Applied at the current sim time, between events. */
export type Command =
  | { type: 'startAction'; actionId: string }
  | { type: 'stopAction' }
  | { type: 'sellItem'; itemId: string; qty: number };

export function applyCommand(state: GameState, cmd: Command, content: Content = CONTENT): void {
  switch (cmd.type) {
    case 'startAction': {
      const def = content.actions.get(cmd.actionId);
      if (state.action?.actionId === def.id) return;
      state.action = {
        actionId: def.id,
        startedAt: state.time,
        nextAt: state.time + def.durationMs,
      };
      return;
    }
    case 'stopAction':
      state.action = null;
      return;
    case 'sellItem': {
      const item = content.items.get(cmd.itemId);
      const owned = state.bank[item.id] ?? 0;
      const qty = Math.min(Math.max(0, Math.floor(cmd.qty)), owned);
      if (qty === 0) return;
      state.bank[item.id] = owned - qty;
      if (state.bank[item.id] === 0) delete state.bank[item.id];
      state.gold += qty * item.sellPrice;
      return;
    }
  }
}
