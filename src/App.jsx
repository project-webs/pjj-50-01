import { useEffect, useState } from 'react'
import HtmlContent from './components/HtmlContent.jsx'
import CodeChecker from './components/CodeChecker.jsx'
import { pages } from './data/pages.js'
import { getSlug, navigate, toHref } from './router.js'

const MATA_KULIAH = [
  { slug: 'agama-islam', icon: '🕌', label: 'Agama Islam' },
  { slug: 'pendidikan-karakter', icon: '🌟', label: 'Pendidikan Karakter' },
  { slug: 'kalkulus', icon: '📐', label: 'Kalkulus' },
  { slug: 'algoritma-dan-pemrograman', icon: '💻', label: 'Algoritma dan Pemrograman' },
  { slug: 'matematika-diskrit', icon: '🔢', label: 'Matematika Diskrit' },
  { slug: 'logika-matematika', icon: '🧠', label: 'Logika Matematika' },
  { slug: 'statistika', icon: '📊', label: 'Statistika' },
]

const APLIKASI = [{ slug: 'pseudocode-check', icon: '🧪', label: 'Code Checker' }]

function NavItem({ item, slug, onNavigate }) {
  return (
    <li>
      <a
        href={toHref(`/${item.slug}`)}
        className={slug === item.slug ? 'aktif' : ''}
        onClick={(event) => {
          event.preventDefault()
          onNavigate(`/${item.slug}`)
        }}
      >
        <span className="ikon">{item.icon}</span> {item.label}
      </a>
    </li>
  )
}

export default function App() {
  const [slug, setSlug] = useState(getSlug)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [semester, setSemester] = useState(1)
  const [navKey, setNavKey] = useState(0)

  useEffect(() => {
    const handlePopState = () => {
      setSlug(getSlug())
      setSemester(1)
      setSidebarOpen(false)
      setNavKey((value) => value + 1)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const pageTitle = slug === 'pseudocode-check' ? 'Code Checker' : pages[slug].title
    document.title = `${pageTitle} | Materi Kuliah Informatika PJJ Telkom`
  }, [slug])

  function goTo(path) {
    if (toHref(path) === window.location.pathname + window.location.search + window.location.hash) return
    navigate(path)
    setSlug(getSlug())
    setSemester(1)
    setSidebarOpen(false)
    setNavKey((value) => value + 1)
  }

  const judul = slug === 'home' ? 'Materi Kuliah Informatika PJJ' : slug === 'pseudocode-check' ? 'Code Checker' : pages[slug].title
  const badge = slug === 'home' ? '7 Mata Kuliah' : slug === 'pseudocode-check' ? 'Aplikasi' : `Semester ${semester}`

  return (
    <>
      <aside className={`sidebar${sidebarOpen ? ' terbuka' : ''}`} id="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">IP</div>
          <div>
            <h1>Informatika PJJ</h1>
            <span>TELKOM UNIVERSITY</span>
          </div>
        </div>
        <div className="sidebar-section">Menu Utama</div>
        <ul className="sidebar-nav">
          <li>
            <a
              href={toHref('/')}
              className={slug === 'home' ? 'aktif' : ''}
              onClick={(event) => {
                event.preventDefault()
                goTo('/')
              }}
            >
              <span className="ikon">🏠</span> Beranda
            </a>
          </li>
        </ul>
        <div className="sidebar-section">Mata Kuliah</div>
        <ul className="sidebar-nav">
          {MATA_KULIAH.map((item) => (
            <NavItem key={item.slug} item={item} slug={slug} onNavigate={goTo} />
          ))}
        </ul>
        <div className="sidebar-section">Aplikasi</div>
        <ul className="sidebar-nav">
          {APLIKASI.map((item) => (
            <NavItem key={item.slug} item={item} slug={slug} onNavigate={goTo} />
          ))}
        </ul>
        <div className="sidebar-footer">
          Platform materi kuliah<br />
          Program Pendidikan Jarak Jauh<br />
          Semester 1 &ndash; 8
        </div>
      </aside>

      <div className={`overlay${sidebarOpen ? ' tampil' : ''}`} id="overlay" onClick={() => setSidebarOpen(false)} />

      <div className="konten">
        <header className="topbar">
          <button className="hamburger" id="hamburger" aria-label="Buka menu" onClick={() => setSidebarOpen((open) => !open)}>
            ☰
          </button>
          <div className="topbar-judul">{judul}</div>
          <div className="topbar-kanan">
            <span className="badge-semester" id="badge-semester">{badge}</span>
            <span>Telkom University</span>
          </div>
        </header>

        <nav className="breadcrumb">
          {slug === 'home' ? (
            <span>Beranda</span>
          ) : (
            <>
              <a href={toHref('/')} onClick={(event) => { event.preventDefault(); goTo('/') }}>Beranda</a> / <span>{judul}</span>
            </>
          )}
        </nav>

        <main className="utama">
          {slug === 'pseudocode-check' ? (
            <div className="code-checker"><CodeChecker /></div>
          ) : (
            <HtmlContent
              key={`${slug}-${navKey}`}
              html={pages[slug].html}
              onTabChange={(id) => setSemester(Number(id.replace('sem', '')))}
            />
          )}
        </main>

        <footer className="footer">
          <div>
            &copy; <span id="tahun">{new Date().getFullYear()}</span> <strong>Materi Kuliah Informatika PJJ</strong> &mdash; Telkom University
          </div>
          <div>Pendidikan Jarak Jauh &middot; Semester 1&ndash;8</div>
        </footer>
      </div>
    </>
  )
}
