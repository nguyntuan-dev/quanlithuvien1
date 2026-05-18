import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import { Spinner } from './components/UI'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CatalogPage = lazy(() => import('./pages/CatalogPage'))
const TaiLieuPage = lazy(() => import('./pages/TaiLieuPage'))
const DocGiaPage = lazy(() => import('./pages/DocGiaPage'))
const MuonTraPage = lazy(() => import('./pages/MuonTraPage'))
const DatTruocPage = lazy(() => import('./pages/DatTruocPage'))
const ViPhamPage = lazy(() => import('./pages/ViPhamPage'))
const NhanVienPage = lazy(() => import('./pages/NhanVienPage'))
const ThongKePage = lazy(() => import('./pages/ThongKePage'))
const LichSuPage = lazy(() => import('./pages/LichSuPage'))
const HeThongPage = lazy(() => import('./pages/HeThongPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const FavoritePage = lazy(() => import('./pages/FavoritePage'))
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return user.la_admin ? children : <Navigate to="/unauthorized" replace />
}

function StaffRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return user.vai_tro === 'doc_gia' ? <Navigate to="/unauthorized" replace /> : children
}

function HomeRoute() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return user.vai_tro === 'doc_gia' ? <Navigate to="/tra-cuu" replace /> : <DashboardPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<HomeRoute />} />
            <Route path="tra-cuu"   element={<CatalogPage />} />
            <Route path="tai-lieu"  element={<StaffRoute><TaiLieuPage /></StaffRoute>} />
            <Route path="doc-gia"   element={<StaffRoute><DocGiaPage /></StaffRoute>} />
            <Route path="muon-tra"  element={<StaffRoute><MuonTraPage /></StaffRoute>} />
            <Route path="dat-truoc" element={<StaffRoute><DatTruocPage /></StaffRoute>} />
            <Route path="vi-pham"   element={<StaffRoute><ViPhamPage /></StaffRoute>} />
            <Route path="nhan-vien" element={<AdminRoute><NhanVienPage /></AdminRoute>} />
            <Route path="lich-su"   element={<LichSuPage />} />
            <Route path="profile"   element={<ProfilePage />} />
            <Route path="yeu-thich" element={<FavoritePage />} />
            <Route path="thong-ke"  element={<StaffRoute><ThongKePage /></StaffRoute>} />
            <Route path="he-thong"  element={<AdminRoute><HeThongPage /></AdminRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
