import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { muonTraApi, viPhamApi, datTruocApi } from '../services/api'
import { PageHeader, Field, Input, Badge, Spinner, Empty, Modal } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { AlertCircle, CheckCircle, Copy, ExternalLink, QrCode, RotateCcw, Search, Undo2, X } from 'lucide-react'

const ACTIVE_STATUSES = new Set(['DANG_MUON', 'QUA_HAN'])

const STATUS_META = {
  DANG_MUON: { label: 'Đang mượn', variant: 'blue' },
  CHO_TRA:   { label: 'Chờ duyệt trả', variant: 'yellow' },
  DA_TRA:    { label: 'Đã trả', variant: 'green' },
  QUA_HAN:   { label: 'Quá hạn', variant: 'red' },
}

const PAYMENT_META = {
  DA_THANH_TOAN: { label: 'Đã nộp', variant: 'green' },
  CHUA_THANH_TOAN: { label: 'Chưa nộp', variant: 'red' },
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('vi-VN')
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

function normalizeVietnamese(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function formatFineReason(reason) {
  const normalized = normalizeVietnamese(reason)
  if (normalized.includes('mat sach') && normalized.includes('tinh theo gia sach')) {
    return 'Mất sách - tính theo giá sách'
  }
  if (
    (normalized.includes('sach rach') || normalized.includes('sach hong') || normalized.includes('rach/hong')) &&
    normalized.includes('tinh theo gia sach')
  ) {
    return 'Sách rách/hỏng - tính theo giá sách'
  }
  if (normalized.startsWith('qua han tra sach')) {
    return reason
      .replace(/Qua han tra sach/i, 'Quá hạn trả sách')
      .replace(/ ngay\)/i, ' ngày)')
  }
  return reason || '-'
}

function statusBadge(status) {
  const meta = STATUS_META[status] || { label: status || '-', variant: 'gray' }
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

function readerName(pm) {
  const name = pm.doc_gia?.ho_ten || 'Không rõ'
  const code = pm.doc_gia?.ma_doc_gia || pm.ma_doc_gia
  return code ? `${name} (${code})` : name
}

export default function LichSuPage() {
  const { user } = useAuth()
  const isReader = user?.vai_tro === 'doc_gia'
  const readerCode = user?.ma_doc_gia || ''
  const [maDocGia, setMaDocGia] = useState(isReader ? readerCode : '')
  const [items, setItems] = useState([])
  const [violations, setViolations] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [qrModal, setQrModal] = useState(false)
  const [qrInfo, setQrInfo] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrChecking, setQrChecking] = useState(false)

  const activeLoans = useMemo(
    () => items.filter(pm => ACTIVE_STATUSES.has(pm.trang_thai)).length,
    [items]
  )

  const load = async (ma = maDocGia) => {
    const code = isReader ? readerCode : ma?.trim()

    if (isReader && !code) {
      toast.error('Không tìm thấy mã độc giả')
      return
    }

    const historyRequest = isReader
      ? muonTraApi.lichSu(code)
      : muonTraApi.list(code ? { ma_doc_gia: code, limit: 500 } : { limit: 500 })

    const violationRequest = viPhamApi.list(code ? { ma_doc_gia: code } : undefined)
    const reservationRequest = datTruocApi.list(code ? { ma_doc_gia: code } : undefined)

    setLoading(true)
    try {
      const [historyRes, viPhamRes, reservationRes] = await Promise.allSettled([
        historyRequest,
        violationRequest,
        reservationRequest,
      ])

      if (historyRes.status === 'fulfilled') {
        setItems(historyRes.value.data || [])
      } else {
        setItems([])
        toast.error('Không tải được lịch sử mượn')
      }

      if (viPhamRes.status === 'fulfilled') {
        setViolations(viPhamRes.value.data || [])
      } else {
        setViolations([])
        toast.error('Không tải được tình trạng vi phạm')
      }

      if (reservationRes.status === 'fulfilled') {
        setReservations(reservationRes.value.data || [])
      } else {
        setReservations([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isReader && readerCode) {
      setMaDocGia(readerCode)
      load(readerCode)
      return
    }

    if (!isReader) {
      load('')
    }
  }, [isReader, readerCode])

  const clearFilter = () => {
    setMaDocGia('')
    load('')
  }

  const extendLoan = async (pm) => {
    setBusyId(pm.ma_phieu_muon)
    try {
      await muonTraApi.giaHan(pm.ma_phieu_muon)
      toast.success('Gia hạn thành công')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const returnLoan = async (pm) => {
    setBusyId(pm.ma_phieu_muon)
    try {
      if (isReader) {
        await muonTraApi.yeuCauTra(pm.ma_phieu_muon)
        toast.success('Đã gửi yêu cầu trả sách, chờ thủ thư duyệt')
      } else {
        await muonTraApi.traSach({
          ma_phieu_muon: pm.ma_phieu_muon,
          tinh_trang_tra: 'Tốt',
        })
        toast.success('Trả sách thành công')
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const cancelReservation = async (ma) => {
    try {
      await datTruocApi.huy(ma)
      toast.success('Đã hủy đặt trước')
      await load()
    } catch (err) {}
  }

  const openVietQR = async (ma) => {
    setQrModal(true)
    setQrInfo(null)
    setQrLoading(true)
    setQrChecking(false)
    try {
      const { data } = await viPhamApi.vietqr(ma)
      setQrInfo(data)
    } finally {
      setQrLoading(false)
    }
  }

  const copyPaymentContent = async () => {
    if (!qrInfo?.noi_dung) return
    await navigator.clipboard.writeText(qrInfo.noi_dung)
    toast.success('Đã sao chép nội dung chuyển khoản')
  }

  const openCheckout = () => {
    if (qrInfo?.checkout_url) {
      window.open(qrInfo.checkout_url, '_blank', 'noopener,noreferrer')
    }
  }

  useEffect(() => {
    if (!qrModal || !qrInfo?.ma_phat) return undefined

    let stopped = false
    const checkPayment = async () => {
      setQrChecking(true)
      try {
        const { data } = await viPhamApi.thanhToanStatus(qrInfo.ma_phat)
        if (!stopped && data.trang_thai_thanh_toan?.toUpperCase() === 'DA_THANH_TOAN') {
          toast.success('Hệ thống đã tự động xác nhận thanh toán')
          setQrModal(false)
          setQrInfo(null)
          await load()
        }
      } catch (err) {
        // Polling is best effort; the global interceptor reports real API errors.
      } finally {
        if (!stopped) setQrChecking(false)
      }
    }

    checkPayment()
    const timer = window.setInterval(checkPayment, 5000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [qrModal, qrInfo?.ma_phat])

  const getReservationBadge = (status) => {
    switch (status) {
      case 'cho_xu_ly':   return <Badge variant="yellow">Chờ duyệt</Badge>
      case 'da_duyet':    return <Badge variant="green">Đã duyệt</Badge>
      case 'da_huy':      return <Badge variant="red">Đã hủy</Badge>
      case 'da_nhan_sach': return <Badge variant="blue">Đã nhận sách</Badge>
      default:            return <Badge>{status}</Badge>
    }
  }

  const loanTableColSpan = isReader ? 6 : 7

  return (
    <div>
      <PageHeader
        title={isReader ? 'Sách của tôi' : 'Lịch sử mượn'}
        subtitle={isReader ? 'Theo dõi sách đã mượn, gia hạn hoặc trả sách' : 'Theo dõi toàn bộ độc giả đã mượn sách'}
      />

      <div className="px-6 space-y-6 pb-10">
        {!isReader && (
          <div className="card p-4">
            <Field label="Lọc theo mã độc giả">
              <div className="flex flex-wrap gap-2">
                <Input
                  value={maDocGia}
                  onChange={e => setMaDocGia(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && load()}
                  placeholder="Để trống để xem tất cả, VD: DG000001"
                />
                <button className="btn btn-primary" onClick={() => load()} disabled={loading}>
                  <Search size={16} />
                  Lọc
                </button>
                {maDocGia && (
                  <button className="btn btn-secondary" onClick={clearFilter} disabled={loading}>
                    <X size={16} />
                    Tất cả
                  </button>
                )}
              </div>
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="text-xs font-medium text-ink-muted">Tổng lượt mượn</div>
            <div className="text-2xl font-semibold mt-1">{items.length}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium text-ink-muted">Đang mượn / quá hạn</div>
            <div className="text-2xl font-semibold mt-1">{activeLoans}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium text-ink-muted">Vi phạm chưa nộp</div>
            <div className="text-2xl font-semibold mt-1">
              {violations.filter(vp => vp.trang_thai_thanh_toan?.toUpperCase() !== 'DA_THANH_TOAN').length}
            </div>
          </div>
        </div>

        <div className="card p-6 border-l-4 border-danger bg-danger/5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="text-danger" size={20} />
            <h2 className="text-lg font-semibold">Tình trạng vi phạm</h2>
          </div>

          {loading ? <Spinner /> : violations.length === 0 ? (
            <p className="text-sm text-ink-muted">Hiện không có vi phạm nào.</p>
          ) : (
            <div className="space-y-3">
              {violations.map(vp => {
                const payment = PAYMENT_META[vp.trang_thai_thanh_toan?.toUpperCase()] || { label: vp.trang_thai_thanh_toan, variant: 'gray' }
                const unpaid = vp.trang_thai_thanh_toan?.toUpperCase() !== 'DA_THANH_TOAN'
                return (
                  <div key={vp.ma_phat} className="flex items-center justify-between gap-4 p-3 bg-surface rounded-lg border border-danger/20 shadow-sm">
                    <div>
                      <div className="font-medium text-danger">{formatFineReason(vp.ly_do_phat)}</div>
                      <div className="text-xs text-ink-muted">
                        {!isReader && `${readerName(vp.phieu_muon)} - `}
                        Ngày: {formatDate(vp.ngay_phat)} - Mã: {vp.ma_phat}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-danger">{formatMoney(vp.so_tien)}</div>
                      <Badge variant={payment.variant}>{payment.label}</Badge>
                      {isReader && unpaid && (
                        <button className="btn btn-primary py-1 px-3 text-xs mt-2" onClick={() => openVietQR(vp.ma_phat)}>
                          <QrCode size={12} /> VietQR
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {reservations.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Sách đang đặt trước</h2>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-soft border-b border-border">
                    <tr>
                      <th className="th">Mã</th>
                      <th className="th">Tài liệu</th>
                      <th className="th">Ngày đặt</th>
                      <th className="th">Trạng thái</th>
                      <th className="th">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map(dt => (
                      <tr key={dt.ma_dat_truoc} className="table-row">
                        <td className="td font-mono text-xs">{dt.ma_dat_truoc}</td>
                        <td className="td">{dt.tai_lieu?.ten_tai_lieu}</td>
                        <td className="td">{formatDate(dt.ngay_dat)}</td>
                        <td className="td">{getReservationBadge(dt.trang_thai)}</td>
                        <td className="td">
                          {dt.trang_thai === 'cho_xu_ly' && (
                            <button className="btn btn-ghost py-1 px-2 text-xs text-danger" onClick={() => cancelReservation(dt.ma_dat_truoc)}>
                              Hủy đặt
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold mb-3">Lịch sử mượn sách</h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-soft border-b border-border">
                  <tr>
                    <th className="th">Phiếu</th>
                    {!isReader && <th className="th">Độc giả</th>}
                    <th className="th">Ngày mượn</th>
                    <th className="th">Hạn trả</th>
                    <th className="th">Sách</th>
                    <th className="th">Trạng thái</th>
                    <th className="th">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={loanTableColSpan}><Spinner /></td></tr>
                    : items.length === 0 ? <tr><td colSpan={loanTableColSpan}><Empty message="Chưa có lịch sử mượn" /></td></tr>
                    : items.map(pm => {
                      const canAct = ACTIVE_STATUSES.has(pm.trang_thai)
                      const busy = busyId === pm.ma_phieu_muon
                      const bookNames = pm.chi_tiet
                        ?.map(ct => ct.tai_lieu?.ten_tai_lieu || ct.ma_tai_lieu)
                        .filter(Boolean)
                        .join(', ')

                      return (
                        <tr key={pm.ma_phieu_muon} className="table-row">
                          <td className="td font-mono text-xs">{pm.ma_phieu_muon}</td>
                          {!isReader && <td className="td min-w-[180px]">{readerName(pm)}</td>}
                          <td className="td">{formatDate(pm.ngay_muon)}</td>
                          <td className="td">{formatDate(pm.han_tra)}</td>
                          <td className="td min-w-[220px]">{bookNames || '-'}</td>
                          <td className="td">{statusBadge(pm.trang_thai)}</td>
                          <td className="td">
                            {canAct ? (
                              <div className="flex flex-wrap gap-2">
                                <button className="btn btn-secondary py-1 px-3 text-xs" disabled={busy} onClick={() => extendLoan(pm)}>
                                  <RotateCcw size={12} /> Gia hạn
                                </button>
                                <button className="btn btn-primary py-1 px-3 text-xs" disabled={busy} onClick={() => returnLoan(pm)}>
                                  <Undo2 size={12} /> {isReader ? 'Yêu cầu trả' : 'Trả sách'}
                                </button>
                              </div>
                            ) : pm.trang_thai === 'CHO_TRA' ? (
                              <span className="text-xs text-warning font-medium">Đang chờ thủ thư duyệt</span>
                            ) : (
                              <span className="text-xs text-ink-faint">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={qrModal}
        onClose={() => setQrModal(false)}
        title={qrInfo?.provider === 'payos' ? 'Thanh toán tiền phạt bằng PayOS' : 'Thanh toán tiền phạt bằng VietQR'}
        size="md"
      >
        {qrLoading ? <Spinner /> : qrInfo && (
          <div className="grid gap-5 md:grid-cols-[220px_1fr] items-start">
            <div className="rounded-xl border border-border bg-white p-3">
              <img src={qrInfo.qr_url} alt="VietQR thanh toán tiền phạt" className="w-full aspect-square object-contain" />
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-ink-muted">Số tiền</div>
                <div className="text-2xl font-semibold text-danger">
                  {Number(qrInfo.so_tien).toLocaleString('vi-VN')}đ
                </div>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-y-2">
                <span className="text-ink-muted">Cổng</span>
                <span className="font-medium">{qrInfo.provider === 'payos' ? 'PayOS' : 'VietQR'}</span>
                <span className="text-ink-muted">Ngân hàng</span>
                <span className="font-medium">{qrInfo.ngan_hang}</span>
                <span className="text-ink-muted">Số tài khoản</span>
                <span className="font-mono">{qrInfo.so_tai_khoan}</span>
                <span className="text-ink-muted">Chủ tài khoản</span>
                <span className="font-medium">{qrInfo.ten_tai_khoan}</span>
                <span className="text-ink-muted">Nội dung</span>
                <span className="font-mono">{qrInfo.noi_dung}</span>
                {qrInfo.order_code && (
                  <>
                    <span className="text-ink-muted">Order code</span>
                    <span className="font-mono">{qrInfo.order_code}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                {qrChecking ? <Spinner /> : <CheckCircle size={14} />}
                <span>Đang tự động kiểm tra thanh toán</span>
              </div>
              <button className="btn btn-secondary" onClick={copyPaymentContent}>
                <Copy size={15} /> Sao chép nội dung
              </button>
              {qrInfo.checkout_url && (
                <button className="btn btn-primary" onClick={openCheckout}>
                  <ExternalLink size={15} /> Mở trang thanh toán PayOS
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
