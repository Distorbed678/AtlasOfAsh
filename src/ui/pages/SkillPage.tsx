import { actionsForSkill, CONTENT } from '../../engine/content';
import type { ActionDef, SkillId } from '../../engine/content/types';
import {
  canPerform,
  craftRarityChances,
  cycleDuration,
  maxRockHp,
  skillLevel,
} from '../../engine/skills/actions';
import {
  masteryLevel,
  playerModifiers,
  poolCap,
  poolCostForNextMastery,
  poolFraction,
  POOL_THRESHOLDS,
} from '../../engine/skills/mastery';
import { actionRates } from '../../engine/skills/rates';
import {
  levelProgress,
  MAX_MASTERY_LEVEL,
  MAX_SKILL_LEVEL,
  xpForLevel,
} from '../../engine/skills/xp';
import type { GameState } from '../../engine/state';
import { nameOf, t, tDynamic, type TKey } from '../../i18n';
import { formatDuration, formatNumber, formatPercent } from '../../shared/format';
import { useState } from 'react';
import { command, useGame, useGameState } from '../bridge';
import { EnchantPanel } from '../components/EnchantPanel';
import { GemcuttingPanel } from '../components/GemcuttingPanel';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { SkillXpBar } from '../components/SkillHeader';
import { describeOutputs } from '../describe';
import { SKILL_ICONS } from '../icons';

const HOUR = 3_600_000;

export function SkillPage({ skillId }: { skillId: SkillId }) {
  const skill = CONTENT.skills.get(skillId);
  const totalXp = useGameState((s) => s.skills[skillId].xp);

  return (
    <div className="page">
      <div className="skill-header">
        <h1 className="page-title">
          <Icon name={SKILL_ICONS[skillId]} size={30} className="title-icon" />
          {nameOf(skillId)}
        </h1>
        <p className="dim">{tDynamic(`${skillId}.desc`)}</p>
      </div>
      <div className="panel panel-wide">
        <SkillXpBar skillId={skillId} />
        <div className="faint small">{t('skill.totalXp', { xp: formatNumber(totalXp) })}</div>
        <NextUnlock skillId={skillId} />
        {skill.rareFinds.map((r) => (
          <div key={r.itemId} className="dim small">
            {t('skill.rareFind', { item: nameOf(r.itemId), n: Math.round(1 / r.chance) })}
          </div>
        ))}
      </div>
      {skillId !== 'skill.gemcutting' && <PoolPanel skillId={skillId} />}
      {skillId === 'skill.enchanting' && <EnchantPanel />}
      {skillId === 'skill.gemcutting' ? (
        <GemcuttingPanel />
      ) : skill.kind === 'artisan' ? (
        <ArtisanBrowser skillId={skillId} />
      ) : (
        <div className="card-grid card-grid-wide">
          {actionsForSkill(skillId).map((def) => (
            <ActionCard key={def.id} def={def} />
          ))}
        </div>
      )}
    </div>
  );
}

/** The action whose XP rate we use for estimates: the active one in this skill, else the best. */
function referenceAction(state: GameState, skillId: SkillId): ActionDef | null {
  const active = state.action ? CONTENT.actions.get(state.action.actionId) : null;
  if (active?.skillId === skillId) return active;
  let best: ActionDef | null = null;
  let bestXp = 0;
  for (const def of actionsForSkill(skillId)) {
    if (!canPerform(state, def)) continue;
    const xp = actionRates(state, def).xpPerHour;
    if (xp > bestXp) {
      best = def;
      bestXp = xp;
    }
  }
  return best;
}

function NextUnlock({ skillId }: { skillId: SkillId }) {
  const state = useGame((s) => s.state) as GameState;
  const level = skillLevel(state, skillId);
  const next = actionsForSkill(skillId).find((a) => a.level > level);
  if (!next) return null;
  const ref = referenceAction(state, skillId);
  const xpNeeded = xpForLevel(next.level) - state.skills[skillId].xp;
  const rate = ref ? actionRates(state, ref).xpPerHour : 0;
  return (
    <div className="small">
      {t('skill.next', { action: nameOf(next.id), level: next.level })}
      {ref && rate > 0 && (
        <span className="dim">
          {' — '}
          {t('skill.nextEta', {
            time: formatDuration((xpNeeded / rate) * HOUR),
            action: nameOf(ref.id),
          })}
        </span>
      )}
    </div>
  );
}

