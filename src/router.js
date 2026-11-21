import { pages } from './data/pages.js'

export function getSlug() {
  const path = window.location.pathname.replace(/\/+$/, '')
  const slug = path.startsWith('/') ? path.slice(1) : path
  return Object.prototype.hasOwnProperty.call(pages, slug) ? slug : 'home'
}

export function navigate(path) {
  if (path === window.location.pathname + window.location.search + window.location.hash) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'instant' })
}
