import { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { testConnection } from '../lib/supabaseSync';

type Status = 'checking' | 'connected' | 'disconnected';

export default function ConnectionStatus() {
  const [status, setStatus] = useState<Status>('checking');
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    setStatus('checking');
    const ok = await testConnection();
    setStatus(ok ? 'connected' : 'disconnected');
  }, []);

  useEffect(() => {
    check();
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [check]);

  const dot =
    status === 'checking'   ? 'bg-amber-400 animate-pulse' :
    status === 'connected'  ? 'bg-emerald-500' :
                              'bg-red-500';

  const label =
    status === 'checking'   ? 'Checking...' :
    status === 'connected'  ? 'Database connected' :
                              'Database offline';

  return (
    <>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 cursor-default" title={label}>
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {status === 'disconnected' && <span className="text-red-500 font-medium">Offline</span>}
      </div>

      {status === 'disconnected' && !dismissed && (
        <div className="fixed top-0 left-0 right-0 z-[9998] bg-red-600 text-white text-sm px-4 py-2 flex items-center justify-center gap-3">
          <WifiOff size={14} />
          <span>Database connection failed — data will not be saved.</span>
          <button onClick={check} className="flex items-center gap-1 underline hover:opacity-80">
            <RefreshCw size={12} /> Retry
          </button>
          <button onClick={() => setDismissed(true)} className="ml-4 opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}
    </>
  );
}
