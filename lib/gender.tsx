import React from 'react'
import { createLucideIcon } from 'lucide-react'

export type Gender = 'MALE' | 'FEMALE' | 'OTHER'

// lucide-react doesn't currently ship mars/venus icons.
// We create lightweight equivalents with createLucideIcon.
export const Mars = createLucideIcon('Mars', [
  // circle
  ['circle', { cx: '10', cy: '14', r: '4', key: 'c' }],
  // arrow
  ['path', { d: 'M13 11L18 6', key: 'a1' }],
  ['path', { d: 'M14 6h4v4', key: 'a2' }],
])

export const Venus = createLucideIcon('Venus', [
  // circle
  ['circle', { cx: '12', cy: '9', r: '4', key: 'c' }],
  // cross
  ['path', { d: 'M12 13v6', key: 'v1' }],
  ['path', { d: 'M9 16h6', key: 'v2' }],
])

export const NonBinary = createLucideIcon('NonBinary', [
  // circle
  ['circle', { cx: '12', cy: '12', r: '4', key: 'c' }],
  // arrow (mars-like)
  ['path', { d: 'M15 9L18 6', key: 'a1' }],
  ['path', { d: 'M14 6h4v4', key: 'a2' }],
  // cross (venus-like)
  ['path', { d: 'M12 16v5', key: 'v1' }],
  ['path', { d: 'M9 19h6', key: 'v2' }],
])

export function GenderIcon({ gender, className }: { gender: Gender | null | undefined; className?: string }): React.JSX.Element {
  const g: Gender = gender ?? 'MALE'
  if (g === 'FEMALE') return <Venus className={className} />
  if (g === 'OTHER') return <NonBinary className={className} />
  return <Mars className={className} />
}
