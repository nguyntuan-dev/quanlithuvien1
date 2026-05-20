import { useEffect, useState } from 'react'
import { taiLieuApi } from '../services/api'
import { PageHeader, Modal, Field, Input, Select, Textarea, Badge, Spinner, Empty, SearchBar, Confirm } from '../components/UI'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const TINH_TRANG_LABEL = {
  CO_SAN: { label: 'Có sẵn', variant: 'green' },
  DANG_MUON: { label: 'Đang mượn', variant: 'yellow' },
  DAT_TRUOC: { label: 'Đặt trước', variant: 'blue' },
  BAO_TRI: { label: 'Bảo trì', variant: 'gray' },
  THANH_LY: { label: 'Thanh lý', variant: 'red' },
}

const EMPTY_FORM = {
  ten_tai_lieu: '', nam_xuat_ban: '', so_luong: 1, gia: '',
  anh_bia: '', vi_tri: '', mo_ta: '', ma_tac_gia: '', ma_the_loai: '', ma_nxb: '',
  ten_tac_gia: '', ten_nxb: ''
}

export default function TaiLieuPage() {
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ theLoai: [], tacGia: [], nxb: [] })
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await taiLieuApi.list({ q })
    setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    Promise.all([
      taiLieuApi.theLoai(), taiLieuApi.tacGia(), taiLieuApi.nxb()
    ]).then(([tl, tg, n]) => setMeta({ theLoai: tl.data, tacGia: tg.data, nxb: n.data }))
  }, [])

  useEffect(() => { load() }, [q])

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setModal(true) }
  const openEdit = (item) => {
    setEditing(item.ma_tai_lieu)
    setForm({
      ten_tai_lieu: item.ten_tai_lieu,
      nam_xuat_ban: item.nam_xuat_ban || '',
      so_luong: item.so_luong,
      gia: item.gia || '',
      anh_bia: item.anh_bia || '',
      vi_tri: item.vi_tri || '',
      mo_ta: item.mo_ta || '',
      ma_tac_gia: item.tac_gia?.ma_tac_gia || '',
      ten_tac_gia: item.tac_gia?.ten_tac_gia || '',
      ma_the_loai: item.the_loai?.ma_the_loai || '',
      ma_nxb: item.nha_xuat_ban?.ma_nxb || '',
      ten_nxb: item.nha_xuat_ban?.ten_nxb || ''
    })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.ten_tai_lieu) { toast.error('Vui lòng nhập tên tài liệu'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        nam_xuat_ban: form.nam_xuat_ban === '' ? null : Number(form.nam_xuat_ban),
        so_luong: Number(form.so_luong || 0),
        gia: Number(form.gia || 0),
        // Chuyển chuỗi rỗng thành null để tránh lỗi khóa ngoại ở backend
        ma_tac_gia: form.ma_tac_gia || null,
        ma_the_loai: form.ma_the_loai || null,
        ma_nxb: form.ma_nxb || null,
      }
      if (editing) {
        await taiLieuApi.update(editing, payload)
        toast.success('Cập nhật thành công')
      } else {
        await taiLieuApi.create(payload)
        toast.success('Thêm tài liệu thành công')
      }
      setModal(false); load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (ma) => {
    await taiLieuApi.delete(ma)
    toast.success('Đã xóa tài liệu')
    load()
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ảnh không được vượt quá 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setForm(p => ({ ...p, anh_bia: reader.result }))
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <PageHeader
        title="Quản lý tài liệu"
        subtitle={`${items.length} tài liệu`}
        action={<button className="btn btn-primary" onClick={openNew}><Plus size={15} />Thêm tài liệu</button>}
      />
      <div className="px-4 sm:px-6">
        <SearchBar value={q} onChange={setQ} placeholder="Tìm theo tên, mã tài liệu..." />
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-soft border-b border-border">
              <tr>
                <th className="th">Mã TL</th>
                <th className="th">Tên tài liệu</th>
                <th className="th">Tác giả</th>
                <th className="th">Thể loại</th>
                <th className="th">Số lượng</th>
                <th className="th">Giá</th>
                <th className="th">Trạng thái</th>
                <th className="th">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8}><Spinner /></td></tr>
                : items.length === 0
                  ? <tr><td colSpan={8}><Empty /></td></tr>
                  : items.map(item => {
                    const tt = TINH_TRANG_LABEL[item.tinh_trang?.toUpperCase()] || { label: item.tinh_trang, variant: 'gray' }
                    return (
                      <tr key={item.ma_tai_lieu} className="table-row">
                        <td className="td font-mono text-xs text-ink-muted">{item.ma_tai_lieu}</td>
                        <td className="td font-medium">{item.ten_tai_lieu}</td>
                        <td className="td text-ink-muted">{item.tac_gia?.ten_tac_gia || '—'}</td>
                        <td className="td">{item.the_loai?.ten_the_loai || '—'}</td>
                        <td className="td">{item.so_luong}</td>
                        <td className="td">{Number(item.gia || 0).toLocaleString('vi-VN')}đ</td>
                        <td className="td"><Badge variant={tt.variant}>{tt.label}</Badge></td>
                        <td className="td">
                          <div className="flex gap-1">
                            <button className="btn btn-ghost py-1 px-2 text-xs" onClick={() => openEdit(item)}>
                              <Pencil size={13} />
                            </button>
                            <button className="btn btn-ghost py-1 px-2 text-xs text-danger" onClick={() => setConfirm(item.ma_tai_lieu)}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal thêm/sửa */}
      <Modal 
        open={modal} 
        onClose={() => setModal(false)} 
        title={editing ? 'Cập nhật tài liệu' : 'Thêm tài liệu mới'} 
        size="lg"
        footer={
          <div className="flex gap-2 justify-end">
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Đang lưu...' : (editing ? 'Cập nhật' : 'Thêm mới')}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Tên tài liệu" required>
              <Input value={form.ten_tai_lieu} onChange={f('ten_tai_lieu')} placeholder="Nhập tên đầy đủ..." />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Ảnh tài liệu">
              <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border bg-surface-muted">
                  {form.anh_bia ? (
                    <img src={form.anh_bia} alt="Ảnh tài liệu" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-3 text-center text-xs text-ink-faint">
                      Chưa có ảnh
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Input type="file" accept="image/*" onChange={handleImage} />
                  <Input
                    value={form.anh_bia?.startsWith('data:') ? '' : form.anh_bia}
                    onChange={f('anh_bia')}
                    placeholder="Hoặc dán URL ảnh bìa..."
                  />
                  {form.anh_bia && (
                    <button type="button" className="btn btn-secondary py-1 px-3 text-xs" onClick={() => setForm(p => ({ ...p, anh_bia: '' }))}>
                      Xóa ảnh
                    </button>
                  )}
                </div>
              </div>
            </Field>
          </div>
          <Field label="Tác giả">
            <Input value={form.ten_tac_gia} onChange={f('ten_tac_gia')} placeholder="Nhập tên tác giả" />
          </Field>
          <Field label="Thể loại">
            <Select value={form.ma_the_loai} onChange={f('ma_the_loai')}>
              <option value="">-- Chọn thể loại --</option>
              {meta.theLoai.map(tl => <option key={tl.ma_the_loai} value={tl.ma_the_loai}>{tl.ten_the_loai}</option>)}
            </Select>
          </Field>
          <Field label="Nhà xuất bản">
            <Input value={form.ten_nxb} onChange={f('ten_nxb')} placeholder="Nhập nhà xuất bản" />
          </Field>
          <Field label="Năm xuất bản">
            <Input type="number" value={form.nam_xuat_ban} onChange={f('nam_xuat_ban')} placeholder="2024" />
          </Field>
          <Field label="Số lượng" required>
            <Input type="number" min="0" value={form.so_luong} onChange={f('so_luong')} />
          </Field>
          <Field label="Giá sách (đ)">
            <Input type="number" min="0" value={form.gia} onChange={f('gia')} placeholder="120000" />
          </Field>
          <Field label="Vị trí lưu trữ">
            <Input value={form.vi_tri} onChange={f('vi_tri')} placeholder="VD: Kệ A3 - Tầng 2" />
          </Field>
          <div className="col-span-2">
            <Field label="Mô tả / Ghi chú">
              <Textarea value={form.mo_ta} onChange={f('mo_ta')} placeholder="Tóm tắt nội dung..." />
            </Field>
          </div>
        </div>
      </Modal>

      <Confirm
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => handleDelete(confirm)}
        title="Xóa tài liệu"
        message="Bạn có chắc muốn xóa tài liệu này? Hành động này không thể hoàn tác."
      />
    </div>
  )
}
