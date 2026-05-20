import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { taiLieuApi, datTruocApi, yeuThichApi } from '../services/api'
import { PageHeader, Modal, Badge, Spinner, Empty, SearchBar } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { Eye, Search, Heart } from 'lucide-react'

function coverStyle(item, index) {
  const palettes = [
    ['#d84a2b', '#ffefc9', '#111827'],
    ['#1f6f5b', '#e6f4ed', '#10251f'],
    ['#243b6b', '#f3d176', '#111827'],
    ['#f2c84b', '#fff6c7', '#2c2c2c'],
    ['#2f4858', '#b8d8d8', '#172026'],
    ['#8f3b46', '#f6d7d7', '#221214'],
  ]
  const [base, accent, ink] = palettes[index % palettes.length]
  return {
    background: `linear-gradient(160deg, ${accent} 0%, ${accent} 38%, ${base} 39%, ${base} 100%)`,
    color: ink,
  }
}

export default function CatalogPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [favorites, setFavorites] = useState(new Set())
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const isReader = user?.vai_tro === 'doc_gia'

  const loadData = async () => {
    setLoading(true)
    try {
      const [booksRes, favsRes] = await Promise.all([
        taiLieuApi.list({ q }),
        isReader ? yeuThichApi.list() : Promise.resolve({ data: [] })
      ])
      setItems(booksRes.data)
      if (isReader) {
        setFavorites(new Set(favsRes.data.map(f => f.ma_tai_lieu)))
      }
    } catch (err) {
      console.error(err)
      toast.error('Không thể tải danh sách sách')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [q])

  const categories = useMemo(() => {
    const map = new Map()
    items.forEach(item => {
      const name = item.the_loai?.ten_the_loai || 'Chưa phân loại'
      map.set(name, (map.get(name) || 0) + 1)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'vi'))
  }, [items])

  const visibleItems = useMemo(() => {
    if (category === 'all') return items
    return items.filter(item => (item.the_loai?.ten_the_loai || 'Chưa phân loại') === category)
  }, [items, category])

  const reserveBook = async (item) => {
    setBusyId(item.ma_tai_lieu)
    try {
      await datTruocApi.create({
        ma_doc_gia: user.ma_doc_gia,
        ma_tai_lieu: item.ma_tai_lieu,
      })
      toast.success('Đã đặt chỗ sách')
      loadData() // Tải lại để cập nhật trạng thái
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Lỗi khi đặt chỗ')
    } finally {
      setBusyId(null)
    }
  }

  const toggleFavorite = async (ma) => {
    const isFav = favorites.has(ma)
    try {
      if (isFav) {
        await yeuThichApi.remove(ma)
        setFavorites(prev => {
          const next = new Set(prev)
          next.delete(ma)
          return next
        })
      } else {
        await yeuThichApi.add(ma)
        setFavorites(prev => new Set([...prev, ma]))
        toast.success('Đã thêm vào yêu thích', { icon: '❤️' })
      }
    } catch (err) {
      toast.error('Lỗi khi cập nhật yêu thích')
    }
  }

  if (isReader) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Kho sách</h1>
            <p className="text-xs text-[#8c857b]">Tìm sách, xem chi tiết và đặt chỗ</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa49a]" />
            <input
              className="h-10 w-full border border-[#ece8dc] bg-white pl-9 pr-3 text-xs outline-none transition focus:border-[#d8c981]"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Tên sách, tác giả, chủ đề..."
            />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[170px_1fr]">
          <aside className="hidden lg:block">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide">Thể loại</h2>
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`block w-full py-1.5 text-left text-[11px] uppercase tracking-wide ${category === 'all' ? 'font-bold text-[#d8a900]' : 'text-[#6f6a63] hover:text-[#1f1f1f]'}`}
            >
              Tất cả ({items.length})
            </button>
            {categories.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategory(name)}
                className={`block w-full py-1.5 text-left text-[11px] uppercase tracking-wide ${category === name ? 'font-bold text-[#d8a900]' : 'text-[#6f6a63] hover:text-[#1f1f1f]'}`}
              >
                {name} ({count})
              </button>
            ))}
          </aside>

          <section>
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={`shrink-0 border px-3 py-1.5 text-[11px] font-semibold uppercase ${category === 'all' ? 'border-[#d8c981] bg-[#d8c981] text-white' : 'border-[#ece8dc] bg-white text-[#6f6a63]'}`}
              >
                Tat ca ({items.length})
              </button>
              {categories.map(([name, count]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setCategory(name)}
                  className={`shrink-0 border px-3 py-1.5 text-[11px] font-semibold uppercase ${category === name ? 'border-[#d8c981] bg-[#d8c981] text-white' : 'border-[#ece8dc] bg-white text-[#6f6a63]'}`}
                >
                  {name} ({count})
                </button>
              ))}
            </div>
            {loading ? <Spinner />
              : visibleItems.length === 0 ? <Empty message="Không tìm thấy sách phù hợp" />
                : (
                  <div className="keep-mobile-cols grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-5 sm:gap-y-8 md:grid-cols-3 xl:grid-cols-4">
                    {visibleItems.map((item, index) => {
                      const available = Number(item.so_luong || 0) > 0
                      const busy = busyId === item.ma_tai_lieu
                      const isFav = favorites.has(item.ma_tai_lieu)
                      return (
                        <article key={item.ma_tai_lieu} className="group relative">
                          <button
                            type="button"
                            onClick={() => setSelected(item)}
                            className="block w-full text-left"
                          >
                            <div className="aspect-[3/4.25] w-full overflow-hidden bg-white shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md" style={item.anh_bia ? undefined : coverStyle(item, index)}>
                              {item.anh_bia ? (
                                <img src={item.anh_bia} alt={item.ten_tai_lieu} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full flex-col justify-between p-4">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
                                    {item.the_loai?.ten_the_loai || 'DUTLibrary'}
                                  </div>
                                  <div>
                                    <div className="text-lg font-black uppercase leading-tight tracking-wide">
                                      {item.ten_tai_lieu}
                                    </div>
                                    <div className="mt-3 h-1 w-10 bg-current opacity-50" />
                                  </div>
                                  <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
                                    {item.tac_gia?.ten_tac_gia || 'Chưa rõ tác giả'}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="mt-3">
                              <div className="truncate text-xs font-semibold uppercase">{item.ten_tai_lieu}</div>
                              <div className="mt-1 truncate text-[11px] text-[#827c72]">{item.tac_gia?.ten_tac_gia || 'Chưa rõ tác giả'}</div>
                              <div className="mt-1 text-[11px] font-medium">
                                {available ? <span className="text-success">Còn sách</span> : <span className="text-danger">Hết sách</span>}
                              </div>
                            </div>
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(item.ma_tai_lieu) }}
                            className={`absolute top-2 right-2 p-1.5 rounded-full shadow-md transition-all z-10 ${isFav ? 'bg-danger text-white scale-110 opacity-100' : 'bg-white/90 text-ink-faint hover:text-danger hover:scale-110 lg:opacity-0 lg:group-hover:opacity-100'}`}
                          >
                            <Heart size={14} fill={isFav ? 'currentColor' : 'none'} />
                          </button>

                          <div className="mt-3">
                            <button
                              type="button"
                              className="w-full border border-[#ded7c9] bg-white px-2 py-2 text-[11px] font-semibold uppercase transition hover:bg-[#f2eee2]"
                              disabled={busy}
                              onClick={() => reserveBook(item)}
                            >
                              Đặt chỗ
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
          </section>
        </div>

        <BookDetailModal selected={selected} onClose={() => setSelected(null)} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Tra cứu sách" subtitle="Tìm theo tên sách, tác giả hoặc chủ đề" />
      <div className="px-4 sm:px-6">
        <SearchBar value={q} onChange={setQ} placeholder="Tên sách, tác giả, chủ đề..." />
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-soft border-b border-border">
              <tr>
                <th className="th">Mã</th>
                <th className="th">Tên sách</th>
                <th className="th">Tác giả</th>
                <th className="th">Chủ đề</th>
                <th className="th">Còn</th>
                <th className="th">Trạng thái</th>
                <th className="th">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7}><Spinner /></td></tr>
                : items.length === 0 ? <tr><td colSpan={7}><Empty /></td></tr>
                  : items.map(item => (
                    <tr key={item.ma_tai_lieu} className="table-row">
                      <td className="td font-mono text-xs">{item.ma_tai_lieu}</td>
                      <td className="td font-medium">{item.ten_tai_lieu}</td>
                      <td className="td">{item.tac_gia?.ten_tac_gia || '-'}</td>
                      <td className="td">{item.the_loai?.ten_the_loai || '-'}</td>
                      <td className="td">{item.so_luong}</td>
                      <td className="td"><Badge>{item.tinh_trang}</Badge></td>
                      <td className="td">
                        <button className="btn btn-secondary py-1 px-3 text-xs" onClick={() => setSelected(item)}>
                          <Eye size={12} /> Xem
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
      <BookDetailModal selected={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function BookDetailModal({ selected, onClose }) {
  return (
    <Modal open={!!selected} onClose={onClose} title="Chi tiết sách" size="md">
      {selected && (
        <div className="space-y-2 text-sm">
          <div><strong>{selected.ten_tai_lieu}</strong></div>
          {selected.anh_bia && (
            <img src={selected.anh_bia} alt={selected.ten_tai_lieu} className="mb-3 aspect-[3/4] w-32 rounded border border-border object-cover" />
          )}
          <div>Mã: <span className="font-mono">{selected.ma_tai_lieu}</span></div>
          <div>Tác giả: {selected.tac_gia?.ten_tac_gia || '-'}</div>
          <div>Chủ đề: {selected.the_loai?.ten_the_loai || '-'}</div>
          <div>Nhà xuất bản: {selected.nha_xuat_ban?.ten_nxb || '-'}</div>
          <div>Năm xuất bản: {selected.nam_xuat_ban || '-'}</div>
          <div>Giá: {Number(selected.gia || 0).toLocaleString('vi-VN')}đ</div>
          <div>Vị trí: {selected.vi_tri || '-'}</div>
          <div className="text-ink-muted whitespace-pre-wrap">{selected.mo_ta || 'Chưa có mô tả'}</div>
        </div>
      )}
    </Modal>
  )
}