function PoolPanel({ skillId }: { skillId: SkillId }) {
  const pool = useGameState((s) => s.skills[skillId].pool);
  const fraction = useGameState((s) => poolFraction(s, skillId));
  const cap = poolCap(skillId);
  const kind = CONTENT.skills.get(skillId).kind;
  const bonusKeys: TKey[] = [
    'skill.bonus.10',
    'skill.bonus.25',
    'skill.bonus.50',
    kind === 'thieving' ? 'skill.bonus.95.thieving' : 'skill.bonus.95.gathering',
  ];
  return (
    <div className="panel panel-wide">
      <div className="xp-bar-labels">
        <span className="xp-level">{t('skill.pool')}</span>
        <span className="dim small">
          {t('skill.poolValue', {
            value: formatNumber(pool),
            cap: formatNumber(cap),
            pct: formatPercent(fraction),
          })}
        </span>
      </div>
      <div className="pool-bar">
        <ProgressBar value={fraction} label={t('skill.pool')} />
        {POOL_THRESHOLDS.map((th) => (
          <span key={th} className="pool-mark" style={{ left: `${th * 100}%` }} />
        ))}
      </div>
      <ul className="pool-bonuses">
        {POOL_THRESHOLDS.map((th, i) => (
          <li key={th} className={fraction >= th ? 'active' : ''}>
            <span className="pool-th">{formatPercent(th, 0)}</span> {t(bonusKeys[i]!)}
          </li>
        ))}
      </ul>
      <p className="faint small">{t('skill.poolHelp')}</p>
    </div>
  );
}

