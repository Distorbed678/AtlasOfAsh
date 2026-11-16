import type { SkillId } from '../../engine/content/types';
import { levelProgress } from '../../engine/skills/xp';
import { t } from '../../i18n';
import { formatNumber } from '../../shared/format';
import { useGameState } from '../bridge';
import { ProgressBar } from './ProgressBar';

export function SkillXpBar({ skillId }: { skillId: SkillId }) {
  const xp = useGameState((s) => s.skills[skillId].xp);
  const p = levelProgress(xp);
  return (
    <div className="xp-bar">
      <div className="xp-bar-labels">
        <span className="xp-level">{t('skill.level', { level: p.level })}</span>
        <span className="dim small">
          {p.atCap
            ? t('skill.maxed')
            : t('skill.xp', { current: formatNumber(p.current), needed: formatNumber(p.needed) })}
        </span>
      </div>
      <ProgressBar value={p.fraction} label={t('skill.level', { level: p.level })} />
    </div>
  );
}
