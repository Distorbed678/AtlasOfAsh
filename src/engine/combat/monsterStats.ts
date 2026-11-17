import { CONTENT, type Content } from '../content';
import type { MonsterDef } from '../content/types';
import type { DamageType, ResistType } from '../stats/types';
import { monsterXp } from './progression';

export type MonsterRarity = 'normal' | 'magic' | 'rare';

export const RARITY_CHANCE = { magic: 0.15, rare: 0.03 } as const;
export const RARITY_SCALE: Record<MonsterRarity, { life: number; xp: number; lootRolls: number }> =
  {
    normal: { life: 1, xp: 1, lootRolls: 1 },
    magic: { life: 1.6, xp: 1.6, lootRolls: 2 },
    rare: { life: 3.5, xp: 3.5, lootRolls: 5 },
  };

/**
 * Per-level baselines. Evasion is set so a matching-level character with base
 * accuracy (6 × level + 5 × 10 Dex) hits about 85% (PLAN §1.11).
 */
export function monsterBaseline(level: number) {
  return {
    // Tuned for Basic Attack + tier-matched gear (Phase 4); revisited when skill gems arrive.
    life: 22 * 1.05 ** (level - 1) * (1 + level / 20),
    hit: 1.6 * 1.06 ** (level - 1) * (1 + level / 12),
    accuracy: 40 + 12 * level,
    evasion: 1.647 * (6 * level + 50),
    armour: 10 + 8 * level,
  };
}

export interface MonsterStats {
  def: MonsterDef;
  level: number;
  rarity: MonsterRarity;
  maxLife: number;
  /** Average damage per hit by type (hits roll 75%–125% of this). */
  hitByType: Partial<Record<DamageType, number>>;
  attackIntervalMs: number;
  accuracy: number;
  evasion: number;
  armour: number;
  resists: Record<ResistType, number>;
  /** Fraction of damage dealt the monster heals. */
  leech: number;
  ailmentThreshold: number;
  xp: number;
}

export function monsterStats(
  defId: string,
  level: number,
  rarity: MonsterRarity,
  modIds: readonly string[],
  content: Content = CONTENT,
): MonsterStats {
  const def = content.monsters.get(defId);
  const b = monsterBaseline(level);
  const mods = modIds.map((id) => content.monsterMods.get(id));
  const prod = (f: (m: (typeof mods)[number]) => number | undefined) =>
    mods.reduce((p, m) => p * (f(m) ?? 1), 1);
  const lifeMult = def.lifeMult * RARITY_SCALE[rarity].life * prod((m) => m.lifeMult);
  const dmg = b.hit * def.damageMult * prod((m) => m.damageMult);
  const hitByType: MonsterStats['hitByType'] = {};
  for (const [type, frac] of Object.entries(def.damageSplit))
    hitByType[type as DamageType] = dmg * (frac ?? 0);
  const extraFire = mods.reduce((s, m) => s + (m.extraFire ?? 0), 0);
  if (extraFire) hitByType.fire = (hitByType.fire ?? 0) + dmg * extraFire;
  const resistAll = mods.reduce((s, m) => s + (m.resistAll ?? 0), 0);
  const res = (r: ResistType) =>
    Math.min(75, (def.resists[r] ?? 0) + (r === 'chaos' ? 0 : resistAll));
  const maxLife = Math.round(b.life * lifeMult);
  return {
    def,
    level,
    rarity,
    maxLife,
    hitByType,
    attackIntervalMs: Math.round(def.attackIntervalMs / prod((m) => m.speedMult)),
    accuracy: Math.round(b.accuracy),
    evasion: Math.round(b.evasion * def.evasionMult * prod((m) => m.evasionMult)),
    armour: Math.round(b.armour * def.armourMult * prod((m) => m.armourMult)),
    resists: {
      fire: res('fire'),
      cold: res('cold'),
      lightning: res('lightning'),
      chaos: res('chaos'),
    },
    leech: mods.reduce((s, m) => s + (m.leech ?? 0), 0),
    ailmentThreshold: maxLife,
    xp: monsterXp(level) * RARITY_SCALE[rarity].xp,
  };
}
