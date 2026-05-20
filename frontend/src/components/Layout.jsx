import { useState } from 'react'
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard, BookOpen, Users, BookMarked, Clock, AlertTriangle,
  BarChart2, UserCheck, LogOut, Search, History, Settings, Heart, Menu, X
} from 'lucide-react'
import logo from '../assets/logo-small.png'

const NAV = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, exact: true, staffOnly: true },
  { to: '/tra-cuu', label: 'Tra cứu sách', icon: Search },
  { to: '/tai-lieu', label: 'Tài liệu', icon: BookOpen, staffOnly: true },
  { to: '/doc-gia', label: 'Độc giả', icon: Users, staffOnly: true },
  { to: '/muon-tra', label: 'Mượn / Trả', icon: BookMarked, staffOnly: true },
  { to: '/dat-truoc', label: 'Đặt trước', icon: Clock, staffOnly: true },
  { to: '/vi-pham', label: 'Vi phạm & Phạt', icon: AlertTriangle, staffOnly: true },
  { to: '/lich-su', label: 'Lịch sử mượn', readerLabel: 'Sách của tôi', icon: History },
  { to: '/thong-ke', label: 'Thống kê', icon: BarChart2, staffOnly: true },
  { to: '/nhan-vien', label: 'Nhân viên', icon: UserCheck, adminOnly: true },
  { to: '/he-thong', label: 'Hệ thống', icon: Settings, adminOnly: true },
  { to: '/profile', label: 'Hồ sơ', icon: Users },
  { to: '/yeu-thich', label: 'Yêu thích', icon: Heart, readerOnly: true },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const isReader = user?.vai_tro === 'doc_gia'
  const visibleNav = NAV.filter(item => {
    if (item.adminOnly) return user?.la_admin
    if (item.staffOnly) return !isReader
    if (item.readerOnly) return isReader
    return true
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const closeNav = () => setNavOpen(false)

  if (isReader) {
    return (
      <div className="min-h-screen bg-[#f7f7f4] text-[#1f1f1f]">
        <header className="sticky top-0 z-30 border-b border-[#ece8dc] bg-white/95 backdrop-blur">
          <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
            <Link to="/tra-cuu" className="flex items-center gap-2 text-sm font-bold tracking-wide text-[#171717]">
              <img src={logo} alt="Logo" className="w-6 h-6 object-contain" />
              Thư Viện
            </Link>
            <nav className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto text-[11px] font-semibold uppercase tracking-wide text-[#777166]">
              <NavLink to="/tra-cuu" className={({ isActive }) => `px-3 py-2 transition ${isActive ? 'bg-[#d8c981] text-white' : 'hover:text-[#1f1f1f]'}`}>
                Sách
              </NavLink>
              <NavLink to="/lich-su" className={({ isActive }) => `px-3 py-2 transition ${isActive ? 'bg-[#d8c981] text-white' : 'hover:text-[#1f1f1f]'}`}>
                Sách của tôi
              </NavLink>
              <NavLink to="/yeu-thich" className={({ isActive }) => `px-3 py-2 transition ${isActive ? 'bg-[#d8c981] text-white' : 'hover:text-[#1f1f1f]'}`}>
                Yêu thích
              </NavLink>
              <Link to="/profile" className="hidden px-3 py-2 text-[#aaa49a] sm:inline hover:text-[#1f1f1f] transition-colors">{user?.ho_ten}</Link>
              <button type="button" onClick={handleLogout} className="px-3 py-2 uppercase transition hover:text-[#1f1f1f]">
                Đăng xuất
              </button>
            </nav>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-soft lg:flex lg:h-screen lg:overflow-hidden">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <img src={logo} alt="Logo" className="h-8 w-8 rounded-lg object-contain" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-none">Thu Vien</div>
            <div className="mt-0.5 truncate text-[10px] text-ink-faint">Quan ly thu vien</div>
          </div>
        </Link>
        <button type="button" className="btn btn-ghost p-2" onClick={() => setNavOpen(true)} aria-label="Mo menu">
          <Menu size={18} />
        </button>
      </header>

      {navOpen && (
        <button type="button" className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={closeNav} aria-label="Dong menu" />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-border bg-surface transition-transform lg:static lg:z-auto lg:w-56 lg:max-w-none lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border shrink-0">
          <img src={logo} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-none">Thư Viện</div>
            <div className="text-[10px] text-ink-faint mt-0.5">Quản lý thư viện</div>
          </div>
          <button type="button" className="btn btn-ghost p-1.5 lg:hidden" onClick={closeNav} aria-label="Dong menu">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visibleNav.map(({ to, label, readerLabel, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => 'sidebar-link ' + (isActive ? 'active' : '')}
              onClick={closeNav}
            >
              <Icon size={16} strokeWidth={1.8} />
              {isReader && readerLabel ? readerLabel : label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center text-sm font-semibold">
              {user?.ho_ten?.[0] || 'A'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{user?.ho_ten}</div>
              <div className="text-[10px] text-ink-faint truncate">{user?.chuc_vu || (isReader ? 'Độc giả' : 'Người dùng')}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost w-full justify-start text-xs text-ink-muted">
            <LogOut size={13} /> Đăng xuất
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 lg:overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
