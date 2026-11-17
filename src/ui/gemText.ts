import type { GemDef, GemModTemplate, Scaling } from '../engine/content/types';
import type { StatId } from '../engine/stats/types';
import { scaled } from '../engine/gems/gems';
import { nameOf, t, tDynamic } from '../i18n';
import { modLine } from './modText';

const r1 = (v: number) => Math.round(v * 10) / 10;
const sec = (ms: number) => `${r1(ms / 1000)}s`;
const TYPE: Record<string, string> = {
  physical: 'Physical',
  fire: 'Fire',
  cold: 'Cold',
  lightning: 'Lightning',
  chaos: 'Chaos',
};

/** Stats the item formatter doesn't know (or 'more' multipliers), worded generically. */
function statLabel(stat: StatId, tags: readonly string[]): string | null {
  if (stat === 'damage') {
    const tag = ['minion', 'physical', 'fire', 'cold', 'lightning', 'chaos', 'elemental'].find(
      (x) => tags.includes(x),
    );
    return tDynamic(tag ? `gemstat.damage.${tag}` : 'gemstat.damage');
  }
  const key = `gemstat.${stat}`;
  const label = tDynamic(key);
  return label === key ? null : label;
}

export function gemModLine(m: GemModTemplate, level: number, mult = 1): string {
  const v = r1(scaled(m.value, level) * mult);
  const tags = m.tags ?? [];
  let line: string;
  if (m.stat.startsWith('convert.')) {
    const to = m.stat.split('.')[2]!;
    line = tDynamic('gemline.convert', { v, to: TYPE[to] ?? to });
  } else {
    const label = statLabel(m.stat, tags);
    const generic = label !== null && (m.kind === 'more' || m.kind === 'increased');
    const itemFormatterKnows =
      m.kind === 'flat' ||
      (m.kind === 'increased' &&
        ['attackSpeed', 'castSpeed', 'critChance', 'manaRegenPct', 'life'].includes(m.stat));
    if (generic && !(itemFormatterKnows && m.stat !== 'damage')) {
      const neg = v < 0;
      const key =
        m.kind === 'more'
          ? neg
            ? 'gemline.less'
            : 'gemline.more'
          : neg
            ? 'gemline.reduced'
            : 'gemline.increased';
      line = tDynamic(key, { v: Math.abs(v), what: label });
    } else {
      line = modLine(m.stat, m.kind, v, tags);
    }
  }
  return m.condition === 'lowLife' ? tDynamic('gemline.whenLowLife', { line }) : line;
}

const sc = (s: Scaling | undefined, level: number) => (s ? r1(scaled(s, level)) : 0);

