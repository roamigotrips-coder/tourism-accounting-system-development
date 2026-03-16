import React, { useRef, useState, useCallback } from 'react';
import {
  Paperclip, Upload, X, Eye, Download, FileText, Image, File,
  MessageSquare, Tag, Trash2, Plus, Mail, Clock, User,
  CheckCircle, AlertCircle, Loader, ChevronDown, ChevronUp, Search
} from 'lucide-react';
import { useAttachments, Attachment, AttachmentModule } from '../context/AttachmentsContext';
import { createWorker } from 'tesseract.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return `att-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
const CURRENT_USER = 'Admin User';

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-AE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const MIME_ICONS: Record<string, React.ReactNode> = {
  'application/pdf':                              <FileText size={18} className="text-red-500" />,
  'image/jpeg':                                   <Image size={18} className="text-blue-500" />,
  'image/png':                                    <Image size={18} className="text-blue-500" />,
  'image/gif':                                    <Image size={18} className="text-blue-500" />,
  'application/vnd.ms-excel':                     <FileText size={18} className="text-green-600" />,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': <FileText size={18} className="text-green-600" />,
};
function getMimeIcon(mime: string) { return MIME_ICONS[mime] || <File size={18} className="text-slate-400" />; }

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const ALLOWED_LABEL = 'PDF, JPG, PNG, Excel (.xlsx/.xls)';

// ─── OCR ─────────────────────────────────────────────────────────────────────

async function runOCR(dataUrl: string): Promise<string> {
  try {
    const worker = await createWorker('eng');
    const result = await worker.recognize(dataUrl);
    await worker.terminate();
    return result.data.text || '';
  } catch { return ''; }
}

