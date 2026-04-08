import clsx from 'clsx'

const TIER_CONFIG = {
  top:        { label: 'Top',        bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  solid:      { label: 'Solid',      bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  developing: { label: 'Developing', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  watch:      { label: 'Watch',      bg: 'bg-red-500/15 text-red-400 border-red-500/30' },
} as const

export type Tier = keyof typeof TIER_CONFIG

export default function TierBadge({ tier }: { tier: Tier }) {
  const { label, bg } = TIER_CONFIG[tier]
  return (
    <span className={clsx('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', bg)}>
      {label}
    </span>
  )
}
