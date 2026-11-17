import { useMemo, useState } from 'react';
import { characterLevel } from '../../engine/combat/progression';
import { computeItem, equipmentMods, UNARMED } from '../../engine/items/itemStats';
import { computeCharacter, type CharacterSheet } from '../../engine/stats/character';
import { computeHit, type SkillStats, type TargetStats } from '../../engine/stats/damage';
import { RESIST_TYPES, type StatBreakdown } from '../../engine/stats/types';
import { nameOf, t, type TKey } from '../../i18n';
import { formatNumber } from '../../shared/format';
import { benchModsToMods, useBench } from '../bench';
import { useGameState } from '../bridge';
import { Breakdown } from '../components/Breakdown';
import { TestBench } from '../components/TestBench';
import { useFlag } from '../flags';
import { itemName } from '../items';
import { formatPercent } from '../../shared/format';

interface Row {
  key: string;
  label: string;
  value: string;
  breakdown?: StatBreakdown;
  unit?: string;
  note?: string;
}

function n(x: number): string {
  return Math.abs(x) < 1000 ? String(Math.round(x * 10) / 10) : formatNumber(x);
}

function sections(sheet: CharacterSheet): { title: TKey; rows: Row[] }[] {
  const stat = (key: string, label: TKey, b: StatBreakdown, unit = ''): Row => ({
    key,
    label: t(label),
    value: `${n(b.total)}${unit}`,
    breakdown: b,
    unit,
  });
  return [
    {
      title: 'codex.section.attributes',
      rows: [
        stat('str', 'stat.str', sheet.str),
        stat('dex', 'stat.dex', sheet.dex),
        stat('int', 'stat.int', sheet.int),
      ],
    },
    {
      title: 'codex.section.resources',
      rows: [
        stat('life', 'stat.life', sheet.life),
        stat('mana', 'stat.mana', sheet.mana),
        stat('spirit', 'stat.spirit', sheet.spirit),
        stat('es', 'stat.energyShield', sheet.energyShield),
      ],
    },
    {
      title: 'codex.section.defences',
      rows: [
        stat('armour', 'stat.armour', sheet.armour),
        stat('evasion', 'stat.evasion', sheet.evasion),
        {
          key: 'block',
          label: t('stat.block'),
          value: t('codex.resistValue', { value: n(sheet.block.value), max: n(sheet.block.max) }),
          breakdown: sheet.block.breakdown,
          unit: '%',
        },
      ],
    },
    {
      title: 'codex.section.resists',
      rows: RESIST_TYPES.map((r) => ({
        key: `res.${r}`,
        label: t(`dmg.${r}`),
        value: t('codex.resistValue', {
          value: n(sheet.resists[r].value),
          max: n(sheet.resists[r].max),
        }),
        breakdown: sheet.resists[r].breakdown,
        unit: '%',
        note: sheet.actPenalty ? t('codex.actPenalty', { n: sheet.actPenalty }) : undefined,
      })),
    },
    {
      title: 'codex.section.recovery',
      rows: [
        {
          key: 'lifeRegen',
          label: t('stat.lifeRegen'),
          value: t('codex.perSec', { n: n(sheet.lifeRegenPerSec) }),
          breakdown: sheet.lifeRegenPct,
          unit: '%',
        },
        {
          key: 'manaRegen',
          label: t('stat.manaRegen'),
          value: t('codex.perSec', { n: n(sheet.manaRegenPerSec) }),
          breakdown: sheet.manaRegenPct,
          unit: '%',
        },
        {
          key: 'es',
          label: t('codex.esRecharge'),
          value: t('codex.esRechargeValue', {
            rate: n(sheet.esRechargePerSec),
            delay: n(sheet.esRechargeDelaySec),
          }),
        },
        stat('leechCap', 'stat.leechCap', sheet.leechCapPct, '%'),
      ],
    },
    {
      title: 'codex.section.offence',
      rows: [
        stat('accuracy', 'stat.accuracy', sheet.accuracy),
        stat('critBonus', 'stat.critBonus', sheet.critBonus, '%'),
      ],
    },
  ];
}

