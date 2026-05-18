import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Home, Lock, Mail, User, Calendar, Phone, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { authApi } from '../services/api'
import logo from '../assets/logo-small.png'

const registerHeroImage = 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=80'

export default function RegisterPage() {
  const { user, loading, readerSignup } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [hoTen, setHoTen] = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ngaySinh, setNgaySinh] = useState('')
  const [soDienThoai, setSoDienThoai] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agree, setAgree] = useState(false)
  const [otp, setOtp] = useState('')
  const [showOtp, setShowOtp] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    let timer
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [countdown])

  if (user) return <Navigate to="/" replace />

  const handleSendOtp = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      toast.error('Email không hợp lệ để gửi mã')
      return
    }
    setIsSending(true)
    try {
      await authApi.sendOtp({ email: email.trim() })
      toast.success('Đã gửi mã xác thực đến email của bạn')
      setShowOtp(true)
      setCountdown(60)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Lỗi khi gửi mã xác thực')
    } finally {
      setIsSending(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      toast.error('Email không hợp lệ')
      return
    }
    const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/
    if (!phoneRegex.test(soDienThoai.trim())) {
      toast.error('Số điện thoại không hợp lệ')
      return
    }
    if (matKhau.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }
    if (matKhau !== confirm) {
      toast.error('Mật khẩu xác nhận chưa khớp')
      return
    }
    if (!agree) {
      toast.error('Bạn cần đồng ý điều khoản trước khi đăng ký')
      return
    }
    if (!otp.trim()) {
      toast.error('Vui lòng nhập mã xác thực OTP')
      return
    }

    const ok = await readerSignup({
      ho_ten: hoTen.trim(),
      email: email.trim(),
      mat_khau: matKhau,
      ngay_sinh: ngaySinh || undefined,
      so_dien_thoai: soDienThoai.trim() || undefined,
      otp: otp.trim(),
    })
    if (ok) navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f3f6f8] text-[#263238] lg:grid lg:grid-cols-2">
      <Link
        to="/login"
        className="absolute left-3 top-3 z-10 text-[#4f8c8a] transition hover:text-[#2f6f6d]"
        aria-label="Về trang đăng nhập"
      >
        <Home size={18} fill="currentColor" />
      </Link>

      <section className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-6 flex flex-col items-center sm:items-start">
            <img src={logo} alt="Logo" className="w-16 h-16 object-contain mb-4" />
            <h1 className="text-2xl font-semibold tracking-normal text-[#1f2f35]">Đăng ký tài khoản Thư Viện</h1>
            <p className="mt-2 max-w-[330px] text-xs leading-5 text-[#7a8a91]">
              Tạo tài khoản độc giả để tra cứu tài liệu, đặt trước sách và theo dõi lịch sử mượn.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#52656b]">Họ và tên</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9bb0b6]" />
                <input
                  className="h-12 w-full rounded border border-[#dce8ea] bg-white px-9 text-sm shadow-sm outline-none transition focus:border-[#6aa8a6] focus:ring-2 focus:ring-[#7dbdbb]/25"
                  placeholder="Nhập họ và tên"
                  value={hoTen}
                  onChange={e => setHoTen(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#52656b]">Email</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9bb0b6]" />
                  <input
                    className="h-12 w-full rounded border border-[#dce8ea] bg-white px-9 text-sm shadow-sm outline-none transition focus:border-[#6aa8a6] focus:ring-2 focus:ring-[#7dbdbb]/25 disabled:bg-gray-50"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={showOtp}
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSending || countdown > 0 || !email}
                  className="h-12 shrink-0 rounded bg-[#5aa3a1] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#438f8d] disabled:opacity-60"
                >
                  {isSending ? 'Đang gửi...' : countdown > 0 ? `Gửi lại (${countdown}s)` : 'Gửi mã OTP'}
                </button>
              </div>
            </div>

            {showOtp && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#52656b]">Mã xác thực (OTP)</label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9bb0b6]" />
                  <input
                    className="h-12 w-full rounded border border-[#dce8ea] bg-white px-9 text-sm shadow-sm outline-none transition focus:border-[#6aa8a6] focus:ring-2 focus:ring-[#7dbdbb]/25"
                    type="text"
                    placeholder="Nhập mã 6 chữ số gửi về email"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#52656b]">Ngày sinh</label>
              <div className="relative">
                <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9bb0b6]" />
                <input
                  className="h-12 w-full rounded border border-[#dce8ea] bg-white px-9 text-sm shadow-sm outline-none transition focus:border-[#6aa8a6] focus:ring-2 focus:ring-[#7dbdbb]/25"
                  type="date"
                  value={ngaySinh}
                  onChange={e => setNgaySinh(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#52656b]">Số điện thoại</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9bb0b6]" />
                <input
                  className="h-12 w-full rounded border border-[#dce8ea] bg-white px-9 text-sm shadow-sm outline-none transition focus:border-[#6aa8a6] focus:ring-2 focus:ring-[#7dbdbb]/25"
                  type="tel"
                  placeholder="Nhập số điện thoại"
                  value={soDienThoai}
                  onChange={e => setSoDienThoai(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#52656b]">Mật khẩu</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9bb0b6]" />
                <input
                  className="h-12 w-full rounded border border-[#dce8ea] bg-white px-9 pr-10 text-sm shadow-sm outline-none transition focus:border-[#6aa8a6] focus:ring-2 focus:ring-[#7dbdbb]/25"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  value={matKhau}
                  onChange={e => setMatKhau(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#82979d]"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#52656b]">Xác nhận mật khẩu</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9bb0b6]" />
                <input
                  className="h-12 w-full rounded border border-[#dce8ea] bg-white px-9 text-sm shadow-sm outline-none transition focus:border-[#6aa8a6] focus:ring-2 focus:ring-[#7dbdbb]/25"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập lại mật khẩu"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 text-xs text-[#75878d]">
              <label className="flex items-center gap-2 text-right">
                <input type="checkbox" className="h-4 w-4 shrink-0 accent-[#5aa3a1]" checked={agree} onChange={e => setAgree(e.target.checked)} />
                <span>Tôi đồng ý với <span className="text-[#2f7f7d]">điều khoản sử dụng</span></span>
              </label>
            </div>

            <div className="pt-1 text-center text-xs text-[#7a8a91]">
              Đã có tài khoản?{' '}
              <Link className="font-medium text-[#2f7f7d] underline-offset-2 hover:underline" to="/login">
                Đăng nhập
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded bg-[#5aa3a1] text-sm font-semibold text-white shadow-sm transition hover:bg-[#438f8d] disabled:opacity-60"
            >
              {loading ? 'Đang xử lý...' : 'Đăng ký'}
            </button>
          </form>
        </div>
      </section>

      <section className="hidden min-h-screen bg-[#6aa8a6] lg:block">
        <img
          src={registerHeroImage}
          alt="Kệ sách trong thư viện"
          className="h-screen w-full object-cover"
        />
      </section>
    </div>
  )
}
