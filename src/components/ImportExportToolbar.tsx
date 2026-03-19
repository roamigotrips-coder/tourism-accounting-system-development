import { useState } from 'react';
import { Download, Upload, FileSpreadsheet, Printer, X } from 'lucide-react';

interface ImportExportToolbarProps {
  onExportCSV?: () => void;
  onExportExcel?: () => void;
  onImport?: (file: File) => void;
  onPrint?: () => void;
  entityName?: string;
}

export default function ImportExportToolbar({ onExportCSV, onExportExcel, onImport, onPrint, entityName = 'data' }: ImportExportToolbarProps) {
  const [showImport, setShowImport] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File) => {
    if (onImport) { onImport(file); setShowImport(false); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <>
      <div className="flex items-center gap-1">
        {onImport && (
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors" title="Import">
            <Upload size={13} /> Import
          </button>
        )}
        {onExportCSV && (
          <button onClick={onExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" title="Export CSV">
            <Download size={13} /> CSV
          </button>
        )}
        {onExportExcel && (
          <button onClick={onExportExcel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors" title="Export Excel">
            <FileSpreadsheet size={13} /> Excel
          </button>
        )}
        {onPrint && (
          <button onClick={onPrint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Print">
            <Printer size={13} /> Print
          </button>
        )}
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Import {entityName}</h3>
              <button onClick={() => setShowImport(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'}`}
            >
              <Upload size={32} className={`mx-auto mb-3 ${dragOver ? 'text-emerald-500' : 'text-slate-300'}`} />
              <p className="text-sm text-slate-600 font-medium mb-1">Drag & drop a file here</p>
              <p className="text-xs text-slate-400 mb-3">CSV or Excel files supported</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-emerald-700">
                <Upload size={14} /> Browse Files
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center">First row must contain column headers matching the expected format</p>
          </div>
        </div>
      )}
    </>
  );
}
