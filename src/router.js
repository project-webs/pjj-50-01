import { pages } from './data/pages.js'

export const BASE = import.meta.env.BASE_URL || '/'

function withoutBase(pathname) {
  if (BASE !== '/' && pathname.startsWith(BASE)) return pathname.slice(BASE.length - 1)
  return pathname
}

export function toHref(path) {
  return BASE + path.replace(/^\/+/, '')
}

export function getSlug() {
  const path = withoutBase(window.location.pathname).replace(/\/+$/, '')
  const slug = path.startsWith('/') ? path.slice(1) : path
  return Object.prototype.hasOwnProperty.call(pages, slug) ? slug : 'home'
}

export function navigate(path) {
  const href = toHref(path)
  if (href === window.location.pathname + window.location.search + window.location.hash) return
  window.history.pushState({}, '', href)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'instant' })
}
