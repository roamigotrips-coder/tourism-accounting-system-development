import { X, Trash2, Download, Tag, CheckSquare } from 'lucide-react';

interface BatchOperationsBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  onTag?: () => void;
  onStatusChange?: (status: string) => void;
  statuses?: string[];
  entityName?: string;
}

export default function BatchOperationsBar({ selectedCount, onClear, onDelete, onExport, onTag, onStatusChange, statuses, entityName = 'items' }: BatchOperationsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-40 mx-4 mb-4">
      <div className="bg-slate-800 text-white rounded-xl px-5 py-3 flex items-center justify-between shadow-2xl border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-emerald-400" />
            <span className="text-sm font-medium">{selectedCount} {entityName} selected</span>
          </div>
          <button onClick={onClear} className="text-slate-400 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        <div className="flex items-center gap-2">
          {onExport && (
            <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors">
              <Download size={13} /> Export
            </button>
          )}
          {onTag && (
            <button onClick={onTag} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors">
              <Tag size={13} /> Tag
            </button>
          )}
          {statuses && onStatusChange && (
            <select
              onChange={e => { if (e.target.value) onStatusChange(e.target.value); }}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium text-white border-none outline-none cursor-pointer"
              defaultValue=""
            >
              <option value="" disabled>Change Status</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {onDelete && (
            <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-medium transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