export function CodexPage() {
  const character = useGameState((s) => s.character);
  const equipment = useGameState((s) => s.equipment);
  const level = useGameState((s) => characterLevel(s.charXp));
  const devTools = useFlag('devTools');
  const benchMods = useBench((s) => s.mods);
  const benchOn = devTools && benchMods.length > 0;
  const sheet = useMemo(
    () =>
      computeCharacter({
        classId: character.classId,
        level,
        mods: [
          ...equipmentMods(equipment, itemName),
          ...(benchOn ? benchModsToMods(benchMods) : []),
        ],
      }),
    [character.classId, benchOn, benchMods, equipment, level],
  );
  const [selected, setSelected] = useState<string>('life');
  const all = sections(sheet);
  const selectedRow = all.flatMap((s) => s.rows).find((r) => r.key === selected);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{t('codex.title')}</h1>
        <span className="tag">
          {nameOf(character.classId)} · {t('topbar.level', { n: level })}
        </span>
      </div>
      <p className="dim">{t('codex.intro')}</p>
      {benchOn && <div className="notice">{t('codex.benchActive')}</div>}

      <div className="codex-layout">
        <div className="codex-sheet">
          {all.map((sec) => (
            <section key={sec.title} className="panel panel-wide">
              <h2 className="section-title">{t(sec.title)}</h2>
              <ul className="stat-list">
                {sec.rows.map((r) => (
                  <li key={r.key}>
                    <button
                      className={`stat-line${selected === r.key ? ' selected' : ''}`}
                      onClick={() => setSelected(r.key)}
                      disabled={!r.breakdown}
                    >
                      <span>{r.label}</span>
                      <span className="stat-value">{r.value}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <aside className="panel codex-detail">
          {selectedRow?.breakdown ? (
            <>
              <Breakdown
                b={selectedRow.breakdown}
                label={selectedRow.label}
                unit={selectedRow.unit}
              />
              {selectedRow.note && <p className="faint small">{selectedRow.note}</p>}
            </>
          ) : (
            <p className="dim">{t('codex.selectStat')}</p>
          )}
        </aside>
      </div>

      <BasicAttack sheet={sheet} />
      {devTools && <TestBench sheet={sheet} />}
    </div>
  );
}

const BASIC_ATTACK: SkillStats = { id: 'basic_attack', tags: ['attack'], damageEffectiveness: 1 };
const STANDARD_TARGET: TargetStats = {
  life: 500,
  armour: 100,
  evasion: 100,
  resists: { fire: 0, cold: 0, lightning: 0, chaos: 0 },
};

/** DPS of a plain attack with the equipped weapon, so gear upgrades show right away. */
function BasicAttack({ sheet }: { sheet: CharacterSheet }) {
  const main = useGameState((s) => s.equipment.mainHand);
  const weapon = main ? computeItem(main, itemName(main)).weapon : undefined;
  const hit = computeHit(sheet, BASIC_ATTACK, weapon ?? UNARMED, STANDARD_TARGET);
  return (
    <section className="panel panel-wide">
      <h2 className="section-title">
        {t('codex.basicAttack')} — {main && weapon ? itemName(main) : t('codex.unarmed')}
      </h2>
      <div className="bench-dps">{n(hit.dps)} DPS</div>
      <div className="small dim">
        {t('codex.dpsLine', {
          dps: n(hit.dps),
          hit: n(hit.avgHit),
          aps: n(hit.usesPerSecond),
          crit: formatPercent(hit.critChance, 1),
          chance: formatPercent(hit.hitChance, 1),
        })}
      </div>
      <p className="faint small">{t('codex.basicAttackNote')}</p>
    </section>
  );
}
