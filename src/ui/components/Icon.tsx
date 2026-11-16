import { ICON_DATA } from '../iconData';

interface IconProps {
  name: string;
  size?: number;
  /** Item tier 1-10: tints the icon along the tier colour ramp. */
  tier?: number;
  className?: string;
}

/** game-icons.net glyph rendered from path data, coloured with currentColor. */
export function Icon({ name, size = 20, tier, className }: IconProps) {
  const icon = ICON_DATA[name];
  if (!icon) return null;
  const cls = ['icon', tier ? `tier-${tier}` : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <path d={icon.d} fill="currentColor" />
    </svg>
  );
}
