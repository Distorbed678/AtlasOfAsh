import { actionsForSkill, CONTENT } from '../../engine/content';
import type { ActionDef, SkillId } from '../../engine/content/types';
import { canPerform, cycleDuration, maxRockHp, successChance } from '../../engine/skills/actions';
import {
  masteryLevel,
  poolCap,
  poolCostForNextMastery,
  poolFraction,
  POOL_THRESHOLDS,
} from '../../engine/skills/mastery';
import { levelProgress, MAX_MASTERY_LEVEL } from '../../engine/skills/xp';
import type { GameState } from '../../engine/state';
import { nameOf, t, tDynamic, type TKey } from '../../i18n';
import { formatDuration, formatNumber, formatPercent } from '../../shared/format';
import { command, useGame, useGameState } from '../bridge';
import { ProgressBar } from '../components/ProgressBar';
import { SkillXpBar } from '../components/SkillHeader';
import { describeOutputs } from '../describe';
import { SKILL_ICONS } from '../icons';

export function SkillPage({ skillId }: { skillId: SkillId }) {
  const skill = CONTENT.skills.get(skillId);
  const totalXp = useGameState((s) => s.skills[skillId].xp);

  return (
    <div className="page">
      <div className="skill-header">
        <h1 className="page-title">
          <span className="title-icon" aria-hidden="true">
            {SKILL_ICONS[skillId]}
          </span>
          {nameOf(skillId)}
        </h1>
        <p className="dim">{tDynamic(`${skillId}.desc`)}</p>
      </div>
      <div className="panel panel-wide">
        <SkillXpBar skillId={skillId} />
        <div className="faint small">{t('skill.totalXp', { xp: formatNumber(totalXp) })}</div>
        {skill.rareFinds.map((r) => (
          <div key={r.itemId} className="dim small">
            {t('skill.rareFind', { item: nameOf(r.itemId), n: Math.round(1 / r.chance) })}
          </div>
        ))}
      </div>
      <PoolPanel skillId={skillId} />
      <div className="card-grid card-grid-wide">
        {actionsForSkill(skillId).map((def) => (
          <ActionCard key={def.id} def={def} />
        ))}
      </div>
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

function ActionCard({ def }: { def: ActionDef }) {
  const state = useGame((s) => s.state) as GameState;
  const unlocked = canPerform(state, def);
  const runner = state.action?.actionId === def.id ? state.action : null;
  const active = runner !== null;
  const mlvl = masteryLevel(state, def);
  const mxp = state.skills[def.skillId].mastery[def.id] ?? 0;
  const mprog = levelProgress(mxp, MAX_MASTERY_LEVEL);
  const duration = cycleDuration(state, def, { kind: 'player' });
  const poolCost = poolCostForNextMastery(state, def);
  const canSpend = poolCost !== null && state.skills[def.skillId].pool >= poolCost;
  const workerHere = state.workers.some((w) => w.actionId === def.id);

  let progress = 0;
  let status: string | null = null;
  if (runner) {
    if (runner.rockRespawnAt && state.time < runner.rockRespawnAt) status = t('action.respawning');
    else if (runner.stunnedUntil && state.time < runner.stunnedUntil) status = t('action.stunned');
    else progress = (state.time - runner.startedAt) / (runner.nextAt - runner.startedAt);
  }

  if (!unlocked) {
    return (
      <div className="card card-locked">
        <div className="card-title">{nameOf(def.id)}</div>
        <div className="dim small">{t('action.locked', { level: def.level })}</div>
      </div>
    );
  }

  return (
    <div className={`card${active ? ' card-active' : ''}`}>
      <div className="card-head">
        <div className="card-title">{nameOf(def.id)}</div>
        <span className="tag">T{def.tier}</span>
      </div>
      <div className="dim small">{describeOutputs(def)}</div>
      <div className="stat-row small">
        <span>{formatDuration(duration)}</span>
        <span>{t('action.xp', { xp: def.xp })}</span>
        {def.type === 'thieve' && (
          <span>
            {t('action.success', {
              pct: formatPercent(successChance(state, def, { kind: 'player' }), 0),
            })}
          </span>
        )}
      </div>
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
