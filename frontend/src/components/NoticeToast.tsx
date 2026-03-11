import { useNotice } from '../contexts/NoticeContext'

export function NoticeToast() {
  const { notices, dismissNotice } = useNotice()

  if (notices.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[70] flex flex-col gap-2 max-w-md">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {notices.map((notice) => {
        const isSuccess = notice.type === 'success'
        const colorClasses = isSuccess
          ? 'border-emerald-300 bg-emerald-300 text-emerald-950'
          : 'border-red-400 bg-red-400 text-red-950'

        return (
          <div
            key={notice.id}
            role="status"
            aria-live="polite"
            className={`relative rounded-lg border px-4 py-3 pr-10 text-sm shadow-xl ${colorClasses}`}
            style={{ animation: 'fadeSlideIn 0.2s ease-out' }}
          >
            {notice.message}
            <button
              type="button"
              onClick={() => dismissNotice(notice.id)}
              className="absolute right-2 top-2 rounded p-0.5 opacity-70 hover:opacity-100 transition"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