function MasteryBonuses({ state, def }: { state: GameState; def: ActionDef }) {
  const mods = playerModifiers(state, def, skillLevel(state, def.skillId));
  const lines: string[] = [];
  if (mods.durationMult < 1)
    lines.push(t('action.bonus.time', { pct: formatPercent(1 - mods.durationMult, 0) }));
  if (mods.doubleChance > 0)
    lines.push(t('action.bonus.double', { pct: formatPercent(mods.doubleChance, 0) }));
  if (def.type === 'rock' && mods.rockHpBonus > 0)
    lines.push(t('action.bonus.rock', { n: mods.rockHpBonus }));
  if (def.type === 'craft' && def.output.kind === 'gear') {
    const c = craftRarityChances(masteryLevel(state, def));
    lines.push(
      t('craft.rarity', { magic: formatPercent(c.magic, 1), rare: formatPercent(c.rare, 1) }),
    );
  }
  if (def.type === 'thieve')
    lines.push(t('action.bonus.stealth', { n: mods.stealth, perception: def.perception }));
  return (
    <details className="mastery-details small">
      <summary>{t('action.masteryBonuses')}</summary>
      {lines.length === 0 ? (
        <p className="faint">{t('action.bonus.none')}</p>
      ) : (
        <ul>
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </details>
  );
}

function ActionCard({ def }: { def: ActionDef }) {
  const state = useGame((s) => s.state) as GameState;
  const unlocked = canPerform(state, def);

  if (!unlocked) {
    return (
      <div className="card card-locked">
        <div className="card-title">{nameOf(def.id)}</div>
        <div className="dim small">{t('action.locked', { level: def.level })}</div>
      </div>
    );
  }

  const runner = state.action?.actionId === def.id ? state.action : null;
  const active = runner !== null;
  const mlvl = masteryLevel(state, def);
  const mprog = levelProgress(state.skills[def.skillId].mastery[def.id] ?? 0, MAX_MASTERY_LEVEL);
  const duration = cycleDuration(state, def, { kind: 'player' });
  const poolCost = poolCostForNextMastery(state, def);
  const canSpend = poolCost !== null && state.skills[def.skillId].pool >= poolCost;
  const workerHere = state.workers.some((w) => w.actionId === def.id);
  const rates = actionRates(state, def);
  const skillXp = levelProgress(state.skills[def.skillId].xp);
  const mainItem = Object.entries(rates.itemsPerHour).sort((a, b) => b[1] - a[1])[0];

  let progress = 0;
  let status: string | null = null;
  if (runner) {
    if (runner.rockRespawnAt && state.time < runner.rockRespawnAt) status = t('action.respawning');
    else if (runner.stunnedUntil && state.time < runner.stunnedUntil) status = t('action.stunned');
    else progress = (state.time - runner.startedAt) / (runner.nextAt - runner.startedAt);
  }

  return (
    <div className={`card${active ? ' card-active' : ''}`}>
      <div className="card-head">
        <div className="card-title">{nameOf(def.id)}</div>
        <span className="tag">T{def.tier}</span>
      </div>
      <div className="dim small">{describeOutputs(def)}</div>
      {def.type === 'craft' && (
        <div className="craft-inputs small">
          <span className="faint">{t('craft.needs')}</span>
          {Object.entries(def.inputs).map(([id, q]) => {
            const have = state.bank.items[id] ?? 0;
            return (
              <span key={id} className={have >= q ? '' : 'bad'}>
                {q}× {nameOf(id)} <span className="faint">({formatNumber(have)})</span>
              </span>
            );
          })}
        </div>
      )}
      <div className="stat-row small">
        <span>{formatDuration(duration)}</span>
        <span>{t('action.xp', { xp: def.xp })}</span>
        {def.type === 'thieve' && (
          <span>{t('action.success', { pct: formatPercent(rates.successChance, 0) })}</span>
        )}
      </div>
      <div className="stat-row small rates">
        <span>{t('action.rates', { xp: formatNumber(Math.round(rates.xpPerHour)) })}</span>
        {def.type === 'thieve' ? (
          <span>{t('action.goldRate', { n: formatNumber(Math.round(rates.goldPerHour)) })}</span>
        ) : (
          mainItem && (
            <span>
              {t('action.itemsRate', {
                n: formatNumber(Math.round(mainItem[1])),
                item: nameOf(mainItem[0]),
              })}
            </span>
          )
        )}
      </div>
      {!skillXp.atCap && skillXp.level < MAX_SKILL_LEVEL && (
        <div className="faint small">
          {t('action.nextLevel', {
            time: formatDuration(((skillXp.needed - skillXp.current) / rates.xpPerHour) * HOUR),
          })}
        </div>
      )}
      {def.type === 'rock' && (
        <div className="faint small">
          {t('action.rock', {
            hp: runner?.rockHp ?? maxRockHp(state, def, { kind: 'player' }),
            max: maxRockHp(state, def, { kind: 'player' }),
          })}
        </div>
      )}
      <ProgressBar value={progress} label={nameOf(def.id)} />
      {status && <div className="status small">{status}</div>}
      <div className="mastery-row small">
        <span>{t('action.mastery', { level: mlvl })}</span>
        <div className="mini-bar">
          <div className="mini-fill" style={{ width: `${mprog.fraction * 100}%` }} />
        </div>
      </div>
      <MasteryBonuses state={state} def={def} />
      {workerHere && <div className="faint small">{t('action.workerHere')}</div>}
      <div className="row">
        <button
          className={`btn ${active ? '' : 'btn-primary'}`}
          onClick={() =>
            void command(
              active ? { type: 'stopAction' } : { type: 'startAction', actionId: def.id },
            )
          }
        >
          {active ? t('action.stop') : t('action.start')}
        </button>
        {canSpend && (
          <button
            className="btn btn-small"
            onClick={() => {
              if (
                window.confirm(
                  t('action.spendConfirm', { cost: formatNumber(poolCost!), level: mlvl + 1 }),
                )
              )
                void command({ type: 'spendPool', skillId: def.skillId, actionId: def.id });
            }}
          >
            {t('action.spendPool', { cost: formatNumber(poolCost!) })}
          </button>
        )}
      </div>
    </div>
  );
}

/** Grouped recipe browser for artisan skills: group tabs, then a type filter, then the 10 tiers. */
function ArtisanBrowser({ skillId }: { skillId: SkillId }) {
  const actions = actionsForSkill(skillId);
  const groups = [...new Set(actions.map((a) => (a.type === 'craft' ? a.group : 'other')))];
  const [group, setGroup] = useState(groups[0]!);
  const inGroup = actions.filter((a) => a.type === 'craft' && a.group === group);
  const kindOf = (a: ActionDef) => {
    if (a.type !== 'craft' || a.output.kind !== 'gear') return 'all';
    const base = CONTENT.bases.get(a.output.baseId);
    return base.defenceType ? `${base.class}:${base.defenceType}` : base.class;
  };
  const kinds = [...new Set(inGroup.map(kindOf))];
  const [kindState, setKind] = useState('');
  const kind = kinds.includes(kindState) ? kindState : kinds[0]!;
  const kindLabel = (k: string) => {
    if (k === 'all') return '';
    const [cls, def] = k.split(':');
    return def
      ? `${tDynamic(`baseclass.${cls}`)} — ${tDynamic(`defence.${def}`)}`
      : tDynamic(`baseclass.${cls}`);
  };
  const shown = inGroup.filter((a) => kindOf(a) === kind);

  return (
    <>
      <div className="tabs" role="tablist">
        {groups.map((g) => (
          <button
            key={g}
            role="tab"
            aria-selected={g === group}
            className={`tab${g === group ? ' active' : ''}`}
            onClick={() => setGroup(g)}
          >
            {tDynamic(`group.${g}`)}
          </button>
        ))}
      </div>
      {kinds.length > 1 && (
        <label className="row small">
          {t('craft.kind')}
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="card-grid card-grid-wide">
        {shown.map((def) => (
          <ActionCard key={def.id} def={def} />
        ))}
      </div>
    </>
  );
}
