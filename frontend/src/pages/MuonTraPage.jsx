import { useEffect, useState } from 'react'
import { muonTraApi, taiLieuApi, docGiaApi } from '../services/api'
import { PageHeader, Modal, Field, Input, Badge, Spinner, Empty } from '../components/UI'
import { Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const TT_LABEL = {
  DANG_MUON: { label: 'Đang mượn', variant: 'blue' },
  CHO_TRA:   { label: 'Chờ duyệt trả', variant: 'yellow' },
  DA_TRA:    { label: 'Đã trả',    variant: 'green' },
  QUA_HAN:   { label: 'Quá hạn',   variant: 'red' },
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function taiLieuLabel(tl) {
  if (!tl) return ''
  return `[${tl.ma_tai_lieu}] ${tl.ten_tai_lieu} (còn ${tl.so_luong})`
}

function TaiLieuSearchInput({ value, query, items, onQueryChange, onSelect }) {
  const [open, setOpen] = useState(false)
  const selected = items.find(tl => tl.ma_tai_lieu === value)
  const displayValue = query || taiLieuLabel(selected)
  const keyword = normalizeSearch(query)
  const available = items.filter(tl => Number(tl.so_luong || 0) > 0)
  const results = (keyword
    ? available.filter(tl => normalizeSearch(`${tl.ma_tai_lieu} ${tl.ten_tai_lieu}`).includes(keyword))
    : available
  ).slice(0, 8)

  return (
    <div className="relative flex-1">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        className="input w-full pl-9"
        value={displayValue}
        placeholder="Tìm theo mã hoặc tên tài liệu..."
        onFocus={() => setOpen(true)}
        onChange={e => {
          onQueryChange(e.target.value)
          onSelect('')
          setOpen(true)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-muted">Không tìm thấy tài liệu còn sách</div>
          ) : results.map(tl => (
            <button
              key={tl.ma_tai_lieu}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-soft"
              onMouseDown={e => {
                e.preventDefault()
                onSelect(tl.ma_tai_lieu)
                onQueryChange('')
                setOpen(false)
              }}
            >
              <span className="font-mono text-xs text-primary">[{tl.ma_tai_lieu}]</span>{' '}
              <span className="font-medium">{tl.ten_tai_lieu}</span>
              <span className="ml-2 text-xs text-ink-muted">còn {tl.so_luong}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MuonTraPage() {
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('tat_ca')
  const [muonModal, setMuonModal] = useState(false)
  const [traModal, setTraModal]   = useState(false)
  const [selectedPhieu, setSelectedPhieu] = useState(null)
  const [tinhTrangTra, setTinhTrangTra]   = useState('Tot')

  // Form mượn
  const [maDocGia, setMaDocGia]   = useState('')
  const [docGiaInfo, setDocGiaInfo] = useState(null)
  const [hanTra, setHanTra]       = useState('')
  const [chiTiet, setChiTiet]     = useState([{ ma_tai_lieu: '', so_luong: 1, search: '' }])
  const [maDatTruoc, setMaDatTruoc] = useState('')
  const [saving, setSaving]       = useState(false)
  const [taiLieuList, setTaiLieuList] = useState([])

  const load = async () => {
    setLoading(true)
    try {
      const params = tab !== 'tat_ca' ? { trang_thai: tab } : {}
      const { data } = await muonTraApi.list(params)
      setItems(data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tab])

  useEffect(() => {
    taiLieuApi.list({}).then(r => setTaiLieuList(r.data)).catch(() => {})
  }, [])

  const lookupDocGia = async () => {
    if (!maDocGia.trim()) return
    try {
      const { data } = await docGiaApi.get(maDocGia.trim())
      setDocGiaInfo(data)
      toast.success('Tìm thấy: ' + data.ho_ten)
    } catch {
      setDocGiaInfo(null)
      toast.error('Không tìm thấy độc giả với mã: ' + maDocGia)
    }
  }

  const lookupDatTruoc = async () => {
    if (!maDatTruoc.trim()) return
    try {
      const { data } = await muonTraApi.getReservation(maDatTruoc.trim())
      setMaDocGia(data.ma_doc_gia)
      setChiTiet([{ ma_tai_lieu: data.ma_tai_lieu, so_luong: data.so_luong, search: '' }])
      
      // Sau đó lookup độc giả để hiện info
      const resDocGia = await docGiaApi.get(data.ma_doc_gia)
      setDocGiaInfo(resDocGia.data)
      
      toast.success('Đã nạp thông tin từ mã đặt trước')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không tìm thấy mã đặt trước')
    }
  }

  const addChiTiet = () => setChiTiet(p => [...p, { ma_tai_lieu: '', so_luong: 1, search: '' }])
  const removeChiTiet = (i) => setChiTiet(p => p.filter((_, idx) => idx !== i))
  const updateChiTiet = (i, k, v) => setChiTiet(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  const handleMuon = async () => {
    if (!maDocGia.trim()) { toast.error('Vui lòng nhập mã độc giả'); return }
    if (!hanTra) { toast.error('Vui lòng chọn hạn trả'); return }
    if (chiTiet.some(c => !c.ma_tai_lieu)) { toast.error('Vui lòng chọn tài liệu cho tất cả các dòng'); return }
    setSaving(true)
    try {
      await muonTraApi.create({
        ma_doc_gia: maDocGia.trim(),
        han_tra: hanTra,
        chi_tiet: chiTiet.map(c => ({ ma_tai_lieu: c.ma_tai_lieu, so_luong: Number(c.so_luong) }))
      })
      toast.success('Lập phiếu mượn thành công!')
      setMuonModal(false)
      setMaDocGia(''); setDocGiaInfo(null); setHanTra(''); setMaDatTruoc('')
      setChiTiet([{ ma_tai_lieu: '', so_luong: 1, search: '' }])
      load()
    } finally { setSaving(false) }
  }

  const handleTra = async () => {
    try {
      await muonTraApi.traSach({ ma_phieu_muon: selectedPhieu, tinh_trang_tra: tinhTrangTra })
      toast.success('Trả sách thành công!')
      setTraModal(false); setSelectedPhieu(null)
      load()
    } catch {}
  }

  const handleGiaHan = async (ma) => {
    await muonTraApi.giaHan(ma)
    toast.success('Đã gia hạn phiếu mượn')
    load()
  }

  const openTra = (ma) => { setSelectedPhieu(ma); setTinhTrangTra('Tot'); setTraModal(true) }

  return (
    <div>
      <PageHeader
        title="Mượn / Trả sách"
        subtitle={`${items.length} phiếu`}
        action={
          <button className="btn btn-primary" onClick={() => setMuonModal(true)}>
            <Plus size={15} /> Lập phiếu mượn
          </button>
        }
      />
      <div className="px-4 sm:px-6">
        {/* Tab filter */}
        <div className="flex gap-1 mb-4 bg-surface-muted p-1 rounded-lg w-fit">
          {[['tat_ca','Tất cả'],['DANG_MUON','Đang mượn'],['CHO_TRA','Chờ trả'],['QUA_HAN','Quá hạn'],['DA_TRA','Đã trả']].map(([v,l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === v ? 'bg-surface shadow-sm text-ink' : 'text-ink-muted hover:text-ink'
              }`}
            >{l}</button>
          ))}
        </div>

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-soft border-b border-border">
              <tr>
                <th className="th">Mã phiếu</th>
                <th className="th">Độc giả</th>
                <th className="th">Ngày mượn</th>
                <th className="th">Hạn trả</th>
                <th className="th">Tài liệu</th>
                <th className="th">Trạng thái</th>
                <th className="th">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={7}><Spinner /></td></tr>
                : items.length === 0
                  ? <tr><td colSpan={7}><Empty message="Không có phiếu mượn nào" /></td></tr>
                  : items.map(pm => {
                      const tt = TT_LABEL[pm.trang_thai] || { label: pm.trang_thai, variant: 'gray' }
                      return (
                        <tr key={pm.ma_phieu_muon} className="table-row">
                          <td className="td font-mono text-xs">{pm.ma_phieu_muon}</td>
                          <td className="td font-medium">{pm.doc_gia?.ho_ten || '—'}</td>
                          <td className="td text-xs text-ink-muted">{pm.ngay_muon}</td>
                          <td className="td text-xs text-ink-muted">{pm.han_tra}</td>
                          <td className="td text-xs max-w-[200px] truncate">
                            {pm.chi_tiet?.map(ct => ct.tai_lieu?.ten_tai_lieu).filter(Boolean).join(', ') || '—'}
                          </td>
                          <td className="td"><Badge variant={tt.variant}>{tt.label}</Badge></td>
                          <td className="td">
                            {(pm.trang_thai === 'DANG_MUON' || pm.trang_thai === 'QUA_HAN')
                              ? <div className="flex gap-1">
                                  <button className="btn btn-secondary py-1 px-3 text-xs" onClick={() => openTra(pm.ma_phieu_muon)}>
                                    <RotateCcw size={12} /> Trả sách
                                  </button>
                                  <button className="btn btn-ghost py-1 px-3 text-xs" onClick={() => handleGiaHan(pm.ma_phieu_muon)}>
                                    Gia hạn
                                  </button>
                                </div>
                              : pm.trang_thai === 'CHO_TRA'
                                ? <div className="flex gap-1">
                                    <button className="btn btn-primary py-1 px-3 text-xs" onClick={() => openTra(pm.ma_phieu_muon)}>
                                      Duyệt trả
                                    </button>
                                  </div>
                                : <span className="text-xs text-ink-faint">—</span>
                            }
                          </td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal lập phiếu mượn */}
      <Modal open={muonModal} onClose={() => setMuonModal(false)} title="Lập phiếu mượn" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mã đặt trước (nếu có)">
              <div className="flex gap-2">
                <Input
                  value={maDatTruoc}
                  onChange={e => setMaDatTruoc(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && lookupDatTruoc()}
                  placeholder="VD: DT-2024..."
                />
                <button className="btn btn-secondary shrink-0" onClick={lookupDatTruoc}>Nạp</button>
              </div>
            </Field>
            <Field label="Hạn trả" required>
              <Input type="date" value={hanTra} onChange={e => setHanTra(e.target.value)}
                min={new Date().toISOString().slice(0,10)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Field label="Mã độc giả" required>
              <div className="flex gap-2">
                <Input
                  value={maDocGia}
                  onChange={e => setMaDocGia(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && lookupDocGia()}
                  placeholder="VD: DG000001"
                />
                <button className="btn btn-secondary shrink-0" onClick={lookupDocGia}>Tìm</button>
              </div>
            </Field>
          </div>

          {docGiaInfo && (
            <div className="bg-primary-light rounded-lg p-3 text-sm flex gap-6">
              <span>Độc giả: <strong>{docGiaInfo.ho_ten}</strong></span>
              <span>Thẻ: <strong className={
                (docGiaInfo.trang_thai_the?.toUpperCase() === 'CON_HIEU_LUC') ? 'text-success' : 'text-danger'
              }>
                {(docGiaInfo.trang_thai_the?.toUpperCase() === 'CON_HIEU_LUC') ? 'Còn hiệu lực' : 'Không hợp lệ'}
              </strong></span>
              {docGiaInfo.the_thu_vien && (
                <span className="text-ink-muted">Hết hạn: {docGiaInfo.the_thu_vien.ngay_het_han}</span>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Danh sách tài liệu mượn</label>
              <button className="btn btn-ghost text-xs py-1" onClick={addChiTiet}>
                <Plus size={12} /> Thêm dòng
              </button>
            </div>
            <div className="space-y-2">
              {chiTiet.map((ct, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <TaiLieuSearchInput
                    value={ct.ma_tai_lieu}
                    query={ct.search || ''}
                    items={taiLieuList}
                    onQueryChange={v => updateChiTiet(i, 'search', v)}
                    onSelect={v => updateChiTiet(i, 'ma_tai_lieu', v)}
                  />
                  <select
                    className="hidden"
                    value={ct.ma_tai_lieu}
                    onChange={e => updateChiTiet(i, 'ma_tai_lieu', e.target.value)}
                  >
                    <option value="">-- Chọn tài liệu --</option>
                    {taiLieuList.filter(tl => tl.so_luong > 0).map(tl => (
                      <option key={tl.ma_tai_lieu} value={tl.ma_tai_lieu}>
                        [{tl.ma_tai_lieu}] {tl.ten_tai_lieu} (còn {tl.so_luong})
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number" min="1" className="w-20"
                    value={ct.so_luong}
                    onChange={e => updateChiTiet(i, 'so_luong', e.target.value)}
                    style={{ width: '80px' }}
                  />
                  {chiTiet.length > 1 && (
                    <button className="btn btn-ghost text-danger py-1 px-2" onClick={() => removeChiTiet(i)}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button className="btn btn-secondary" onClick={() => setMuonModal(false)}>Hủy</button>
          <button className="btn btn-primary" onClick={handleMuon} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Xác nhận mượn'}
          </button>
        </div>
      </Modal>

      {/* Modal trả sách */}
      <Modal open={traModal} onClose={() => setTraModal(false)} title="Xác nhận trả sách" size="sm">
        <p className="text-sm text-ink-muted mb-4">
          Phiếu: <span className="font-mono font-medium text-ink">{selectedPhieu}</span>
        </p>
        <Field label="Tình trạng tài liệu khi trả">
          <select className="input" value={tinhTrangTra} onChange={e => setTinhTrangTra(e.target.value)}>
            <option value="Tot">Tốt — không hư hỏng</option>
            <option value="Cu / Ban">Cũ / Bẩn</option>
            <option value="Rach / Hong">Rách / Hỏng — cần xử lý</option>
            <option value="Mat">Mất — cần phạt bồi thường</option>
          </select>
        </Field>
        <div className="flex gap-2 justify-end mt-6">
          <button className="btn btn-secondary" onClick={() => setTraModal(false)}>Hủy</button>
          <button className="btn btn-primary" onClick={handleTra}>Xác nhận trả</button>
        </div>
      </Modal>
    </div>
  )
}
