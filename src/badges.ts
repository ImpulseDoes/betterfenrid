import type { IconName } from './ui/icons'

export interface BadgeType {
  label: string
  icon: IconName
  color: string
}

export const BADGE_TYPES = {
  developer: { label: 'Better Fenrid Developer', icon: 'verified', color: '#3f56f5' },
  contributor: { label: 'Better Fenrid Contributor', icon: 'plugins', color: '#4756ef' },
  fencordDeveloper: { label: 'Fencord Developer', icon: 'code', color: '#4756ef' },
} satisfies Record<string, BadgeType>

export type BadgeId = keyof typeof BADGE_TYPES

export const BADGE_HOLDERS: Record<string, BadgeId[]> = {
  // Meeeeeeeeeeeeeeeeeeeee!!!!!!!!!!!!
  '366486701203860': ['developer'],
  '110864555902508682': ['fencordDeveloper'],
  '328334059356195': ['fencordDeveloper'],
  '349197476036700': ['fencordDeveloper'],
}