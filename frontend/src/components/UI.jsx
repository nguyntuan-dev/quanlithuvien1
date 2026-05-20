import { X } from 'lucide-react'

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  if (!open) return null
  const w = { sm:'max-w-sm', md:'max-w-lg', lg:'max-w-2xl', xl:'max-w-4xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${w} max-h-[94vh] bg-surface rounded-xl shadow-dialog flex flex-col sm:max-h-[90vh] sm:rounded-2xl`}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0 sm:px-6 sm:py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost p-1"><X size={16}/></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 sm:p-6">{children}</div>
        {footer && (
          <div className="px-4 py-3 border-t border-border shrink-0 bg-surface rounded-b-xl sm:px-6 sm:py-4 sm:rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-5 pb-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:pt-6">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 sm:pt-0">{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, sub, color = 'default', icon: Icon }) {
  const colors = {
    default: 'text-ink',
    blue:    'text-primary',
    green:   'text-success',
    red:     'text-danger',
    yellow:  'text-warning',
  }
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {Icon && <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center">
          <Icon size={15} className="text-ink-muted"/>
        </div>}
      </div>
      <div className={`text-2xl font-semibold sm:text-3xl ${colors[color]}`}>{value}</div>
      {sub && <div className="text-xs text-ink-faint mt-1">{sub}</div>}
    </div>
  )
}

export function Badge({ variant = 'gray', children, className }) {
  return (
    <span className={['badge', `badge-${variant}`, className].filter(Boolean).join(' ')}>
      {children}
    </span>
  )
}

export function Field({ label, children, required }) {
  return (
    <div>
      <label className="label">{label}{required && <span className="text-danger ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

export function Input({ ...props }) {
  return <input className="input" {...props} />
}

export function Select({ children, ...props }) {
  return <select className="input" {...props}>{children}</select>
}

export function Textarea({ ...props }) {
  return <textarea className="input resize-none" rows={3} {...props} />
}

export function Empty({ message = 'Không có dữ liệu' }) {
  return (
    <div className="flex flex-col items-center py-16 text-ink-faint">
      <div className="text-4xl mb-3">📭</div>
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"/>
    </div>
  )
}

export function SearchBar({ value, onChange, placeholder, children }) {
  return (
    <div className="flex flex-col gap-2 mb-4 sm:flex-row">
      <input
        className="input flex-1"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Tìm kiếm...'}
      />
      {children}
    </div>
  )
}

export function Confirm({ open, onClose, onConfirm, title, message }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-ink-muted mb-6">{message}</p>
      <div className="flex gap-2 justify-end">
        <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
        <button className="btn btn-danger" onClick={() => { onConfirm(); onClose() }}>Xác nhận</button>
      </div>
    </Modal>
  )
}
