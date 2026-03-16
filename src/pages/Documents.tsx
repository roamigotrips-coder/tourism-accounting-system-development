import { useState } from 'react';
import { Mail, FolderOpen, Trash2, Link as LinkIcon, Inbox, Plus, Settings as Cog } from 'lucide-react';
import { useAttachments, type Attachment, type EmailInRoute } from '../context/AttachmentsContext';

export default function Documents() {
  const { attachments, emailRoutes, removeAttachment, upsertEmailRoute, deleteEmailRoute } = useAttachments();
  const [tab, setTab] = useState<'inbox' | 'routes'>('inbox');

  const [routeForm, setRouteForm] = useState<EmailInRoute>({
    id: `r-${Math.random().toString(36).slice(2)}`,
    address: '',
    name: '',
    routeTo: 'inbox',
    autoLink: false,
    enabled: true,
  });

  const addRoute = () => {
    if (!routeForm.address || !routeForm.name) return;
    upsertEmailRoute(routeForm);
    setRouteForm({ id: `r-${Math.random().toString(36).slice(2)}`, address: '', name: '', routeTo: 'inbox', autoLink: false, enabled: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents & Attachments</h1>
          <p className="text-gray-600">Upload files, manage Email-In routes, and link documents to records</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('inbox')} className={`px-3 py-1.5 rounded ${tab==='inbox'?'bg-emerald-600 text-white':'bg-gray-100'}`}><Inbox size={16} className="inline mr-1"/> Inbox</button>
          <button onClick={() => setTab('routes')} className={`px-3 py-1.5 rounded ${tab==='routes'?'bg-emerald-600 text-white':'bg-gray-100'}`}><Cog size={16} className="inline mr-1"/> Email-In Routes</button>
        </div>
      </div>

      {tab === 'routes' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Mail size={16}/> Configure Route</h3>
            <div className="space-y-2">
              <input value={routeForm.name} onChange={e=>setRouteForm({...routeForm,name:e.target.value})} placeholder="Route name (e.g. Invoices Inbox)" className="w-full border rounded px-3 py-2"/>
              <input value={routeForm.address} onChange={e=>setRouteForm({...routeForm,address:e.target.value})} placeholder="Email address (e.g. invoices@inbox.accountspro.app)" className="w-full border rounded px-3 py-2"/>
              <div className="grid grid-cols-2 gap-2">
                <select value={routeForm.routeTo} onChange={e=>setRouteForm({...routeForm,routeTo:e.target.value as any})} className="border rounded px-3 py-2">
                  <option value="inbox">Inbox (unrouted)</option>
                  <option value="invoices">Invoices</option>
                  <option value="journal">Journal</option>
                  <option value="expenses">Expenses</option>
                  <option value="bookings">Bookings</option>
                </select>
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!routeForm.autoLink} onChange={e=>setRouteForm({...routeForm,autoLink:e.target.checked})}/> Auto-link to detected record</label>
              </div>
              <div className="flex gap-2">
                <button onClick={addRoute} className="px-3 py-1.5 bg-emerald-600 text-white rounded flex items-center gap-1"><Plus size={14}/> Save Route</button>
                <button onClick={()=>setRouteForm({ id: `r-${Math.random().toString(36).slice(2)}`, address: '', name: '', routeTo: 'inbox', autoLink: false, enabled: true })} className="px-3 py-1.5 bg-gray-100 rounded">Reset</button>
              </div>
            </div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><FolderOpen size={16}/> Existing Routes</h3>
            <div className="space-y-2">
              {emailRoutes.map(r => (
                <div key={r.id} className="border rounded p-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.address} · Route to: {r.routeTo}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs inline-flex items-center gap-1"><input type="checkbox" checked={r.enabled} onChange={e=>upsertEmailRoute({...r,enabled:e.target.checked})}/> Enabled</label>
                    <button onClick={()=>deleteEmailRoute(r.id)} className="text-red-600 text-sm"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">File</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Linked To</th>
                <th className="px-3 py-2 text-left">Uploaded</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {attachments.map((a: Attachment) => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{a.fileName}</div>
                    <div className="text-xs text-gray-500">{a.mimeType} · {Math.round((a.size||0)/1024)} KB</div>
                    {a.ocrText && <div className="text-xs text-gray-400 line-clamp-1">OCR: {a.ocrText.slice(0,120)}…</div>}
                  </td>
                  <td className="px-3 py-2 capitalize">{a.source}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
                        <LinkIcon size={12}/> {a.module} · {a.documentId}
                      </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{new Date(a.uploadedAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={()=>removeAttachment(a.id)} className="text-red-600 text-sm inline-flex items-center gap-1"><Trash2 size={14}/> Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick simulate email in for demo */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        Tip: You can also attach documents directly inside Invoices and Journal Entries using the drag-and-drop uploader. Use Email-In routes to let suppliers and agents email bills and receipts straight into AccountsPro.
      </div>
    </div>
  );
}
