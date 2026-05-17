import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { heThongApi } from '../services/api'
import { Empty, Field, Input, PageHeader, Spinner } from '../components/UI'

const money = (value) => Number(value || 0).toLocaleString('vi-VN')

export default function HeThongPage() {
  const [settings, setSettings] = useState([])
  const [logs, setLogs] = useState([])
  const [report, setReport] = useState(null)
  const [backup, setBackup] = useState('')
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [cauHinh, audit, ops] = await Promise.all([
        heThongApi.cauHinh(),
        heThongApi.auditLog({ limit: 50 }),
        heThongApi.operationsReport(),
      ])
      setSettings(cauHinh.data)
      setLogs(audit.data)
      setReport(ops.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const update = async (row, value) => {
    await heThongApi.updateCauHinh(row.khoa, { gia_tri: value, mo_ta: row.mo_ta })
    toast.success('Da cap nhat cau hinh')
    load()
  }

  const runAutomation = async () => {
    setRunning(true)
    try {
      await heThongApi.runAutomation()
      toast.success('Da chay cac job tu dong')
      load()
    } finally {
      setRunning(false)
    }
  }

  const makeBackup = async () => {
    const { data } = await heThongApi.backup()
    setBackup(JSON.stringify(data, null, 2))
    toast.success('Da tao backup JSON')
  }

  const restore = async () => {
    if (!backup.trim()) { toast.error('Chua co JSON de phuc hoi'); return }
    await heThongApi.restore(JSON.parse(backup))
    toast.success('Da gui du lieu restore')
    load()
  }

  return (
    <div>
      <PageHeader title="He thong" subtitle="Tu dong hoa, cau hinh, backup/restore va audit log" />
      <div className="px-6 space-y-4">
        <div className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold">Tu dong hoa thu vien</h2>
            <button className="btn btn-primary" disabled={running} onClick={runAutomation}>
              {running ? 'Dang chay...' : 'Chay job ngay'}
            </button>
          </div>
          {loading || !report ? <Spinner /> : (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded border border-border bg-surface-soft p-3">
                <p className="text-xs text-ink-muted">Muon moi hom nay</p>
                <p className="text-2xl font-semibold">{report.muon_moi}</p>
              </div>
              <div className="rounded border border-border bg-surface-soft p-3">
                <p className="text-xs text-ink-muted">Cho duyet tra</p>
                <p className="text-2xl font-semibold">{report.cho_duyet_tra}</p>
              </div>
              <div className="rounded border border-border bg-surface-soft p-3">
                <p className="text-xs text-ink-muted">Phieu qua han</p>
                <p className="text-2xl font-semibold text-danger">{report.qua_han}</p>
              </div>
              <div className="rounded border border-border bg-surface-soft p-3">
                <p className="text-xs text-ink-muted">Tien phat chua thu</p>
                <p className="text-2xl font-semibold">{money(report.tong_tien_phat_chua_thu)}d</p>
              </div>
            </div>
          )}
          {report && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded border border-border overflow-hidden">
                <div className="bg-surface-soft px-3 py-2 text-sm font-semibold">Phieu qua han can xu ly</div>
                <div className="divide-y divide-border">
                  {report.phieu_qua_han_can_xu_ly?.length ? report.phieu_qua_han_can_xu_ly.map(item => (
                    <div key={item.ma_phieu_muon} className="px-3 py-2 text-sm flex justify-between gap-3">
                      <span>{item.doc_gia}</span>
                      <span className="font-mono text-danger">{item.so_ngay_qua_han} ngay</span>
                    </div>
                  )) : <div className="px-3 py-4"><Empty message="Khong co phieu qua han" /></div>}
                </div>
              </div>
              <div className="rounded border border-border overflow-hidden">
                <div className="bg-surface-soft px-3 py-2 text-sm font-semibold">Sach sap het</div>
                <div className="divide-y divide-border">
                  {report.sach_sap_het?.length ? report.sach_sap_het.map(item => (
                    <div key={item.ma_tai_lieu} className="px-3 py-2 text-sm flex justify-between gap-3">
                      <span className="truncate">{item.ten_tai_lieu}</span>
                      <span className="font-mono">{item.so_luong}</span>
                    </div>
                  )) : <div className="px-3 py-4"><Empty message="Khong co sach sap het" /></div>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Cau hinh chinh sach</h2>
          {loading ? <Spinner /> : settings.map(row => (
            <div key={row.khoa} className="grid grid-cols-[220px_1fr_120px] gap-3 items-end mb-3">
              <Field label={row.khoa}>
                <Input defaultValue={row.gia_tri} onBlur={e => update(row, e.target.value)} />
              </Field>
              <div className="text-sm text-ink-muted pb-2">{row.mo_ta}</div>
              <button className="btn btn-secondary" onClick={() => update(row, row.gia_tri)}>Luu</button>
            </div>
          ))}
        </div>

        <div className="card p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold">Sao luu / phuc hoi du lieu</h2>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={makeBackup}>Tao backup</button>
              <button className="btn btn-danger" onClick={restore}>Restore</button>
            </div>
          </div>
          <textarea className="input font-mono text-xs min-h-[180px]" value={backup} onChange={e => setBackup(e.target.value)} />
        </div>

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-soft border-b border-border">
              <tr>
                <th className="th">Thoi gian</th>
                <th className="th">Nguoi dung</th>
                <th className="th">Hanh dong</th>
                <th className="th">Doi tuong</th>
                <th className="th">Chi tiet</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? <tr><td colSpan={5}><Empty /></td></tr>
                : logs.map(log => (
                  <tr key={log.id} className="table-row">
                    <td className="td text-xs">{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                    <td className="td">{log.nguoi_thuc_hien || '-'}</td>
                    <td className="td">{log.hanh_dong}</td>
                    <td className="td">{log.doi_tuong || '-'}</td>
                    <td className="td">{log.chi_tiet || '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
