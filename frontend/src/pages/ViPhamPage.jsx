import { useEffect, useState } from 'react'
import { viPhamApi } from '../services/api'
import { PageHeader, Modal, Field, Input, Badge, Spinner, Empty } from '../components/UI'
import { Plus, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const TT_LABEL = {
  chua_thanh_toan: { label: 'Chưa thanh toán', variant: 'red' },
  da_thanh_toan: { label: 'Đã thanh toán', variant: 'green' },
  CHUA_THANH_TOAN: { label: 'Chưa thanh toán', variant: 'red' },
  DA_THANH_TOAN: { label: 'Đã thanh toán', variant: 'green' },
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

export default function ViPhamPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ ma_phieu_muon: '', ly_do_phat: '', so_tien: '' })
  const [saving, setSaving] = useState(false)
  const [payingId, setPayingId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await viPhamApi.list()
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.ma_phieu_muon || !form.ly_do_phat || !form.so_tien) {
      toast.error('Vui lòng điền đầy đủ thông tin')
      return
    }

    setSaving(true)
    try {
      await viPhamApi.create({ ...form, so_tien: parseFloat(form.so_tien) })
      toast.success('Đã ghi vi phạm')
      setModal(false)
      setForm({ ma_phieu_muon: '', ly_do_phat: '', so_tien: '' })
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleThanhToan = async (ma) => {
    setPayingId(ma)
    try {
      await viPhamApi.thanhToan(ma)
      toast.success('Đã xác nhận đã thanh toán')
      load()
    } finally {
      setPayingId(null)
    }
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <PageHeader
        title="Vi phạm & Phạt"
        subtitle={`${items.length} vi phạm`}
        action={
          <button className="btn btn-primary" onClick={() => setModal(true)}>
            <Plus size={15} /> Ghi vi phạm
          </button>
        }
      />

      <div className="px-6">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-soft border-b border-border">
              <tr>
                <th className="th">Mã phạt</th>
                <th className="th">Độc giả</th>
                <th className="th">Phiếu mượn</th>
                <th className="th">Lý do</th>
                <th className="th">Số tiền</th>
                <th className="th">Ngày phạt</th>
                <th className="th">Trạng thái</th>
                <th className="th">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8}><Spinner /></td></tr>
                : items.length === 0
                  ? <tr><td colSpan={8}><Empty message="Không có vi phạm nào" /></td></tr>
                  : items.map(vp => {
                      const tt = TT_LABEL[vp.trang_thai_thanh_toan] || { label: vp.trang_thai_thanh_toan, variant: 'gray' }
                      const unpaid = ['chua_thanh_toan', 'CHUA_THANH_TOAN'].includes(vp.trang_thai_thanh_toan)

                      return (
                        <tr key={vp.ma_phat} className="table-row">
                          <td className="td font-mono text-xs">{vp.ma_phat}</td>
                          <td className="td">{vp.phieu_muon?.doc_gia?.ho_ten || '-'}</td>
                          <td className="td font-mono text-xs">{vp.phieu_muon?.ma_phieu_muon || '-'}</td>
                          <td className="td">{formatFineReason(vp.ly_do_phat)}</td>
                          <td className="td font-semibold text-danger">
                            {Number(vp.so_tien).toLocaleString('vi-VN')}đ
                          </td>
                          <td className="td text-xs text-ink-muted">
                            {new Date(vp.ngay_phat).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="td"><Badge variant={tt.variant}>{tt.label}</Badge></td>
                          <td className="td">
                            {unpaid ? (
                              <button
                                className="btn btn-primary py-1 px-3 text-xs"
                                disabled={payingId === vp.ma_phat}
                                onClick={() => handleThanhToan(vp.ma_phat)}
                              >
                                <CheckCircle size={12} /> Xác nhận đã thanh toán
                              </button>
                            ) : (
                              <span className="text-xs text-ink-faint">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Ghi vi phạm mới"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Hủy</button>
            <button className="btn btn-danger" onClick={handleCreate} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Ghi vi phạm'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Mã phiếu mượn" required>
            <Input value={form.ma_phieu_muon} onChange={f('ma_phieu_muon')} placeholder="VD: PM-20250506-ABCD" />
          </Field>
          <Field label="Lý do phạt" required>
            <Input value={form.ly_do_phat} onChange={f('ly_do_phat')} placeholder="VD: Trả sách quá hạn 5 ngày" />
          </Field>
          <Field label="Số tiền phạt (đ)" required>
            <Input type="number" min="0" value={form.so_tien} onChange={f('so_tien')} placeholder="50000" />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
