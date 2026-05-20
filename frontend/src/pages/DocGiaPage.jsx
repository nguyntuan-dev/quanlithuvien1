import { useEffect, useState } from 'react'
import { docGiaApi } from '../services/api'
import { PageHeader, Modal, Field, Input, Select, Badge, Spinner, Empty, SearchBar, Confirm } from '../components/UI'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const THE_LABEL = {
  CON_HIEU_LUC: { label: 'Còn hiệu lực', variant: 'green' },
  HET_HAN:      { label: 'Hết hạn',       variant: 'yellow' },
  BI_KHOA:      { label: 'Bị khóa',       variant: 'red' },
}

const EMPTY = {
  ho_ten:'', ngay_sinh:'', gioi_tinh:'NAM', dia_chi:'',
  so_dien_thoai:'', email:'', loai_the:'Thẻ sinh viên (1 năm)',
  ngay_cap: new Date().toISOString().slice(0,10), ngay_het_han:''
}

export default function DocGiaPage() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ]             = useState('')
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await docGiaApi.list({ q })
    setItems(data); setLoading(false)
  }

  useEffect(() => { load() }, [q])

  const openNew = () => { setEditing(null); setForm(EMPTY); setModal(true) }
  const openEdit = (it) => {
    setEditing(it.ma_doc_gia)
    setForm({
      ho_ten: it.ho_ten, ngay_sinh: it.ngay_sinh || '',
      gioi_tinh: it.gioi_tinh || 'NAM', dia_chi: it.dia_chi || '',
      so_dien_thoai: it.so_dien_thoai || '', email: it.email || '',
      trang_thai_the: it.trang_thai_the,
    })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.ho_ten) { toast.error('Vui lòng nhập họ tên'); return }
    setSaving(true)
    try {
      if (editing) {
        await docGiaApi.update(editing, form)
        toast.success('Cập nhật thành công')
      } else {
        await docGiaApi.create(form)
        toast.success('Đăng ký độc giả & cấp thẻ thành công')
      }
      setModal(false); load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (ma) => {
    await docGiaApi.delete(ma)
    toast.success('Đã xóa độc giả')
    load()
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <PageHeader
        title="Quản lý độc giả"
        subtitle={`${items.length} độc giả`}
        action={<button className="btn btn-primary" onClick={openNew}><Plus size={15}/>Đăng ký mới</button>}
      />
      <div className="px-4 sm:px-6">
        <SearchBar value={q} onChange={setQ} placeholder="Tìm theo tên, mã, email, SĐT..." />
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-soft border-b border-border">
              <tr>
                <th className="th">Mã ĐG</th>
                <th className="th">Họ tên</th>
                <th className="th">Ngày sinh</th>
                <th className="th">SĐT</th>
                <th className="th">Email</th>
                <th className="th">Thẻ TV</th>
                <th className="th">Hạn thẻ</th>
                <th className="th">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8}><Spinner /></td></tr>
                : items.length === 0
                  ? <tr><td colSpan={8}><Empty /></td></tr>
                  : items.map(it => {
                      const tt = THE_LABEL[it.trang_thai_the?.toUpperCase()] || { label: it.trang_thai_the, variant:'gray' }
                      return (
                        <tr key={it.ma_doc_gia} className="table-row">
                          <td className="td font-mono text-xs text-ink-muted">{it.ma_doc_gia}</td>
                          <td className="td font-medium">{it.ho_ten}</td>
                          <td className="td text-ink-muted text-xs">{it.ngay_sinh || '—'}</td>
                          <td className="td">{it.so_dien_thoai || '—'}</td>
                          <td className="td text-xs">{it.email || '—'}</td>
                          <td className="td"><Badge variant={tt.variant}>{tt.label}</Badge></td>
                          <td className="td text-xs text-ink-muted">{it.the_thu_vien?.ngay_het_han || '—'}</td>
                          <td className="td">
                            <div className="flex gap-1">
                              <button className="btn btn-ghost py-1 px-2 text-xs" onClick={() => openEdit(it)}>
                                <Pencil size={13}/>
                              </button>
                              <button className="btn btn-ghost py-1 px-2 text-xs text-danger" onClick={() => setConfirm(it.ma_doc_gia)}>
                                <Trash2 size={13}/>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Cập nhật độc giả' : 'Đăng ký độc giả mới'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Họ và tên" required><Input value={form.ho_ten} onChange={f('ho_ten')} placeholder="Nhập họ tên đầy đủ" /></Field>
          </div>
          <Field label="Ngày sinh"><Input type="date" value={form.ngay_sinh} onChange={f('ngay_sinh')} /></Field>
          <Field label="Giới tính">
            <Select value={form.gioi_tinh} onChange={f('gioi_tinh')}>
              <option value="NAM">Nam</option>
              <option value="NU">Nữ</option>
              <option value="KHAC">Khác</option>
            </Select>
          </Field>
          <Field label="Số điện thoại"><Input value={form.so_dien_thoai} onChange={f('so_dien_thoai')} placeholder="0xxx xxx xxx" /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={f('email')} placeholder="example@email.com" /></Field>
          <div className="col-span-2">
            <Field label="Địa chỉ"><Input value={form.dia_chi} onChange={f('dia_chi')} placeholder="Số nhà, đường, phường, quận, tỉnh" /></Field>
          </div>
          {!editing && <>
            <div className="col-span-2 border-t border-border pt-3 mt-1">
              <p className="text-xs font-semibold text-ink-muted mb-3 uppercase tracking-wide">Thông tin thẻ thư viện</p>
            </div>
            <Field label="Loại thẻ">
              <Select value={form.loai_the} onChange={f('loai_the')}>
                <option>Thẻ sinh viên (1 năm)</option>
                <option>Thẻ giảng viên (3 năm)</option>
                <option>Thẻ thường (6 tháng)</option>
              </Select>
            </Field>
            <Field label="Ngày cấp"><Input type="date" value={form.ngay_cap} onChange={f('ngay_cap')} /></Field>
          </>}
          {editing && (
            <Field label="Trạng thái thẻ">
              <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-border bg-surface-soft p-1">
                {[
                  ['CON_HIEU_LUC', 'Còn hiệu lực'],
                  ['HET_HAN', 'Hết hạn'],
                  ['BI_KHOA', 'Bị khóa'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`px-3 py-2 text-sm font-medium transition ${
                      form.trang_thai_the === value
                        ? 'rounded-md bg-primary text-white shadow-sm'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                    onClick={() => setForm(p => ({ ...p, trang_thai_the: value }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          )}
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button className="btn btn-secondary" onClick={() => setModal(false)}>Hủy</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : (editing ? 'Cập nhật' : 'Đăng ký & Cấp thẻ')}
          </button>
        </div>
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => handleDelete(confirm)}
        title="Xóa độc giả" message="Bạn có chắc muốn xóa độc giả này?" />
    </div>
  )
}
