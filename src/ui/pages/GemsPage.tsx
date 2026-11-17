import { useMemo, useState } from 'react';
import { CONTENT } from '../../engine/content';
import type { ChargeType } from '../../engine/content/types';
import { combatContext, type SkillContext } from '../../engine/combat/context';
import { startCombat } from '../../engine/combat/combatSystem';
import { effectiveDps } from '../../engine/combat/predict';
import { characterLevel } from '../../engine/combat/progression';
import {
  findGem,
  gemLevel,
  gemXpForLevel,
  isSkill,
  isSpirit,
  isSupport,
  MAX_GEM_LEVEL,
  MAX_QUALITY,
  MAX_SOCKETS,
  polishCost,
  SKILL_SLOT_LEVELS,
  SOCKET_COSTS,
  socketedSupportUids,
  supportFits,
} from '../../engine/gems/gems';
import { spiritUsage } from '../../engine/gems/gemcutting';
import type { GameState, GemInstance, SkillRule } from '../../engine/state';
import { nameOf, t, tDynamic } from '../../i18n';
import { formatNumber } from '../../shared/format';
import { command, useGame } from '../bridge';
import { gemIcon, gemLines, gemTags } from '../gemText';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { href } from '../router';

const n1 = (x: number) => formatNumber(Math.round(x * 10) / 10);

export function GemsPage() {
  const state = useGame((s) => s.state) as GameState;
  const uncut = Object.entries(state.bank.items)
    .filter(([id, q]) => id.startsWith('item.uncut_') && q > 0)
    .reduce((s, [, q]) => s + q, 0);
  return (
    <div className="page">
      <h1 className="page-title">{t('gems.title')}</h1>
      <p className="dim">{t('gems.intro')}</p>
      <div className="row small">
        <span>{t('gems.uncut', { n: uncut })}</span>
        <a href={href({ page: 'skill', skillId: 'skill.gemcutting' })}>{t('gems.toCutting')}</a>
      </div>
      <SkillBar state={state} />
      <SpiritPanel state={state} />
      <Inventory state={state} />
    </div>
  );
}

