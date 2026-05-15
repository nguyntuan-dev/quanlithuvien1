import axios from 'axios'
import toast from 'react-hot-toast'

// ── Axios instance ───────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api', 
})

// Request interceptor: thêm token
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Response interceptor: toast lỗi, xử lý 401
api.interceptors.response.use(
  r => r,
  err => {
    const msg = err.response?.data?.detail || 'Đã xảy ra lỗi'
    const authPaths = ['/auth/dang-nhap', '/auth/doc-gia/dang-nhap', '/auth/doc-gia/dang-ky', '/auth/doc-gia/send-otp']
    const isAuthRequest = authPaths.some(path => err.config?.url?.includes(path))
    if (!isAuthRequest) toast.error(msg)
    if (err.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Helper API functions ───────────────────────────────────────────────

// Tài liệu
export const taiLieuApi = {
  list: (p) => api.get('/tai-lieu/', { params: p }),
  get: (ma) => api.get(`/tai-lieu/${ma}`),
  create: (d) => api.post('/tai-lieu/', d),
  update: (ma, d) => api.put(`/tai-lieu/${ma}`, d),
  delete: (ma) => api.delete(`/tai-lieu/${ma}`),
  theLoai: () => api.get('/tai-lieu/meta/the-loai'),
  tacGia: () => api.get('/tai-lieu/meta/tac-gia'),
  nxb: () => api.get('/tai-lieu/meta/nha-xuat-ban'),
}

// Độc giả
export const docGiaApi = {
  list: (p) => api.get('/doc-gia/', { params: p }),
  get: (ma) => api.get(`/doc-gia/${ma}`),
  create: (d) => api.post('/doc-gia/', d),
  update: (ma, d) => api.put(`/doc-gia/${ma}`, d),
  delete: (ma) => api.delete(`/doc-gia/${ma}`),
}

// Mượn-trả
export const muonTraApi = {
  list: (p) => api.get('/muon-tra/', { params: p }),
  get: (ma) => api.get(`/muon-tra/${ma}`),
  create: (d) => api.post('/muon-tra/', d),
  traSach: (d) => api.post('/muon-tra/tra-sach', d),
  yeuCauTra: (ma) => api.put(`/muon-tra/${ma}/yeu-cau-tra`),
  giaHan: (ma) => api.put(`/muon-tra/${ma}/gia-han`),
  lichSu: (maDocGia) => api.get(`/muon-tra/lich-su/${maDocGia}`),
  quaHan: () => api.get('/muon-tra/qua-han/danh-sach'),
  getReservation: (ma) => api.get(`/muon-tra/dat-truoc/${ma}`),
}

// Đặt trước
export const datTruocApi = {
  list: (p) => api.get('/dat-truoc/', { params: p }),
  create: (d) => api.post('/dat-truoc/', d),
  duyet: (ma) => api.put(`/dat-truoc/${ma}/duyet`),
  huy: (ma) => api.put(`/dat-truoc/${ma}/huy`),
}

// Vi phạm (đã fix URL)
export const viPhamApi = {
  list: (p) => api.get('/vi-pham/vi-pham/', { params: p }),
  create: (d) => api.post('/vi-pham/vi-pham/', d),
  thanhToan: (ma) => api.put(`/vi-pham/vi-pham/${ma}/thanh-toan`),
}

// Nhân viên
export const nhanVienApi = {
  list: () => api.get('/nhan-vien/'),
  create: (d) => api.post('/nhan-vien/', d),
  delete: (ma) => api.delete(`/nhan-vien/${ma}`),
}

// Thống kê
export const thongKeApi = {
  tongQuan: () => api.get('/thong-ke/tong-quan'),
  muonTheoThang: () => api.get('/thong-ke/muon-theo-thang'),
  topTaiLieu: () => api.get('/thong-ke/top-tai-lieu'),
}

// Auth
export const authApi = {
  login: (d) => api.post('/auth/dang-nhap', d),
  signup: (d) => api.post('/auth/tao-tai-khoan', d),
  readerLogin: (d) => api.post('/auth/doc-gia/dang-nhap', d),
  readerSignup: (d) => api.post('/auth/doc-gia/dang-ky', d),
  changePassword: (d) => api.post('/auth/doi-mat-khau', d),
  changeMyPassword: (d) => api.post('/auth/ca-nhan/doi-mat-khau', d),
  updateMyReaderProfile: (d) => api.put('/auth/ca-nhan/doc-gia', d),
  updateMyStaffProfile: (d) => api.put('/auth/ca-nhan/nhan-vien', d),
  sendOtp: (d) => api.post('/auth/doc-gia/send-otp', d),
}

// Hệ thống
export const heThongApi = {
  cauHinh: () => api.get('/he-thong/cau-hinh'),
  updateCauHinh: (khoa, d) => api.put(`/he-thong/cau-hinh/${khoa}`, d),
  auditLog: (p) => api.get('/he-thong/audit-log', { params: p }),
  backup: () => api.get('/he-thong/backup'),
  restore: (d) => api.post('/he-thong/restore', d),
}

// Yêu thích
export const yeuThichApi = {
  list: () => api.get('/yeu-thich/'),
  add: (ma) => api.post('/yeu-thich/', { ma_tai_lieu: ma }),
  remove: (ma) => api.delete(`/yeu-thich/${ma}`),
}

export default api