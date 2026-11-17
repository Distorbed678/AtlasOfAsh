import { GEAR_DURATION_MS } from './artisan';
import { CUT_GEM, FIBRE_IDS } from './materials';
import { FISH_IDS, HERB_IDS, ORE_IDS, TIER_LEVELS, TIER_VALUE, TIER_XP } from './skills';
import type { AffixDef, BaseItemDef, CraftAction, FlaskKind, FlaskStats } from './types';

/** Phase 4 flasks, crafted by Alchemy. Index i = tier i+1. */
const tiers = [...Array(10).keys()];
const FLASK_MULT = [1, 1.8, 2.8, 4, 5.4, 7, 8.8, 10.8, 13, 15.5];
export const FLASK_KINDS: FlaskKind[] = [
  'life',
  'mana',
  'granite',
  'swiftness',
  'warding',
  'cleansing',
];

export function flaskStats(kind: FlaskKind, i: number): FlaskStats {
  switch (kind) {
    case 'life':
      return {
        kind,
        amount: Math.round(50 * FLASK_MULT[i]!),
        durationMs: 2000,
        maxCharges: 30,
        chargesPerUse: 10,
      };
    case 'mana':
      return {
        kind,
        amount: Math.round(40 * FLASK_MULT[i]!),
        durationMs: 2000,
        maxCharges: 30,
        chargesPerUse: 8,
      };
    case 'granite':
      return { kind, amount: 100 + 120 * i, durationMs: 5000, maxCharges: 40, chargesPerUse: 20 };
    case 'swiftness':
      return { kind, amount: 8 + i, durationMs: 4000, maxCharges: 40, chargesPerUse: 20 };
    case 'warding':
      return { kind, amount: 10 + 2 * i, durationMs: 5000, maxCharges: 40, chargesPerUse: 20 };
    case 'cleansing':
      return { kind, amount: 0, durationMs: 4000, maxCharges: 30, chargesPerUse: 15 };
  }
}

function inputs(kind: FlaskKind, i: number): Record<string, number> {
  const herb = HERB_IDS[i]!;
  switch (kind) {
    case 'life':
      return { [herb]: 3, [FISH_IDS[i]!]: 1 };
    case 'mana':
      return { [herb]: 3, [FIBRE_IDS[i]!]: 1 };
    case 'granite':
      return { [herb]: 2, [ORE_IDS[i]!]: 2 };
    case 'swiftness':
      return { [herb]: 2, [FISH_IDS[i]!]: 2 };
    case 'warding':
      return { [herb]: 2, 'item.gem_fragment': 1 };
    case 'cleansing':
      return { [herb]: 2, [FIBRE_IDS[i]!]: 2, [CUT_GEM]: i >= 5 ? 1 : 0 };
  }
}

const recovery = (k: FlaskKind) => k === 'life' || k === 'mana';

export const FLASK_BASES: BaseItemDef[] = FLASK_KINDS.flatMap((kind) =>
  tiers.map((i) => ({
    id: `base.${kind}_flask_t${i + 1}`,
    class: 'flask' as const,
    tier: i + 1,
    levelReq: TIER_LEVELS[i]!,
    flask: flaskStats(kind, i),
    implicits: [],
    req: { str: 0, dex: 0, int: 0 },
    tags: ['flask', recovery(kind) ? 'recoveryFlask' : 'utilityFlask', `${kind}Flask`],
    sellPrice: TIER_VALUE[i]! * 6,
  })),
);

export const FLASK_ACTIONS: CraftAction[] = FLASK_KINDS.flatMap((kind) =>
  tiers.map((i) => {
    const raw = inputs(kind, i);
    return {
      id: `action.brew_${kind}_flask_t${i + 1}`,
      skillId: 'skill.alchemy' as const,
      type: 'craft' as const,
      group: recovery(kind) ? 'recoveryFlasks' : 'utilityFlasks',
      tier: i + 1,
      level: TIER_LEVELS[i]!,
      durationMs: GEAR_DURATION_MS[i]!,
      xp: Math.round(TIER_XP[i]! * 2.5),
      inputs: Object.fromEntries(Object.entries(raw).filter(([, q]) => q > 0)),
      output: { kind: 'gear' as const, baseId: `base.${kind}_flask_t${i + 1}` },
    };
  }),
);

const TIER_ILVLS = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90];
const WEIGHTS = [100, 100, 100, 90, 90, 80, 70, 60, 50, 40];
function flaskAffix(
  id: string,
  kind: 'prefix' | 'suffix',
  tags: string[],
  stat: AffixDef['lines'][0]['stat'],
  worst: [number, number],
  best: [number, number],
): AffixDef {
  return {
    id: `affix.${id}`,
    kind,
    group: id,
    allowedTags: tags,
    lines: [{ stat, kind: 'increased', local: true }],
    tiers: TIER_ILVLS.map((ilvl, t) => {
      const f = t / 9;
      return {
        ilvl,
        weight: WEIGHTS[t]!,
        ranges: [
          [
            Math.round(worst[0] + (best[0] - worst[0]) * f),
            Math.round(worst[1] + (best[1] - worst[1]) * f),
          ] as const,
        ],
      };
    }),
  };
}

/** Local flask affixes (only roll on flasks). */
export const FLASK_AFFIXES: AffixDef[] = [
  flaskAffix('flask_recovery', 'prefix', ['recoveryFlask'], 'flaskRecovery', [10, 15], [50, 60]),
  flaskAffix('flask_max_charges', 'prefix', ['flask'], 'flaskMaxCharges', [10, 15], [50, 60]),
  flaskAffix('flask_charges_used', 'suffix', ['flask'], 'flaskChargesUsed', [-5, -8], [-25, -30]),
  flaskAffix('flask_duration', 'suffix', ['utilityFlask'], 'flaskDuration', [10, 15], [40, 50]),
];
