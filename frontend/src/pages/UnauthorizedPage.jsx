import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function UnauthorizedPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [navigate, user])

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-5xl font-bold text-red-600">
            X
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Truy cập bị từ chối</h2>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <p className="text-gray-600 mb-6">
            Phiên đăng nhập không hợp lệ hoặc bạn chưa đăng nhập vào hệ thống quản lý thư viện.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-semibold text-gray-800 mb-2">Cách xử lý</p>
            <p className="text-sm text-gray-700">
              Vui lòng quay lại trang đăng nhập và sử dụng tài khoản được quản trị viên cấp.
              Thông tin đăng nhập nội bộ sẽ không được hiển thị công khai trên giao diện.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
            <p className="text-sm text-gray-700">
              Nếu bạn là nhân viên thư viện nhưng vẫn không truy cập được, hãy liên hệ quản trị viên để kiểm tra quyền tài khoản.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
        >
          Đăng nhập
        </button>
      </div>
    </div>
  )
}
