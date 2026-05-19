import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { heThongApi } from '../services/api'
import { Empty, Field, Input, PageHeader, Spinner } from '../components/UI'

const money = (value) => Number(value || 0).toLocaleString('vi-VN')

function isSecretSetting(key) {
  return key.includes('token') || key.includes('key') || key.includes('secret')
}

export default function HeThongPage() {
  const [settings, setSettings] = useState([])
  const [logs, setLogs] = useState([])
  const [report, setReport] = useState(null)
  const [backup, setBackup] = useState('')
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [savingKey, setSavingKey] = useState(null)
  const [automationResult, setAutomationResult] = useState(null)

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

  const changeSetting = (key, value) => {
    setSettings(rows => rows.map(row => (
      row.khoa === key ? { ...row, gia_tri: value } : row
    )))
  }

  const update = async (row) => {
    setSavingKey(row.khoa)
    try {
      const { data } = await heThongApi.updateCauHinh(row.khoa, {
        gia_tri: row.gia_tri ?? '',
        mo_ta: row.mo_ta,
      })
      setSettings(rows => rows.map(item => (item.khoa === data.khoa ? data : item)))
      toast.success('Đã cập nhật cấu hình')
    } finally {
      setSavingKey(null)
    }
  }

  const runAutomation = async () => {
    setRunning(true)
    try {
      const { data } = await heThongApi.runAutomation()
      setAutomationResult(data)
      toast.success('Đã chạy các tác vụ tự động')
      load()
    } finally {
      setRunning(false)
    }
  }

  const makeBackup = async () => {
    const { data } = await heThongApi.backup()
    setBackup(JSON.stringify(data, null, 2))
    toast.success('Đã tạo bản sao lưu JSON')
  }

  const restore = async () => {
    if (!backup.trim()) {
      toast.error('Chưa có JSON để phục hồi')
      return
    }
    await heThongApi.restore(JSON.parse(backup))
    toast.success('Đã gửi dữ liệu phục hồi')
    load()
  }

  return (
    <div>
      <PageHeader title="Hệ thống" subtitle="Tự động hóa, cấu hình, sao lưu/phục hồi và nhật ký audit" />
      <div className="px-6 space-y-4">
        <div className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold">Tự động hóa thư viện</h2>
            <button className="btn btn-primary" disabled={running} onClick={runAutomation}>
              {running ? 'Đang chạy...' : 'Chạy tác vụ ngay'}
            </button>
          </div>
          {automationResult && (
            <div className="mb-4 rounded border border-border bg-surface-soft p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Kết quả chạy tác vụ</h3>
                  <p className="text-xs text-ink-muted">
                    {automationResult.ran_at
                      ? new Date(automationResult.ran_at).toLocaleString('vi-VN')
                      : automationResult.message}
                  </p>
                </div>
                <div className="text-xs text-ink-muted">
                  Thành công: <span className="font-semibold text-success">{automationResult.ok_count ?? 0}</span>
                  <span className="mx-2">|</span>
                  Lỗi: <span className="font-semibold text-danger">{automationResult.error_count ?? 0}</span>
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-ink-muted">
                      <th className="py-2 pr-3 font-medium">Tác vụ</th>
                      <th className="py-2 pr-3 font-medium">Trạng thái</th>
                      <th className="py-2 pr-3 font-medium">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(automationResult.jobs || []).map((job, index) => {
                      const details = Object.entries(job)
                        .filter(([key]) => !['job', 'status'].includes(key))
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ')

                      return (
                        <tr key={`${job.job}-${index}`} className="border-b border-border last:border-0">
                          <td className="py-2 pr-3 font-medium">{job.job}</td>
                          <td className="py-2 pr-3">
                            <span className={job.status === 'error' ? 'text-danger font-semibold' : 'text-success font-semibold'}>
                              {job.status}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-ink-muted">{details || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <pre className="mt-3 max-h-72 overflow-auto rounded bg-surface p-3 text-xs text-ink-muted">
                {JSON.stringify(automationResult, null, 2)}
              </pre>
            </div>
          )}
          {loading || !report ? <Spinner /> : (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded border border-border bg-surface-soft p-3">
                <p className="text-xs text-ink-muted">Mượn mới hôm nay</p>
                <p className="text-2xl font-semibold">{report.muon_moi}</p>
              </div>
              <div className="rounded border border-border bg-surface-soft p-3">
                <p className="text-xs text-ink-muted">Chờ duyệt trả</p>
                <p className="text-2xl font-semibold">{report.cho_duyet_tra}</p>
              </div>
              <div className="rounded border border-border bg-surface-soft p-3">
                <p className="text-xs text-ink-muted">Phiếu quá hạn</p>
                <p className="text-2xl font-semibold text-danger">{report.qua_han}</p>
              </div>
              <div className="rounded border border-border bg-surface-soft p-3">
                <p className="text-xs text-ink-muted">Tiền phạt chưa thu</p>
                <p className="text-2xl font-semibold">{money(report.tong_tien_phat_chua_thu)}đ</p>
              </div>
            </div>
          )}
          {report && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded border border-border overflow-hidden">
                <div className="bg-surface-soft px-3 py-2 text-sm font-semibold">Phiếu quá hạn cần xử lý</div>
                <div className="divide-y divide-border">
                  {report.phieu_qua_han_can_xu_ly?.length ? report.phieu_qua_han_can_xu_ly.map(item => (
                    <div key={item.ma_phieu_muon} className="px-3 py-2 text-sm flex justify-between gap-3">
                      <span>{item.doc_gia}</span>
                      <span className="font-mono text-danger">{item.so_ngay_qua_han} ngày</span>
                    </div>
                  )) : <div className="px-3 py-4"><Empty message="Không có phiếu quá hạn" /></div>}
                </div>
              </div>
              <div className="rounded border border-border overflow-hidden">
                <div className="bg-surface-soft px-3 py-2 text-sm font-semibold">Sách sắp hết</div>
                <div className="divide-y divide-border">
                  {report.sach_sap_het?.length ? report.sach_sap_het.map(item => (
                    <div key={item.ma_tai_lieu} className="px-3 py-2 text-sm flex justify-between gap-3">
                      <span className="truncate">{item.ten_tai_lieu}</span>
                      <span className="font-mono">{item.so_luong}</span>
                    </div>
                  )) : <div className="px-3 py-4"><Empty message="Không có sách sắp hết" /></div>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Cấu hình chính sách</h2>
          {loading ? <Spinner /> : settings.map(row => (
            <div key={row.khoa} className="grid grid-cols-[220px_1fr_120px] gap-3 items-end mb-3">
              <Field label={row.khoa}>
                <Input
                  type={isSecretSetting(row.khoa) ? 'password' : 'text'}
                  value={row.gia_tri || ''}
                  onChange={e => changeSetting(row.khoa, e.target.value)}
                />
              </Field>
              <div className="text-sm text-ink-muted pb-2">{row.mo_ta}</div>
              <button className="btn btn-secondary" onClick={() => update(row)} disabled={savingKey === row.khoa}>
                {savingKey === row.khoa ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          ))}
        </div>

        <div className="card p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold">Sao lưu / phục hồi dữ liệu</h2>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={makeBackup}>Tạo bản sao lưu</button>
              <button className="btn btn-danger" onClick={restore}>Phục hồi</button>
            </div>
          </div>
          <textarea className="input font-mono text-xs min-h-[180px]" value={backup} onChange={e => setBackup(e.target.value)} />
        </div>

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-soft border-b border-border">
              <tr>
                <th className="th">Thời gian</th>
                <th className="th">Người dùng</th>
                <th className="th">Hành động</th>
                <th className="th">Đối tượng</th>
                <th className="th">Chi tiết</th>
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
