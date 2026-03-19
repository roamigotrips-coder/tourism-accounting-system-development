import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, X, Save, Trash2, Edit2, Mail, Eye,
  Copy, FileText, Tag, Code, RefreshCw, LayoutTemplate,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

// ─── Types ──────────────────────────────────────────────────────────────────

type TemplateType = 'invoice' | 'reminder' | 'statement' | 'receipt' | 'welcome' | 'custom';

interface EmailTemplate {
  id: string;
  name: string;
  type: TemplateType;
  subject: string;
  body: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TEMPLATE_TYPES: TemplateType[] = ['invoice', 'reminder', 'statement', 'receipt', 'welcome', 'custom'];

const TYPE_BADGE: Record<TemplateType, string> = {
  invoice:   'bg-blue-50 text-blue-700',
  reminder:  'bg-amber-50 text-amber-700',
  statement: 'bg-purple-50 text-purple-700',
  receipt:   'bg-emerald-50 text-emerald-700',
  welcome:   'bg-teal-50 text-teal-700',
  custom:    'bg-slate-100 text-slate-600',
};

const AVAILABLE_VARIABLES = [
  '{{customer_name}}',
  '{{invoice_number}}',
  '{{amount}}',
  '{{due_date}}',
  '{{company_name}}',
  '{{balance_due}}',
  '{{payment_link}}',
  '{{statement_period}}',
  '{{receipt_number}}',
  '{{date}}',
];

function blankTemplate(): EmailTemplate {
  return {
    id: crypto.randomUUID(),
    name: '',
    type: 'custom',
    subject: '',
    body: '',
    variables: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TemplateType | 'All'>('All');

  // modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);

  // preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  /* ── Data ────────────────────────────────────────────────── */

  const load = async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('email_templates')
      .select('*')
      .order('updated_at', { ascending: false });
    if (err) setError('Failed to load email templates.');
    else setTemplates(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveTemplate = async (t: EmailTemplate) => {
    const payload = { ...t, updated_at: new Date().toISOString() };
    const { error: err } = await supabase.from('email_templates').upsert(payload);
    if (err) { setError('Failed to save template.'); return; }
    await load();
    setFormOpen(false);
    setEditing(null);
  };

  const removeTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    const { error: err } = await supabase.from('email_templates').delete().eq('id', id);
    if (err) setError('Failed to delete template.');
    else setTemplates(prev => prev.filter(t => t.id !== id));
  };

  /* ── Filtered list ──────────────────────────────────────── */

  const filtered = useMemo(() => {
    let list = templates;
    if (typeFilter !== 'All') list = list.filter(t => t.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
      );
    }
    return list;
  }, [templates, typeFilter, search]);

  /* ── Stats ──────────────────────────────────────────────── */

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    TEMPLATE_TYPES.forEach(t => { byType[t] = 0; });
    templates.forEach(t => { byType[t.type] = (byType[t.type] || 0) + 1; });
    return { total: templates.length, byType };
  }, [templates]);

  /* ── Render ─────────────────────────────────────────────── */

  if (loading) return <LoadingSpinner message="Loading email templates..." />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Mail size={24} className="text-emerald-600" /> Email Templates
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage email templates for invoices, reminders, statements &amp; more</p>
        </div>
        <button
          onClick={() => { setEditing(blankTemplate()); setFormOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold shadow"
        >
          <Plus size={16} /> New Template
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          <p className="text-xs text-slate-500">Total Templates</p>
        </div>
        {TEMPLATE_TYPES.map(t => (
          <div key={t} className="bg-white border border-slate-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{stats.byType[t]}</p>
            <p className="text-xs text-slate-500 capitalize">{t}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as TemplateType | 'All')}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
        >
          <option value="All">All Types</option>
          {TEMPLATE_TYPES.map(t => (
            <option key={t} value={t} className="capitalize">{t}</option>
          ))}
        </select>
        <button onClick={load} className="p-2 text-slate-400 hover:text-emerald-600">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Template List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Subject</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Variables</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Updated</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">No templates found.</td></tr>
            ) : filtered.map(t => (
              <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                  <LayoutTemplate size={14} className="text-emerald-500" />
                  {t.name || '(Untitled)'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${TYPE_BADGE[t.type]}`}>
                    {t.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 truncate max-w-[250px]">{t.subject}</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-500">{t.variables?.length || 0} vars</span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(t.updated_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => { setPreviewTemplate(t); setPreviewOpen(true); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600" title="Preview">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => { setEditing(t); setFormOpen(true); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-emerald-600" title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => removeTemplate(t.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Create/Edit Modal ─────────────────────────────────── */}
      {formOpen && editing && (
        <TemplateFormModal
          template={editing}
          onSave={saveTemplate}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {/* ── Preview Modal ─────────────────────────────────────── */}
      {previewOpen && previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => { setPreviewOpen(false); setPreviewTemplate(null); }}
        />
      )}
    </div>
  );
}

// ─── Template Form Modal ──────────────────────────────────────────────────────

function TemplateFormModal({
  template,
  onSave,
  onClose,
}: {
  template: EmailTemplate;
  onSave: (t: EmailTemplate) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EmailTemplate>({ ...template });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof EmailTemplate, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const insertVariable = (v: string) => {
    set('body', form.body + v);
    if (!form.variables.includes(v)) {
      set('variables', [...form.variables, v]);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return alert('Template name is required.');
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">
            {template.name ? 'Edit Template' : 'New Template'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Name & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Template Name *</label>
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Invoice Email"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
              <select
                value={form.type}
                onChange={e => set('type', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              >
                {TEMPLATE_TYPES.map(t => (
                  <option key={t} value={t} className="capitalize">{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Subject Line</label>
            <input
              value={form.subject}
              onChange={e => set('subject', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Invoice {{invoice_number}} from {{company_name}}"
            />
          </div>

          {/* Variable Insertion Helper */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              <Code size={12} className="inline mr-1" /> Insert Variable (click to add to body)
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VARIABLES.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded text-xs font-mono border border-slate-200 hover:border-emerald-300 transition"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email Body (HTML)</label>
            <textarea
              value={form.body}
              onChange={e => set('body', e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500"
              placeholder="<h2>Dear {{customer_name}},</h2><p>Please find your invoice attached...</p>"
            />
          </div>

          {/* Used Variables */}
          {form.variables.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Used Variables</label>
              <div className="flex flex-wrap gap-1.5">
                {form.variables.map(v => (
                  <span key={v} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-mono">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Preview Modal ──────────────────────────────────────────────────────────

function PreviewModal({
  template,
  onClose,
}: {
  template: EmailTemplate;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Eye size={18} className="text-blue-500" /> Template Preview
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{template.name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Metadata */}
          <div className="flex items-center gap-3">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${TYPE_BADGE[template.type]}`}>
              {template.type}
            </span>
            <span className="text-xs text-slate-400">Updated {new Date(template.updated_at).toLocaleString()}</span>
          </div>

          {/* Subject */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Subject</p>
            <p className="text-sm font-medium text-slate-800">{template.subject || '(No subject)'}</p>
          </div>

          {/* Body preview */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-600">Body Preview</p>
            </div>
            <div
              className="p-4 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: template.body || '<p class="text-slate-400">(Empty body)</p>' }}
            />
          </div>

          {/* Variables */}
          {template.variables?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Template Variables</p>
              <div className="flex flex-wrap gap-1.5">
                {template.variables.map(v => (
                  <span key={v} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-mono">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium">Close</button>
        </div>
      </div>
    </div>
  );
}
