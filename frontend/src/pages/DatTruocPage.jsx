import { useEffect, useState } from 'react'
import { datTruocApi } from '../services/api'
import { PageHeader, Modal, Field, Input, Badge, Spinner, Empty } from '../components/UI'
import { Plus, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DatTruocPage() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState({ ma_doc_gia: '', ma_tai_lieu: '' })
  const [saving, setSaving]   = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await datTruocApi.list()
    setItems(data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.ma_doc_gia || !form.ma_tai_lieu) { toast.error('Vui lòng điền đầy đủ'); return }
    setSaving(true)
    try {
      await datTruocApi.create(form)
      toast.success('Đặt trước thành công'); setModal(false); load()
    } finally { setSaving(false) }
  }

  const handleDuyet = async (ma) => {
    await datTruocApi.duyet(ma)
    toast.success('Đã duyệt đặt trước'); load()
  }

  const handleHuy = async (ma) => {
    await datTruocApi.huy(ma)
    toast.success('Đã xử lý hủy'); load()
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'cho_xu_ly':   return <Badge variant="yellow">Chờ duyệt</Badge>
      case 'da_duyet':    return <Badge variant="green">Đã duyệt</Badge>
      case 'da_huy':      return <Badge variant="red">Đã hủy</Badge>
      case 'da_nhan_sach': return <Badge variant="blue">Đã nhận sách</Badge>
      default:            return <Badge>{status}</Badge>
    }
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <PageHeader title="Đặt trước tài liệu" subtitle={`${items.length} lượt đặt`}
        action={<button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15}/>Tạo đặt trước</button>} />
      <div className="px-4 sm:px-6">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-soft border-b border-border">
              <tr>
                <th className="th">Mã đặt trước</th>
                <th className="th">Độc giả</th>
                <th className="th">Tài liệu</th>
                <th className="th">Ngày đặt</th>
                <th className="th">Trạng thái</th>
                <th className="th">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6}><Spinner /></td></tr>
                : items.length === 0 ? <tr><td colSpan={6}><Empty /></td></tr>
                : items.map(dt => (
                    <tr key={dt.ma_dat_truoc} className="table-row">
                      <td className="td font-mono text-xs">{dt.ma_dat_truoc}</td>
                      <td className="td">{dt.doc_gia?.ho_ten}</td>
                      <td className="td">{dt.tai_lieu?.ten_tai_lieu}</td>
                      <td className="td text-xs text-ink-muted">{new Date(dt.ngay_dat).toLocaleDateString('vi-VN')}</td>
                      <td className="td">{getStatusBadge(dt.trang_thai)}</td>
                      <td className="td">
                        <div className="flex gap-2">
                          {dt.trang_thai === 'cho_xu_ly' && (
                            <>
                              <button className="btn btn-ghost py-1 px-2 text-xs text-success" onClick={() => handleDuyet(dt.ma_dat_truoc)}>
                                Duyệt
                              </button>
                              <button className="btn btn-ghost py-1 px-2 text-xs text-danger" onClick={() => handleHuy(dt.ma_dat_truoc)}>
                                Từ chối
                              </button>
                            </>
                          )}
                          {dt.trang_thai === 'da_duyet' && (
                            <button className="btn btn-ghost py-1 px-2 text-xs text-danger" onClick={() => handleHuy(dt.ma_dat_truoc)}>
                              Hủy
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Tạo đặt trước" size="sm">
        <div className="space-y-4">
          <Field label="Mã độc giả" required><Input value={form.ma_doc_gia} onChange={f('ma_doc_gia')} placeholder="VD: DG001" /></Field>
          <Field label="Mã tài liệu" required><Input value={form.ma_tai_lieu} onChange={f('ma_tai_lieu')} placeholder="VD: TL001" /></Field>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button className="btn btn-secondary" onClick={() => setModal(false)}>Hủy</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Đang lưu...' : 'Xác nhận đặt'}</button>
        </div>
      </Modal>
    </div>
  )
}
