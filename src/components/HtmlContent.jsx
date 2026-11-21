import React, { useEffect, useMemo, useRef } from 'react'
import { BASE, navigate, toHref } from '../router.js'

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const SKIP_TAGS = new Set(['script', 'style', 'link', 'meta', 'title'])
const ATTR_NAMES = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  maxlength: 'maxLength',
  spellcheck: 'spellCheck',
  readonly: 'readOnly',
  autocomplete: 'autoComplete',
}

function toElement(node, key) {
  if (node.nodeType === 3) return node.nodeValue
  if (node.nodeType !== 1) return null

  const tag = node.tagName.toLowerCase()
  if (SKIP_TAGS.has(tag)) return null

  const props = { key }
  for (const attr of node.attributes) {
    if (attr.name.startsWith('on')) continue
    const name = ATTR_NAMES[attr.name] || attr.name
    props[name] = name === 'href' && attr.value.startsWith('/') && !attr.value.startsWith('//')
      ? toHref(attr.value)
      : attr.value
  }

  if (VOID_TAGS.has(tag)) return React.createElement(tag, props)

  const children = Array.from(node.childNodes)
    .map((child, index) => toElement(child, index))
    .filter((child) => child !== null && child !== undefined)

  return React.createElement(tag, props, ...children)
}

export default function HtmlContent({ html, onTabChange }) {
  const rootRef = useRef(null)
  const onTabChangeRef = useRef(onTabChange)
  onTabChangeRef.current = onTabChange

  const nodes = useMemo(() => {
    const doc = new DOMParser().parseFromString(`<div id="root-content">${html}</div>`, 'text/html')
    return Array.from(doc.getElementById('root-content').childNodes)
      .map((child, index) => toElement(child, index))
      .filter((child) => child !== null && child !== undefined)
  }, [html])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    const buttons = Array.from(root.querySelectorAll('.tab-btn'))
    const panels = Array.from(root.querySelectorAll('.tab-panel'))
    if (!buttons.length) return undefined

    function activate(id, updateHash) {
      const button = buttons.find((btn) => btn.getAttribute('data-tab') === id)
      if (!button) return false

      buttons.forEach((btn) => {
        const active = btn === button
        btn.classList.toggle('aktif', active)
        btn.setAttribute('aria-selected', active ? 'true' : 'false')
      })
      panels.forEach((panel) => panel.classList.toggle('aktif', panel.id === id))

      if (updateHash) window.history.replaceState(null, '', `#${id}`)
      onTabChangeRef.current?.(id)
      return true
    }

    const hash = window.location.hash.replace('#', '')
    if (!activate(hash, false)) activate(buttons[0].getAttribute('data-tab'), false)

    function handleClick(event) {
      const tabButton = event.target.closest('.tab-btn')
      if (tabButton && root.contains(tabButton)) {
        const id = tabButton.getAttribute('data-tab')
        if (activate(id, true)) {
          const panel = panels.find((item) => item.id === id)
          if (panel) window.scrollTo({ top: panel.getBoundingClientRect().top + window.pageYOffset - 130, behavior: 'smooth' })
        }
        return
      }

      const link = event.target.closest('a')
      if (!link || !root.contains(link)) return
      const href = link.getAttribute('href') || ''

      if (href.startsWith('#')) {
        const target = document.getElementById(href.slice(1))
        const panel = target?.closest('.tab-panel')
        if (panel && !panel.classList.contains('aktif')) activate(panel.id, true)
        return
      }

      const localPath = BASE !== '/' && href.startsWith(BASE) ? href.slice(BASE.length - 1) : href
      if (/^\/[a-z0-9-]*\/?$/.test(localPath)) {
        event.preventDefault()
        navigate(localPath)
      }
    }

    function handleHashChange() {
      activate(window.location.hash.replace('#', ''), false)
    }

    root.addEventListener('click', handleClick)
    window.addEventListener('hashchange', handleHashChange)
    return () => {
      root.removeEventListener('click', handleClick)
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [html])

  return <div ref={rootRef}>{nodes}</div>
}