async function readDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilePreviewModal({ att, onClose }: { att: Attachment; onClose: () => void }) {
  const isImage = att.mimeType.startsWith('image/');
  const isPdf   = att.mimeType === 'application/pdf';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            {getMimeIcon(att.mimeType)}
            <span className="font-semibold text-slate-700 text-sm truncate max-w-xs">{att.fileName}</span>
            <span className="text-xs text-slate-400">{fmtSize(att.size)}</span>
          </div>
          <div className="flex items-center gap-2">
            {att.dataUrl && (
              <a href={att.dataUrl} download={att.fileName}
                 className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                <Download size={13} /> Download
              </a>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"><X size={18} /></button>
          </div>
        </div>

        {/* Preview body */}
        <div className="flex-1 overflow-auto p-4 bg-slate-100 flex flex-col gap-4">
          {att.dataUrl ? (
            isImage ? (
              <img src={att.dataUrl} alt={att.fileName} className="max-w-full mx-auto rounded-xl shadow object-contain max-h-[60vh]" />
            ) : isPdf ? (
              <iframe src={att.dataUrl} title={att.fileName} className="w-full rounded-xl" style={{ height: '60vh' }} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                {getMimeIcon(att.mimeType)}
                <p className="mt-3 text-sm">Preview not available for this file type.</p>
                <a href={att.dataUrl} download={att.fileName}
                   className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2">
                  <Download size={14} /> Download File
                </a>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              {getMimeIcon(att.mimeType)}
              <p className="mt-3 text-sm">File data not available (email-in simulation).</p>
            </div>
          )}

          {/* OCR Result */}
          {att.ocrText && att.ocrText.trim() && (
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={14} className="text-amber-500" />
                <span className="text-xs font-bold text-slate-500 uppercase">OCR Extracted Text</span>
              </div>
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                {att.ocrText}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main AttachmentPanel ─────────────────────────────────────────────────────

export interface AttachmentPanelProps {
  module: AttachmentModule;
  documentId: string;
  title?: string;
  compact?: boolean;       // show only count + expand button
  allowEmailIn?: boolean;
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;   // 0-100
  status: 'uploading' | 'ocr' | 'done' | 'error';
  error?: string;
}

export default function AttachmentPanel({
  module, documentId, title = 'Attachments', compact = false, allowEmailIn = false
}: AttachmentPanelProps) {
  const { addAttachment, removeAttachment, addNote, removeNote, addTag, removeTag, getByDocument, emailRoutes, simulateEmailIn } = useAttachments();
  const attachments = getByDocument(module, documentId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]         = useState(false);
  const [uploading, setUploading]       = useState<UploadingFile[]>([]);
  const [previewAtt, setPreviewAtt]     = useState<Attachment | null>(null);
  const [noteInput, setNoteInput]       = useState<Record<string, string>>({});
  const [tagInput, setTagInput]         = useState<Record<string, string>>({});
  const [expanded, setExpanded]         = useState(!compact);
  const [searchQ, setSearchQ]           = useState('');
  const [expandedAtts, setExpandedAtts] = useState<Set<string>>(new Set());
  const [emailRoute, setEmailRoute]     = useState(emailRoutes[0]?.id || '');
  const [emailSuccess, setEmailSuccess] = useState(false);

  const toggleAtt = (id: string) => setExpandedAtts(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const processFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`❌ File type not allowed: ${file.name}\nAllowed: ${ALLOWED_LABEL}`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        alert(`❌ File too large: ${file.name} (max 20 MB)`);
        continue;
      }

      const fid = uid();
      setUploading(prev => [...prev, { id: fid, name: file.name, progress: 20, status: 'uploading' }]);

      try {
        const dataUrl = await readDataUrl(file);
        setUploading(prev => prev.map(u => u.id === fid ? { ...u, progress: 60 } : u));

        let ocrText = '';
        if (file.type.startsWith('image/')) {
          setUploading(prev => prev.map(u => u.id === fid ? { ...u, status: 'ocr', progress: 75 } : u));
          ocrText = await runOCR(dataUrl);
        }

        setUploading(prev => prev.map(u => u.id === fid ? { ...u, progress: 95 } : u));

        addAttachment({
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          dataUrl,
          ocrText,
          uploadedBy: CURRENT_USER,
          source: 'upload',
          module,
          documentId,
          tags: [],
        });

        setUploading(prev => prev.map(u => u.id === fid ? { ...u, progress: 100, status: 'done' } : u));
        setTimeout(() => setUploading(prev => prev.filter(u => u.id !== fid)), 1500);
      } catch (err) {
        setUploading(prev => prev.map(u => u.id === fid ? { ...u, status: 'error', error: String(err) } : u));
        setTimeout(() => setUploading(prev => prev.filter(u => u.id !== fid)), 4000);
      }
    }
  }, [addAttachment, module, documentId]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleEmailIn = () => {
    const att = simulateEmailIn(emailRoute, module, documentId);
    if (att) { setEmailSuccess(true); setTimeout(() => setEmailSuccess(false), 3000); }
  };

  const filteredAtts = attachments.filter(a =>
    !searchQ || a.fileName.toLowerCase().includes(searchQ.toLowerCase()) ||
    a.tags.some(t => t.toLowerCase().includes(searchQ.toLowerCase())) ||
    a.ocrText?.toLowerCase().includes(searchQ.toLowerCase())
  );

  const count = attachments.length;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100 cursor-pointer select-none"
        onClick={() => setExpanded(p => !p)}
      >
        <div className="flex items-center gap-2">
          <Paperclip size={16} className="text-slate-500" />
          <span className="font-semibold text-slate-700 text-sm">{title}</span>
          {count > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
          >
            <Upload size={12} /> Upload
          </button>
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* ── Drop Zone ── */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
              dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.gif,.xlsx,.xls"
              className="hidden"
              onChange={e => processFiles(e.target.files)}
            />
            <Upload size={22} className={`mx-auto mb-2 ${dragging ? 'text-blue-500' : 'text-slate-300'}`} />
            <p className="text-sm font-medium text-slate-600">
              {dragging ? 'Drop files here' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-xs text-slate-400 mt-1">{ALLOWED_LABEL} · Max 20 MB each</p>
          </div>

          {/* ── Upload Progress ── */}
          {uploading.map(u => (
            <div key={u.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              {u.status === 'error'
                ? <AlertCircle size={16} className="text-red-500 shrink-0" />
                : u.status === 'done'
                ? <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                : <Loader size={16} className="text-blue-500 animate-spin shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-slate-700 truncate">{u.name}</span>
                  <span className="text-xs text-slate-400 ml-2">
                    {u.status === 'ocr' ? 'Running OCR...' : u.status === 'done' ? 'Done' : u.status === 'error' ? 'Error' : `${u.progress}%`}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1">
                  <div
                    className={`h-1 rounded-full transition-all ${u.status === 'error' ? 'bg-red-400' : u.status === 'done' ? 'bg-emerald-400' : 'bg-blue-400'}`}
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
                {u.error && <p className="text-xs text-red-500 mt-0.5">{u.error}</p>}
              </div>
            </div>
          ))}

          {/* ── Email-In ── */}
          {allowEmailIn && emailRoutes.filter(r => r.enabled).length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Mail size={16} className="text-amber-600 shrink-0" />
              <select
                value={emailRoute}
                onChange={e => setEmailRoute(e.target.value)}
                className="flex-1 border border-amber-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none"
              >
                {emailRoutes.filter(r => r.enabled).map(r => (
                  <option key={r.id} value={r.id}>{r.name} — {r.address}</option>
                ))}
              </select>
              <button
                onClick={handleEmailIn}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  emailSuccess ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                {emailSuccess ? '✓ Received' : 'Simulate Email-In'}
              </button>
            </div>
          )}

          {/* ── Search ── */}
          {attachments.length > 2 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search attachments, tags, OCR text..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          )}

          {/* ── Attachment List ── */}
          {filteredAtts.length === 0 && uploading.length === 0 && (
            <div className="text-center py-6 text-slate-400">
              <Paperclip size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">{searchQ ? 'No attachments match your search.' : 'No attachments yet. Upload a file above.'}</p>
            </div>
          )}

          <div className="space-y-3">
            {filteredAtts.map(att => (
              <div key={att.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:border-slate-300 transition-colors">
                {/* ── File Header ── */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="shrink-0">{getMimeIcon(att.mimeType)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 truncate">{att.fileName}</span>
                      {att.source === 'email-in' && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                          <Mail size={10} /> Email-In
                        </span>
                      )}
                      {att.ocrText && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                          <FileText size={10} /> OCR
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-400">{fmtSize(att.size)}</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock size={10} /> {fmtDate(att.uploadedAt)}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <User size={10} /> {att.uploadedBy}
                      </span>
                    </div>
                    {/* Tags */}
                    {att.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {att.tags.map(tag => (
                          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs">
                            <Tag size={10} /> {tag}
                            <button onClick={() => removeTag(att.id, tag)} className="hover:text-red-500 ml-0.5">
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setPreviewAtt(att)}
                      title="Preview"
                      className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                    ><Eye size={15} /></button>
                    {att.dataUrl && (
                      <a href={att.dataUrl} download={att.fileName} title="Download"
                         className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors">
                        <Download size={15} />
                      </a>
                    )}
                    <button
                      onClick={() => toggleAtt(att.id)}
                      title="Expand"
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                    >{expandedAtts.has(att.id) ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
                    <button
                      onClick={() => { if (confirm('Remove this attachment?')) removeAttachment(att.id); }}
                      title="Delete"
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors"
                    ><Trash2 size={15} /></button>
                  </div>
                </div>

                {/* ── Expanded Details ── */}
                {expandedAtts.has(att.id) && (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-4">

                    {/* OCR Text */}
                    {att.ocrText && att.ocrText.trim() && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <FileText size={13} className="text-purple-500" />
                          <span className="text-xs font-bold text-slate-500 uppercase">OCR Extracted Text</span>
                        </div>
                        <pre className="text-xs text-slate-600 bg-white rounded-lg p-3 border border-slate-200 whitespace-pre-wrap font-mono leading-relaxed max-h-36 overflow-y-auto">
                          {att.ocrText}
                        </pre>
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <MessageSquare size={13} className="text-blue-500" />
                        <span className="text-xs font-bold text-slate-500 uppercase">Notes ({att.notes.length})</span>
                      </div>
                      {att.notes.length > 0 && (
                        <div className="space-y-2 mb-2">
                          {att.notes.map(note => (
                            <div key={note.id} className="flex gap-2 bg-white rounded-lg p-2.5 border border-slate-200">
                              <div className="flex-1">
                                <p className="text-xs text-slate-700">{note.text}</p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {note.createdBy} · {fmtDate(note.createdAt)}
                                </p>
                              </div>
                              <button
                                onClick={() => removeNote(att.id, note.id)}
                                className="p-1 hover:bg-red-50 rounded text-red-400 shrink-0"
                              ><Trash2 size={12} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add a note..."
                          value={noteInput[att.id] || ''}
                          onChange={e => setNoteInput(prev => ({ ...prev, [att.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && noteInput[att.id]?.trim()) {
                              addNote(att.id, noteInput[att.id].trim());
                              setNoteInput(prev => ({ ...prev, [att.id]: '' }));
                            }
                          }}
                          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        />
                        <button
                          onClick={() => {
                            if (noteInput[att.id]?.trim()) {
                              addNote(att.id, noteInput[att.id].trim());
                              setNoteInput(prev => ({ ...prev, [att.id]: '' }));
                            }
                          }}
                          className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        ><Plus size={14} /></button>
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Tag size={13} className="text-emerald-500" />
                        <span className="text-xs font-bold text-slate-500 uppercase">Tags</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add tag (press Enter)..."
                          value={tagInput[att.id] || ''}
                          onChange={e => setTagInput(prev => ({ ...prev, [att.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && tagInput[att.id]?.trim()) {
                              addTag(att.id, tagInput[att.id].trim().toLowerCase());
                              setTagInput(prev => ({ ...prev, [att.id]: '' }));
                            }
                          }}
                          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                        />
                        <button
                          onClick={() => {
                            if (tagInput[att.id]?.trim()) {
                              addTag(att.id, tagInput[att.id].trim().toLowerCase());
                              setTagInput(prev => ({ ...prev, [att.id]: '' }));
                            }
                          }}
                          className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        ><Plus size={14} /></button>
                      </div>
                    </div>

                    {/* File Metadata */}
                    <div className="bg-white rounded-lg p-3 border border-slate-200 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <div><span className="font-medium text-slate-600">File:</span> {att.fileName}</div>
                      <div><span className="font-medium text-slate-600">Type:</span> {att.mimeType}</div>
                      <div><span className="font-medium text-slate-600">Size:</span> {fmtSize(att.size)}</div>
                      <div><span className="font-medium text-slate-600">Source:</span> {att.source}</div>
                      <div><span className="font-medium text-slate-600">Uploaded:</span> {fmtDate(att.uploadedAt)}</div>
                      <div><span className="font-medium text-slate-600">By:</span> {att.uploadedBy}</div>
                      <div><span className="font-medium text-slate-600">Module:</span> {att.module}</div>
                      <div><span className="font-medium text-slate-600">Doc ID:</span> {att.documentId}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {previewAtt && <FilePreviewModal att={previewAtt} onClose={() => setPreviewAtt(null)} />}
    </div>
  );
}
