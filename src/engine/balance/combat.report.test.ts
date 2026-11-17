/**
 * Combat balance report (not part of the normal run).
 * Run with:  COMBAT=1 npx vitest run src/engine/balance --reporter=verbose
 *
 * A character fights through Act 1, moving to the highest zone at or below its
 * level, with (a) nothing equipped or (b) normal gear of the matching tier.
 */
import { describe, it } from 'vitest';
import { applyCommand } from '../commands';
import { CONTENT } from '../content';
import { combatContext } from '../combat/context';
import { characterLevel } from '../combat/progression';
import { Rng, seedRng } from '../core/rng';
import { newItem } from '../items/generate';
import { advance } from '../sim';
import { createInitialState, type GameState } from '../state';

const MIN = 60_000;

function gear(s: GameState, tier: number) {
  const r = new Rng(seedRng(tier));
  s.equipment.mainHand = newItem(1000 + tier, `base.mace_t${tier}`, tier * 10, 'normal', r);
  s.equipment.body = newItem(1100 + tier, `base.body_ar_t${tier}`, tier * 10, 'normal', r);
  s.equipment.helmet = newItem(1200 + tier, `base.helmet_ar_t${tier}`, tier * 10, 'normal', r);
  s.gearVersion++;
}

function run(geared: boolean, hours: number) {
  const s = createInitialState(11, 0, {
    id: 'r',
    name: 'R',
    classId: 'class.ironclad',
    mode: 'standard',
  });
  if (geared) gear(s, 1);
  const zones = CONTENT.zones.all();
  const lines: string[] = [];
  let zone = zones[0]!;
  applyCommand(s, { type: 'startCombat', zoneId: zone.id });
  for (let m = 0; m < hours * 60; m += 5) {
    const lvl = characterLevel(s.charXp);
    if (geared && lvl >= 10 && !s.equipment.mainHand!.baseId.endsWith('t2')) gear(s, 2);
    const best = [...zones].reverse().find((z) => z.level <= lvl) ?? zones[0]!;
    if (!s.combat || best.id !== zone.id) {
      zone = best;
      applyCommand(s, { type: 'startCombat', zoneId: zone.id });
    }
    advance(s, s.time + 5 * MIN);
    if (m % 30 === 25) {
      const c = s.combat;
      const ctx = c ? combatContext(s, s.time) : null;
      lines.push(
        `${String(m + 5).padStart(4)}m  L${String(characterLevel(s.charXp)).padStart(2)}  ${zone.id.padEnd(24)} kills ${String(s.stats.kills).padStart(5)}  deaths ${s.stats.deaths}  dps ${ctx ? ctx.attack.dps.toFixed(1) : '-'}  life ${c ? Math.round(c.life) : '-'}/${ctx ? Math.round(ctx.maxLife) : '-'}`,
      );
    }
  }
  return lines.join('\n');
}

describe.skipIf(!process.env.COMBAT)('combat report', () => {
  it('Act 1 progression', () => {
    console.log('\n--- Unarmed, no flasks ---\n' + run(false, 4));
    console.log('\n--- Tier-matched normal mace + armour, no flasks ---\n' + run(true, 4));
  }, 600_000);
});