/** Human-readable effect lines for a gem at a given level and quality. */
export function gemLines(def: GemDef, level: number, quality = 0): string[] {
  const out: string[] = [];
  if (def.kind === 'skill') {
    if (def.weapons?.length)
      out.push(
        t('gem.weapons', { list: def.weapons.map((w) => nameOf(`weapon.${w}`)).join(', ') }),
      );
    if (def.effectiveness)
      out.push(t('gem.effectiveness', { v: Math.round(scaled(def.effectiveness, level) * 100) }));
    if (def.baseDamage) {
      const growth = 1 + (def.damageGrowth ?? 0) * (level - 1);
      for (const [type, range] of Object.entries(def.baseDamage)) {
        if (!range) continue;
        out.push(
          t('gem.baseDamage', {
            a: Math.round(range[0] * growth),
            b: Math.round(range[1] * growth),
            type: TYPE[type]!,
          }),
        );
      }
    }
    if (def.castTimeMs) out.push(t('gem.castTime', { s: sec(def.castTimeMs) }));
    if (def.critChance) out.push(t('gem.critChance', { v: def.critChance }));
    out.push(t('gem.manaCost', { v: r1(scaled(def.manaCost, level)) }));
    if (def.cooldownMs) out.push(t('gem.cooldown', { s: sec(def.cooldownMs) }));
    for (const [k, v] of Object.entries(def.conversion ?? {})) {
      out.push(tDynamic('gemline.convert', { v, to: TYPE[k.split('.')[1]!]! }));
    }
    for (const [k, v] of Object.entries(def.ailmentChance ?? {}))
      out.push(modLine(`ailmentChance.${k}` as StatId, 'flat', v));
    if (def.repeats)
      out.push(
        t('gem.repeats', { n: def.repeats.count, pct: Math.round(def.repeats.fraction * 100) }),
      );
    if (def.combo === 'builder') out.push(t('gem.comboBuilder'));
    if (def.combo === 'finisher') out.push(t('gem.comboFinisher'));
    if (def.chargeGain) out.push(chargeLine(def.chargeGain));
    if (def.chargeFinisher)
      out.push(t('gem.chargeFinisher', { charge: tDynamic(`charge.${def.chargeFinisher}`) }));
    if (def.armourPen) out.push(t('gem.armourPen', { v: Math.round(def.armourPen * 100) }));
    for (const m of def.mods ?? []) out.push(gemModLine(m, level));
    if (def.debuff) {
      const d = def.debuff;
      const s = sec(d.durationMs);
      if (d.resistDown) out.push(t('gem.debuff.resist', { v: sc(d.resistDown, level), s }));
      if (d.damageTaken) out.push(t('gem.debuff.taken', { v: sc(d.damageTaken, level), s }));
      if (d.slow) out.push(t('gem.debuff.slow', { v: sc(d.slow, level), s }));
      if (d.armourBreak) out.push(t('gem.debuff.armour', { v: sc(d.armourBreak, level), s }));
    }
    if (def.buff) {
      out.push(t('gem.buff', { s: sec(def.buff.durationMs) }));
      for (const m of def.buff.mods) out.push(`• ${gemModLine(m, level)}`);
      if (def.buff.charges)
        out.push(
          t('gem.buffCharges', {
            n: def.buff.charges.count,
            charge: tDynamic(`charge.${def.buff.charges.type}`),
          }),
        );
    }
    if (def.guard)
      out.push(t('gem.guard', { v: sc(def.guard.absorb, level), s: sec(def.guard.durationMs) }));
    if (def.minion) {
      const m = def.minion;
      out.push(
        m.persistent
          ? t('gem.minion.persistent', { n: m.count, spirit: m.spirit ?? 0 })
          : t('gem.minion.summoned', { n: m.count, s: sec(m.durationMs ?? 5000) }),
      );
      out.push(
        t('gem.minion.stats', {
          life: sc(m.life, level),
          dmg: sc(m.damage, level),
          type: TYPE[m.damageType]!,
          s: sec(m.attackIntervalMs),
        }),
      );
      out.push(t('gem.minion.threat', { v: m.threat }));
    }
  } else if (def.kind === 'support') {
    out.push(
      t('gem.supports', { list: def.requiresAny.map((x) => tDynamic(`gemtag.${x}`)).join(', ') }),
    );
    if (def.manaMult !== 1) out.push(t('gem.manaMult', { v: Math.round(def.manaMult * 100) }));
    for (const m of def.mods) out.push(gemModLine(m, level));
    const f = def.flags;
    if (f?.repeat)
      out.push(t('gem.repeats', { n: f.repeat.count, pct: Math.round(f.repeat.fraction * 100) }));
    if (f?.chargeGain) out.push(chargeLine(f.chargeGain));
    if (f?.trigger)
      out.push(
        t(f.trigger.on === 'crit' ? 'gem.trigger.crit' : 'gem.trigger.hit', {
          s: sec(f.trigger.cooldownMs),
        }),
      );
    if (f?.comboBuilder) out.push(t('gem.comboBuilder'));
    if (f?.execute)
      out.push(t('gem.execute', { pct: f.execute.belowLifePct, v: sc(f.execute.more, level) }));
  } else {
    out.push(t('gem.reserves', { v: def.spirit }));
    for (const m of def.mods) out.push(gemModLine(m, level));
  }
  if (quality > 0) out.push(t('gem.quality', { line: gemModLine(def.quality, 1, quality) }));
  return out;
}

function chargeLine(g: { type: string; chance: number; on: string; count?: number }): string {
  return tDynamic(`gem.charge.${g.on}`, {
    pct: Math.round(g.chance * 100),
    charge: tDynamic(`charge.${g.type}`),
  });
}

/** Tags line such as "Attack · Melee · Fire". */
export function gemTags(def: GemDef): string {
  if (def.kind !== 'skill') return tDynamic(`gemKind.${def.kind}`);
  const tags = [def.skillKind, ...def.tags.filter((x) => x !== def.skillKind && x !== 'damaging')];
  return [...new Set(tags)]
    .map((x) => tDynamic(`gemtag.${x}`))
    .filter((x) => !x.startsWith('gemtag.'))
    .join(' · ');
}

export function gemIcon(def: GemDef): string {
  return def.kind === 'skill' ? `skillKind.${def.skillKind}` : `gemKind.${def.kind}`;
}
