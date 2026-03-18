export function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        {message && <p className="text-sm text-slate-400 font-medium">{message}</p>}
      </div>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
      <span className="text-red-700 text-sm">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-red-600 text-sm underline hover:text-red-800">
          Retry
        </button>
      )}
    </div>
  );
}
