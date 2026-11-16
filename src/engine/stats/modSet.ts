import type { BreakdownEntry, Mod, ModSource, StatBreakdown, StatId } from './types';

export const BASE_SOURCE: ModSource = { kind: 'base', id: 'base', label: 'Base' };

export interface QueryContext {
  /** Tags of the thing being computed (e.g. ['attack', 'melee', 'physical']). */
  tags?: readonly string[];
  /** Conditions currently true (e.g. 'targetShocked'). */
  conditions?: ReadonlySet<string>;
}

/** An indexed collection of modifiers that answers stat queries with full provenance. */
export class ModSet {
  private readonly byStat = new Map<StatId, Mod[]>();

  constructor(mods: readonly Mod[] = []) {
    for (const m of mods) this.add(m);
  }

  add(mod: Mod): void {
    const list = this.byStat.get(mod.stat);
    if (list) list.push(mod);
    else this.byStat.set(mod.stat, [mod]);
  }

  /** Mods for a stat that apply in this context. */
  applicable(stat: StatId, ctx: QueryContext = {}): Mod[] {
    const tags = ctx.tags ?? [];
    return (this.byStat.get(stat) ?? []).filter(
      (m) =>
        (m.tags ?? []).every((t) => tags.includes(t)) &&
        (!m.condition || (ctx.conditions?.has(m.condition) ?? false)),
    );
  }

  /** total = (base + Σflat) × (1 + Σincreased%) × Π(1 + more%), unless overridden. */
  query(
    stat: StatId,
    base = 0,
    ctx: QueryContext = {},
    baseSource: ModSource = BASE_SOURCE,
  ): StatBreakdown {
    const flat: BreakdownEntry[] = [];
    const increased: BreakdownEntry[] = [];
    const more: BreakdownEntry[] = [];
    let override: BreakdownEntry | undefined;
    for (const m of this.applicable(stat, ctx)) {
      const entry: BreakdownEntry = {
        value: m.value,
        source: m.source,
        tags: m.tags,
        condition: m.condition,
      };
      if (m.kind === 'flat') flat.push(entry);
      else if (m.kind === 'increased') increased.push(entry);
      else if (m.kind === 'more') more.push(entry);
      else override = entry;
    }
    const flatSum = flat.reduce((s, e) => s + e.value, 0);
    const incSum = increased.reduce((s, e) => s + e.value, 0);
    const moreMult = more.reduce((p, e) => p * (1 + e.value / 100), 1);
    const total = override
      ? override.value
      : (base + flatSum) * Math.max(0, 1 + incSum / 100) * moreMult;
    return {
      stat,
      base,
      baseSource,
      flat,
      increased,
      more,
      override,
      flatSum,
      incSum,
      moreMult,
      total,
    };
  }

  /** Shorthand for the final number. */
  value(stat: StatId, base = 0, ctx: QueryContext = {}): number {
    return this.query(stat, base, ctx).total;
  }

  /** Just the (1 + inc) × more multiplier, ignoring flat mods. */
  multiplier(stat: StatId, ctx: QueryContext = {}): number {
    return this.query(stat, 1, ctx).total - this.query(stat, 0, ctx).total;
  }
}

/** Convenience constructor for mods in content and tests. */
export function mod(
  stat: StatId,
  kind: Mod['kind'],
  value: number,
  source: ModSource,
  opts: { tags?: readonly string[]; condition?: string } = {},
): Mod {
  return { stat, kind, value, source, ...opts };
}
