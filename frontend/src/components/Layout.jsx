import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard, BookOpen, Users, BookMarked, Clock, AlertTriangle,
  BarChart2, UserCheck, LogOut, Search, History, Settings, Heart
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

  if (isReader) {
    return (
      <div className="min-h-screen bg-[#f7f7f4] text-[#1f1f1f]">
        <header className="sticky top-0 z-30 border-b border-[#ece8dc] bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
            <Link to="/tra-cuu" className="flex items-center gap-2 text-sm font-bold tracking-wide text-[#171717]">
              <img src={logo} alt="Logo" className="w-6 h-6 object-contain" />
              Thư Viện
            </Link>
            <nav className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#777166]">
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
    <div className="flex h-screen overflow-hidden bg-surface-soft">
      <aside className="w-56 flex flex-col bg-surface border-r border-border shrink-0">
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border shrink-0">
          <img src={logo} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          <div>
            <div className="text-sm font-semibold leading-none">Thư Viện</div>
            <div className="text-[10px] text-ink-faint mt-0.5">Quản lý thư viện</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visibleNav.map(({ to, label, readerLabel, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => 'sidebar-link ' + (isActive ? 'active' : '')}
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

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
