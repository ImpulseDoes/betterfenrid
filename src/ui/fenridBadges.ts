import { BADGE_ICONS, BUG_HUNTER_LOOKS } from '../assets/fenridBadges'
import { h } from '../core/dom'

export const FENRID_BADGES = {
  staff: 'Staff',
  partner: 'Partner',
  early_supporter: 'Early Supporter',
  prime: 'Prime',
  flare: 'Flare',
  surge: 'Surge',
  bug_hunter_iii: 'Bug Hunter III',
  bug_hunter_ii: 'Bug Hunter II',
  bug_hunter_i: 'Bug Hunter I',
}

export type FenridBadgeId = keyof typeof FENRID_BADGES

type BugHunterId = keyof typeof BUG_HUNTER_LOOKS
type IconId = keyof typeof BADGE_ICONS

// Each copy needs its own ids, or a gradient would break along with the first card using it
let nextId = 0

const svg = (viewBox: string, size: number, content: string) =>
  `<svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block;overflow:visible">${content}</svg>`

const stops = (list: { offset: string; color: string; opacity: string }[]) =>
  list.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}" stop-opacity="${s.opacity}"/>`).join('')

function planIcon(id: Exclude<IconId, BugHunterId>, size: number): string {

  const { viewBox, d } = BADGE_ICONS[id]
  const key = `bf-badge-${nextId++}`

  return svg(viewBox, size, `
    <defs>
      <linearGradient id="${key}-blue" x1="36" y1="34" x2="211" y2="218" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#7471ff"/><stop offset="0.42" stop-color="#5460ff"/><stop offset="1" stop-color="#3447de"/>
      </linearGradient>
      <linearGradient id="${key}-soft" x1="75" y1="45" x2="183" y2="206" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#8c89ff" stop-opacity="0.72"/><stop offset="0.48" stop-color="#5b66ff" stop-opacity="0.24"/><stop offset="1" stop-color="#1e2ebc" stop-opacity="0"/>
      </linearGradient>
      <filter id="${key}-blur" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0.18"/></filter>
    </defs>
    <path d="${d}" fill="url(#${key}-blue)" fill-rule="evenodd" clip-rule="evenodd" filter="url(#${key}-blur)"/>
    <path d="${d}" fill="url(#${key}-soft)" fill-rule="evenodd" clip-rule="evenodd" opacity="0.48"/>`)
}

function bugHunterIcon(id: BugHunterId, size: number): string {

  const { viewBox, d } = BADGE_ICONS[id]
  const look = BUG_HUNTER_LOOKS[id]
  const key = `bf-badge-${nextId++}`
  const { cx, cy } = look.lens
  const rotate = `rotate(45 ${cx} ${cy})`
  const [body0, body1, body2, body3] = look.bodyStops

  return svg(viewBox, size, `
    <defs>
      <linearGradient id="${key}-body" x1="41" y1="43" x2="194" y2="201" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${body0}"/><stop offset="0.35" stop-color="${body1}"/><stop offset="0.78" stop-color="${body2}"/><stop offset="1" stop-color="${body3}"/>
      </linearGradient>
      <radialGradient id="${key}-lens" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="${look.lensTransform}">${stops(look.lensStops)}</radialGradient>
      <linearGradient id="${key}-glass" x1="${look.glass.x1}" y1="${look.glass.y1}" x2="${look.glass.x2}" y2="${look.glass.y2}" gradientUnits="userSpaceOnUse">${stops(look.glass.stops)}</linearGradient>
      <clipPath id="${key}-shape"><path d="${d}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath>
      <clipPath id="${key}-circle"><circle cx="${cx}" cy="${cy}" r="60"/></clipPath>
      <filter id="${key}-blur" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0.16"/></filter>
    </defs>
    <path d="${d}" fill="url(#${key}-body)" fill-rule="evenodd" clip-rule="evenodd" filter="url(#${key}-blur)"/>
    <g clip-path="url(#${key}-shape)">
      <g clip-path="url(#${key}-circle)">
        <circle cx="${cx}" cy="${cy}" r="60" fill="url(#${key}-lens)" opacity="${look.lens.opacity}"/>
        <circle cx="${cx}" cy="${cy}" r="48" fill="${look.innerFill}" opacity="${look.innerOpacity}"/>
        <rect x="${look.band.x}" y="98" width="168" height="20" rx="10" transform="${rotate}" fill="url(#${key}-glass)" opacity="${look.band.opacity}"/>
        <rect x="${look.shine.x}" y="74" width="142" height="8" rx="4" transform="${rotate}" fill="${look.shine.fill}" opacity="${look.shine.opacity}"/>
        <path d="${look.lowerShade}" fill="${look.lowerShadeFill}" opacity="${look.lowerShadeOpacity}"/>
        <ellipse cx="${look.highlight.cx}" cy="85" rx="10" ry="14" transform="rotate(-22 ${look.highlight.cx} 85)" fill="${look.highlight.fill}" opacity="${look.highlight.opacity}"/>
        <circle cx="${cx}" cy="${cy}" r="57.5" fill="none" stroke="#ffffff" stroke-opacity="${look.rimLightOpacity}" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy}" r="60" fill="none" stroke="${look.rimDark}" stroke-opacity="${look.rimDarkOpacity}" stroke-width="5"/>
      </g>
      <path d="M49 162 C86 188 143 190 184 151" stroke="${look.sweepShadow}" stroke-opacity="0.08" stroke-width="28" stroke-linecap="round"/>
    </g>`)
}

const isBugHunter = (id: FenridBadgeId): id is BugHunterId => id in BUG_HUNTER_LOOKS

/** Draws one of Fenrid's badges the way its own badge row does */
export function fenridBadgeIcon(id: FenridBadgeId, size = 20): Element {

  if (id === 'early_supporter') {

    return h('img', {
      src: '/badges/early-supporter.svg',
      width: String(size),
      height: String(size),
      alt: '',
      'aria-hidden': 'true',
      draggable: 'false',
      style: `display:block;width:${size}px;height:${size}px;object-fit:contain`,
    })
  }

  const template = document.createElement('template')

  template.innerHTML = isBugHunter(id) ? bugHunterIcon(id, size) : planIcon(id, size)

  return template.content.firstElementChild!
}