/** A combat context for display: the live one in combat, or a probe against the first zone. */
function useDisplayContext(state: GameState) {
  const key = `${state.gearVersion}|${characterLevel(state.charXp)}|${state.combat ? state.time : 0}`;
  return useMemo(() => {
    if (state.combat) return combatContext(state, state.time);
    const probe = structuredClone(state);
    probe.combat = null;
    startCombat(probe, CONTENT.zones.all()[0]!.id);
    return combatContext(probe, probe.time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

function SkillBar({ state }: { state: GameState }) {
  const level = characterLevel(state.charXp);
  const ctx = useDisplayContext(state);
  const eff = effectiveDps(ctx);
  const skills = state.gems.filter((g) => isSkill(CONTENT.gems.get(g.gemId)));
  return (
    <section className="panel panel-wide">
      <h2 className="section-title">{t('gems.bar')}</h2>
      <p className="faint small">{t('gems.barNote')}</p>
      <div className="small">
        {t('gems.estimatedDps', {
          dps: n1(eff.dps),
          skill: n1(eff.skillDps),
          minion: n1(eff.minionDps),
        })}
      </div>
      <ol className="skill-bar">
        {state.skillBar.map((slot, i) => {
          const need = SKILL_SLOT_LEVELS[i]!;
          if (level < need)
            return (
              <li key={i} className="skill-slot locked faint small">
                {t('gems.slot', { n: i + 1 })} — {t('gems.slotLocked', { n: need })}
              </li>
            );
          const gem = slot.gemUid !== null ? findGem(state, slot.gemUid) : undefined;
          const sc = ctx.skills[i] ?? null;
          return (
            <li key={i} className="skill-slot">
              <div className="skill-slot-head">
                <span className="tag">{t('gems.slot', { n: i + 1 })}</span>
                <select
                  className="input"
                  value={slot.gemUid ?? ''}
                  aria-label={t('gems.slot', { n: i + 1 })}
                  onChange={(e) =>
                    void command({
                      type: 'setSkillSlot',
                      slot: i,
                      gemUid: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">{t('gems.empty')}</option>
                  {skills.map((g) => (
                    <option key={g.uid} value={g.uid}>
                      {nameOf(g.gemId)} ({t('gem.level', { n: gemLevel(g.xp) })})
                    </option>
                  ))}
                </select>
                <RuleEditor slot={i} rule={slot.rule} />
                <span className="row-tight">
                  <button
                    className="btn btn-small"
                    disabled={i === 0}
                    title={t('gems.moveUp')}
                    aria-label={t('gems.moveUp')}
                    onClick={() => void command({ type: 'swapSkillSlots', a: i, b: i - 1 })}
                  >
                    ↑
                  </button>
                  <button
                    className="btn btn-small"
                    disabled={i === state.skillBar.length - 1 || level < SKILL_SLOT_LEVELS[i + 1]!}
                    title={t('gems.moveDown')}
                    aria-label={t('gems.moveDown')}
                    onClick={() => void command({ type: 'swapSkillSlots', a: i, b: i + 1 })}
                  >
                    ↓
                  </button>
                </span>
              </div>
              {gem && <SlotDetails state={state} gem={gem} sc={sc} />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SlotDetails({
  state,
  gem,
  sc,
}: {
  state: GameState;
  gem: GemInstance;
  sc: SkillContext | null;
}) {
  const def = CONTENT.gems.get(gem.gemId);
  if (!isSkill(def)) return null;
  // Once per character: hide other copies of a support that another skill already uses
  // (the copy in use is still offered, which moves it here).
  const usedElsewhere = new Map<string, number>();
  for (const other of state.gems)
    if (other.uid !== gem.uid)
      for (const s of other.supports) {
        const sg = s !== null ? findGem(state, s) : undefined;
        if (sg) usedElsewhere.set(sg.gemId, sg.uid);
      }
  const supports = state.gems.filter((g) => {
    const d = CONTENT.gems.get(g.gemId);
    const used = usedElsewhere.get(g.gemId);
    return isSupport(d) && supportFits(def, d) && (used === undefined || used === g.uid);
  });
  return (
    <div className="skill-slot-body small">
      <div className="dim">
        <Icon name={gemIcon(def)} size={16} className="inline-icon" /> {gemTags(def)}
      </div>
      {sc && !sc.usable && (
        <div className="bad">
          {t('gems.unusable.weapon', {
            list: (def.weapons ?? []).map((w) => nameOf(`weapon.${w}`)).join(', '),
          })}
        </div>
      )}
      {sc && sc.usable && <div>{summary(sc)}</div>}
      {sc?.minion?.persistent && !sc.reserved && <div className="bad">{t('gems.notReserved')}</div>}
      <div className="socket-row">
        {gem.supports.map((uid, idx) => (
          <select
            key={idx}
            className="input"
            aria-label={t('gems.socket', { n: idx + 1 })}
            value={uid ?? ''}
            onChange={(e) =>
              void command({
                type: 'socketSupport',
                skillUid: gem.uid,
                index: idx,
                supportUid: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="">{t('gems.noSupport')}</option>
            {supports.map((s) => (
              <option key={s.uid} value={s.uid}>
                {nameOf(s.gemId)} ({t('gem.level', { n: gemLevel(s.xp) })})
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}

function summary(sc: SkillContext): string {
  if (sc.trigger) return t('gems.summary.trigger');
  if (sc.offence)
    return t('gems.summary.damage', {
      dps: n1(sc.offence.dps),
      mana: n1(sc.manaCost),
      time: n1(sc.useTimeMs / 1000),
    });
  if (sc.minion?.persistent) return t('gems.summary.minion', { n: sc.minion.count });
  return t('gems.summary.utility', { mana: n1(sc.manaCost), cd: n1(sc.cooldownMs / 1000) });
}

const RULES: SkillRule['kind'][] = [
  'always',
  'lifeBelow',
  'manaAbove',
  'targetLacksDebuff',
  'buffNotActive',
  'chargesAtLeast',
  'comboAtLeast',
];

function defaultRule(kind: SkillRule['kind']): SkillRule {
  switch (kind) {
    case 'lifeBelow':
      return { kind, value: 50 };
    case 'manaAbove':
      return { kind, value: 50 };
    case 'chargesAtLeast':
      return { kind, charge: 'endurance', value: 3 };
    case 'comboAtLeast':
      return { kind, value: 4 };
    default:
      return { kind } as SkillRule;
  }
}

function RuleEditor({ slot, rule }: { slot: number; rule: SkillRule }) {
  const set = (r: SkillRule) => void command({ type: 'setSkillRule', slot, rule: r });
  return (
    <span className="row-tight small">
      <span className="dim">{t('gems.rule')}</span>
      <select
        className="input"
        aria-label={t('gems.rule')}
        value={rule.kind}
        onChange={(e) => set(defaultRule(e.target.value as SkillRule['kind']))}
      >
        {RULES.map((k) => (
          <option key={k} value={k}>
            {t(`gems.rule.${k}`)}
          </option>
        ))}
      </select>
      {rule.kind === 'chargesAtLeast' && (
        <select
          className="input"
          aria-label={t('combat.charges')}
          value={rule.charge}
          onChange={(e) => set({ ...rule, charge: e.target.value as ChargeType })}
        >
          {(['endurance', 'frenzy', 'power'] as const).map((c) => (
            <option key={c} value={c}>
              {tDynamic(`charge.${c}`)}
            </option>
          ))}
        </select>
      )}
      {'value' in rule && (
        <input
          className="input input-num"
          type="number"
          aria-label={t(`gems.rule.${rule.kind}`)}
          value={rule.value}
          onChange={(e) => set({ ...rule, value: Number(e.target.value) || 0 } as SkillRule)}
        />
      )}
    </span>
  );
}

function SpiritPanel({ state }: { state: GameState }) {
  const { used, total } = spiritUsage(state);
  const spirits = state.gems.filter((g) => isSpirit(CONTENT.gems.get(g.gemId)));
  return (
    <section className="panel panel-wide">
      <div className="card-head">
        <h2 className="section-title">{t('gems.spirit')}</h2>
        <span className="tag">{t('gems.spiritUsage', { used, total })}</span>
      </div>
      <p className="faint small">{t('gems.spiritNote')}</p>
      {spirits.length > 0 && (
        <ul className="list">
          {spirits.map((g) => {
            const def = CONTENT.gems.get(g.gemId);
            const on = state.activeSpirit.includes(g.uid);
            return (
              <li key={g.uid} className="list-row">
                <div className="stack">
                  <strong>
                    <Icon name={gemIcon(def)} size={16} className="inline-icon" /> {nameOf(g.gemId)}
                  </strong>
                  <span className="small dim">
                    {gemLines(def, gemLevel(g.xp), g.quality).join(' · ')}
                  </span>
                </div>
                <button
                  className={`btn${on ? '' : ' btn-primary'}`}
                  onClick={() => void command({ type: 'toggleSpirit', uid: g.uid, active: !on })}
                >
                  {on ? t('gems.deactivate') : t('gems.activate')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type Filter = 'all' | 'skill' | 'support' | 'spirit';

function Inventory({ state }: { state: GameState }) {
  const [filter, setFilter] = useState<Filter>('all');
  const socketed = socketedSupportUids(state);
  const inBar = new Set(state.skillBar.map((s) => s.gemUid));
  const gems = state.gems.filter(
    (g) => filter === 'all' || CONTENT.gems.get(g.gemId).kind === filter,
  );
  return (
    <section className="panel panel-wide">
      <div className="card-head">
        <h2 className="section-title">{t('gems.inventory')}</h2>
        <div className="row-tight" role="tablist">
          {(['all', 'skill', 'support', 'spirit'] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={`btn btn-small${filter === f ? ' btn-primary' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? t('gems.filter.all') : tDynamic(`gemKind.${f}`)}
            </button>
          ))}
        </div>
      </div>
      {state.gems.length === 0 ? (
        <p className="dim">{t('gems.none')}</p>
      ) : (
        <div className="card-grid">
          {gems.map((g) => (
            <GemCard
              key={g.uid}
              state={state}
              gem={g}
              inUse={inBar.has(g.uid) || socketed.has(g.uid) || state.activeSpirit.includes(g.uid)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function costText(state: GameState, cost: Record<string, number>): string {
  return Object.entries(cost)
    .map(([id, q]) => `${q}× ${nameOf(id)} (${state.bank.items[id] ?? 0})`)
    .join(' + ');
}

function GemCard({ state, gem, inUse }: { state: GameState; gem: GemInstance; inUse: boolean }) {
  const def = CONTENT.gems.get(gem.gemId);
  const level = gemLevel(gem.xp);
  const max = level >= MAX_GEM_LEVEL;
  const lo = gemXpForLevel(level);
  const hi = gemXpForLevel(level + 1);
  const progress = max ? 1 : (gem.xp - lo) / Math.max(1, hi - lo);
  const has = (cost: Record<string, number>) =>
    Object.entries(cost).every(([id, q]) => (state.bank.items[id] ?? 0) >= q);
  const pCost = polishCost(gem.quality);
  const nextSocket = gem.sockets + 1;
  const sCost = SOCKET_COSTS[nextSocket];
  return (
    <div className={`card gem-card gem-${def.kind}`}>
      <div className="card-head">
        <div className="card-title">
          <Icon name={gemIcon(def)} size={20} className="inline-icon" /> {nameOf(def.id)}
        </div>
        <span className="tag">{t('gem.tier', { n: def.tier })}</span>
      </div>
      <div className="small dim">
        {gemTags(def)}
        {inUse && <span className="tag tag-good"> {t('gems.inUse')}</span>}
      </div>
      <div className="small">
        {max ? t('gem.levelMax', { n: level }) : t('gem.level', { n: level })} ·{' '}
        {t('gem.qualityTag', { n: gem.quality })}
      </div>
      <ProgressBar value={progress} label={t('gem.level', { n: level })} />
      <ul className="gem-lines small">
        {gemLines(def, level, gem.quality).map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <div className="stack small">
        <button
          className="btn btn-small"
          disabled={gem.quality >= MAX_QUALITY || !has(pCost)}
          title={t('gems.cost', { list: costText(state, pCost) })}
          onClick={() => void command({ type: 'polishGem', uid: gem.uid })}
        >
          {t('gems.polish')}
        </button>
        {gem.quality < MAX_QUALITY && (
          <span className="faint">{t('gems.cost', { list: costText(state, pCost) })}</span>
        )}
        {def.kind === 'skill' && gem.sockets < MAX_SOCKETS && sCost && (
          <>
            <button
              className="btn btn-small"
              disabled={!has(sCost)}
              onClick={() => void command({ type: 'openGemSocket', uid: gem.uid })}
            >
              {t('gems.openSocket', { n: nextSocket })}
            </button>
            <span className="faint">{t('gems.cost', { list: costText(state, sCost) })}</span>
          </>
        )}
        <button
          className="btn btn-small btn-danger"
          onClick={() => {
            if (window.confirm(t('gems.destroyConfirm', { name: nameOf(def.id) })))
              void command({ type: 'destroyGem', uid: gem.uid });
          }}
        >
          {t('gems.destroy')}
        </button>
      </div>
    </div>
  );
}
