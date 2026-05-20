import { useEffect, useState } from 'react'
import { nhanVienApi } from '../services/api'
import { PageHeader, Modal, Field, Input, Select, Badge, Spinner, Empty, Confirm } from '../components/UI'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function NhanVienPage() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState({ ho_ten:'', chuc_vu:'', so_dien_thoai:'', email:'', mat_khau:'', la_admin: false })
  const [saving, setSaving]   = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await nhanVienApi.list()
    setItems(data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.ho_ten || !form.email || !form.mat_khau) { toast.error('Vui lòng điền đủ thông tin bắt buộc'); return }
    setSaving(true)
    try {
      await nhanVienApi.create(form)
      toast.success('Thêm nhân viên thành công')
      setModal(false); load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (ma) => {
    await nhanVienApi.delete(ma)
    toast.success('Đã xóa nhân viên'); load()
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <PageHeader title="Quản lý nhân viên" subtitle={`${items.length} nhân viên`}
        action={<button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15}/>Thêm nhân viên</button>} />
      <div className="px-4 sm:px-6">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-soft border-b border-border">
              <tr>
                <th className="th">Mã NV</th>
                <th className="th">Họ tên</th>
                <th className="th">Chức vụ</th>
                <th className="th">Email</th>
                <th className="th">SĐT</th>
                <th className="th">Quyền</th>
                <th className="th">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7}><Spinner /></td></tr>
                : items.length === 0 ? <tr><td colSpan={7}><Empty /></td></tr>
                : items.map(nv => (
                    <tr key={nv.ma_nhan_vien} className="table-row">
                      <td className="td font-mono text-xs text-ink-muted">{nv.ma_nhan_vien}</td>
                      <td className="td font-medium">{nv.ho_ten}</td>
                      <td className="td text-ink-muted">{nv.chuc_vu || '—'}</td>
                      <td className="td text-xs">{nv.email}</td>
                      <td className="td">{nv.so_dien_thoai || '—'}</td>
                      <td className="td">
                        <Badge variant={nv.la_admin ? 'blue' : 'gray'}>{nv.la_admin ? 'Admin' : 'Nhân viên'}</Badge>
                      </td>
                      <td className="td">
                        <button className="btn btn-ghost py-1 px-2 text-xs text-danger" onClick={() => setConfirm(nv.ma_nhan_vien)}>
                          <Trash2 size={13}/>
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Thêm nhân viên mới" size="md">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Field label="Họ và tên" required><Input value={form.ho_ten} onChange={f('ho_ten')} /></Field></div>
          <Field label="Chức vụ"><Input value={form.chuc_vu} onChange={f('chuc_vu')} placeholder="Thủ thư, Quản trị viên..." /></Field>
          <Field label="SĐT"><Input value={form.so_dien_thoai} onChange={f('so_dien_thoai')} /></Field>
          <Field label="Email" required><Input type="email" value={form.email} onChange={f('email')} /></Field>
          <Field label="Mật khẩu" required><Input type="password" value={form.mat_khau} onChange={f('mat_khau')} /></Field>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="admin" checked={form.la_admin}
              onChange={e => setForm(p => ({ ...p, la_admin: e.target.checked }))} className="w-4 h-4 accent-primary" />
            <label htmlFor="admin" className="text-sm">Cấp quyền Admin</label>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button className="btn btn-secondary" onClick={() => setModal(false)}>Hủy</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Đang lưu...' : 'Thêm nhân viên'}</button>
        </div>
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => handleDelete(confirm)}
        title="Xóa nhân viên" message="Bạn có chắc muốn xóa nhân viên này?" />
    </div>
  )
}
