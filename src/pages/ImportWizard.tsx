import { useState } from 'react';
import { Upload, FileSpreadsheet, FileText, Users, BookOpen, ChevronRight, CheckCircle, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportPreview {
  headers: string[];
  rows: any[];
}

type Step = 'select' | 'map' | 'preview' | 'import' | 'done';

type Dataset = 'accounts' | 'contacts' | 'invoices' | 'journal';

export default function ImportWizard() {
  const [step, setStep] = useState<Step>('select');
  const [dataset, setDataset] = useState<Dataset>('accounts');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importedCount, setImportedCount] = useState(0);

  const onFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const headers = Object.keys(rows[0] || {});
      setPreview({ headers, rows: rows.slice(0, 50) });
      setStep('map');
    };
    reader.readAsArrayBuffer(file);
  };

  const templateFor = (ds: Dataset) => {
    const map: Record<Dataset, string[]> = {
      accounts: ['code', 'name', 'type', 'parentCode', 'description', 'status', 'openingBalance'],
      contacts: ['type', 'name', 'email', 'phone', 'country'],
      invoices: ['id', 'type', 'party', 'amount', 'vat', 'total', 'currency', 'date', 'dueDate', 'status'],
      journal: ['entryNumber', 'date', 'description', 'reference', 'accountCode', 'debit', 'credit'],
    };
    const ws = XLSX.utils.aoa_to_sheet([map[ds]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${ds}_template.xlsx`);
  };

  const applyImport = () => {
    // In this MVP, we simply count imported rows
    const count = preview?.rows.length || 0;
    setImportedCount(count);
    setStep('done');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Switch from Zoho — Import Wizard</h1>
          <p className="text-slate-600 mt-1">Import your core data via CSV/XLSX in a few simple steps</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2 text-sm text-slate-500">
          <span className={`px-2 py-1 rounded ${step !== 'select' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100'}`}>1. Choose Dataset</span>
          <ChevronRight size={14} />
          <span className={`px-2 py-1 rounded ${step === 'map' || step === 'preview' || step === 'import' || step === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100'}`}>2. Map Columns</span>
          <ChevronRight size={14} />
          <span className={`px-2 py-1 rounded ${step === 'preview' || step === 'import' || step === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100'}`}>3. Preview</span>
          <ChevronRight size={14} />
          <span className={`px-2 py-1 rounded ${step === 'import' || step === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100'}`}>4. Import</span>
          <ChevronRight size={14} />
          <span className={`px-2 py-1 rounded ${step === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100'}`}>5. Done</span>
        </div>

        {step === 'select' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { id: 'accounts', label: 'Chart of Accounts', icon: BookOpen },
                { id: 'contacts', label: 'Agents & Suppliers', icon: Users },
                { id: 'invoices', label: 'Invoices', icon: FileText },
                { id: 'journal', label: 'Journal Entries', icon: FileSpreadsheet },
              ].map((it) => (
                <button key={it.id} onClick={() => setDataset(it.id as Dataset)} className={`border rounded-xl p-4 flex flex-col items-center gap-2 ${dataset === it.id ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200'}`}>
                  <it.icon size={28} className="text-slate-600" />
                  <span className="font-semibold text-slate-800">{it.label}</span>
                </button>
              ))}
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-sm text-slate-600">Upload CSV/XLSX exported from Zoho Books for the selected dataset. You can download our template to format columns correctly.</p>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => templateFor(dataset)} className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm hover:bg-slate-50"><Download size={16} /> Download Template</button>
                <label className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 cursor-pointer">
                  <Upload size={16} /> Choose File
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files && onFile(e.target.files[0])} />
                </label>
                {fileName && <span className="text-sm text-slate-600">Selected: <strong>{fileName}</strong></span>}
              </div>
            </div>
          </div>
        )}

        {step === 'map' && preview && (
          <div className="p-6 space-y-5">
            <h3 className="font-semibold">Map your columns</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {preview.headers.map((h) => (
                <div key={h} className="flex items-center gap-2">
                  <span className="w-48 text-sm text-slate-600 truncate">{h}</span>
                  <ChevronRight size={14} className="text-slate-400" />
                  <select value={mapping[h] || ''} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })} className="px-2 py-1 border rounded-lg text-sm">
                    <option value="">Ignore</option>
                    {templateFor as any}
                    { (dataset === 'accounts' ? ['code','name','type','parentCode','description','status','openingBalance']
                    : dataset === 'contacts' ? ['type','name','email','phone','country']
                    : dataset === 'invoices' ? ['id','type','party','amount','vat','total','currency','date','dueDate','status']
                    : ['entryNumber','date','description','reference','accountCode','debit','credit']).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStep('select')} className="px-4 py-2 border rounded-lg text-sm">Back</button>
              <button onClick={() => setStep('preview')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Next</button>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="p-6 space-y-4">
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {preview.headers.map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 20).map((r, idx) => (
                    <tr key={idx} className="border-t">
                      {preview.headers.map(h => <td key={h} className="px-3 py-2">{String(r[h])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStep('map')} className="px-4 py-2 border rounded-lg text-sm">Back</button>
              <button onClick={() => setStep('import')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Import</button>
            </div>
          </div>
        )}

        {step === 'import' && (
          <div className="p-10 text-center text-slate-600 space-y-3">
            <FileSpreadsheet size={38} className="mx-auto text-emerald-600" />
            <p>Importing your data…</p>
            <button onClick={() => applyImport()} className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm">Finish</button>
          </div>
        )}

        {step === 'done' && (
          <div className="p-10 text-center text-slate-600 space-y-3">
            <CheckCircle size={38} className="mx-auto text-emerald-600" />
            <p>Imported <strong>{importedCount}</strong> rows successfully.</p>
            <p className="text-sm">You can verify results under relevant modules (Chart of Accounts, Invoices, Journal Entries).</p>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm flex items-start gap-2">
        <AlertCircle size={16} />
        <p>This is an MVP import. In production, we will map and validate columns strictly and write imported data to the database with conflict handling.</p>
      </div>
    </div>
  );
}
