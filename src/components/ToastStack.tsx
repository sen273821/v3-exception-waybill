export type ToastTone = 'info' | 'success' | 'error'

export interface ToastItem {
  id: string
  title: string
  description?: string
  tone: ToastTone
}

interface ToastStackProps {
  toasts: ToastItem[]
  onRemove: (id: string) => void
}

export default function ToastStack({ toasts, onRemove }: ToastStackProps) {
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-card toast-${toast.tone}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-sm text-[var(--text)]">{toast.title}</div>
              {toast.description && (
                <div className="text-xs text-[var(--text-muted)] mt-1">{toast.description}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRemove(toast.id)}
              className="text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
