import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Shield, Plus, Edit2, Trash2, X, Save,
  Lock, Eye, Unlock, ShoppingCart, Building2, Receipt, BarChart3,
  CheckCircle2, AlertCircle, Copy, ChevronDown, ChevronUp,
  Users, Package, Truck, DollarSign, FileText, CreditCard,
  Globe, TrendingUp, UserCheck, ShoppingBag, GitCompare
} from 'lucide-react';
import { usePresets, PermLevel, RolePreset } from '../context/PresetsContext';
import { fetchSetting, saveSetting } from '../lib/supabaseSync';
import { catchAndReport } from '../lib/toast';

/* ─── Constants ──────────────────────────────────────────── */
const LEVELS: PermLevel[] = ['none', 'view', 'edit', 'full'];

const LEVEL_CONFIG: Record<PermLevel, {
  label: string; short: string;
  icon: React.ElementType;
  pill: string; activePill: string; bg: string;
}> = {
  none: { label: 'No Access',   short: 'None', icon: Lock,   pill: 'bg-slate-100 text-slate-500 border-slate-200', activePill: 'bg-slate-700 text-white border-slate-700', bg: 'bg-slate-100' },
  view: { label: 'View Only',   short: 'View', icon: Eye,    pill: 'bg-blue-50 text-blue-600 border-blue-200',     activePill: 'bg-blue-600 text-white border-blue-600',   bg: 'bg-blue-50' },
  edit: { label: 'Edit Access', short: 'Edit', icon: Edit2,  pill: 'bg-amber-50 text-amber-600 border-amber-200',  activePill: 'bg-amber-500 text-white border-amber-500', bg: 'bg-amber-50' },
  full: { label: 'Full Access', short: 'Full', icon: Unlock, pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', activePill: 'bg-emerald-600 text-white border-emerald-600', bg: 'bg-emerald-50' },
};

const SECTIONS = [
  {
    key: 'revenue', label: 'Revenue', icon: ShoppingCart,
    color: 'emerald', iconColor: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200',
    description: 'Sales & booking estimates',
    modules: [
      { name: 'Sales & Booking Estimate', icon: ShoppingCart },
    ],
  },
  {
    key: 'operations', label: 'Operations', icon: SettingsIcon,
    color: 'blue', iconColor: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200',
    description: 'Purchases & expense management',
    modules: [
      { name: 'Purchases', icon: ShoppingBag },
      { name: 'Expense Management', icon: DollarSign },
    ],
  },
  {
    key: 'finance', label: 'Finance', icon: Receipt,
    color: 'violet', iconColor: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200',
    description: 'VAT, bank, invoices, reconciliation, payments & tour costing',
    modules: [
      { name: 'VAT & Tax', icon: Receipt },
      { name: 'Tour Package Costing', icon: Package },
      { name: 'Bank & Cash', icon: Building2 },
      { name: 'Invoice System', icon: FileText },
      { name: 'Bank Reconciliation', icon: GitCompare },
      { name: 'Online Payments', icon: CreditCard },
    ],
  },
  {
    key: 'tools', label: 'Tools', icon: BarChart3,
    color: 'amber', iconColor: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200',
    description: 'Agents, suppliers, transport, CRM, HR, mobile, forecasting & reports',
    modules: [
      { name: 'Agent Management', icon: Users },
      { name: 'Agent Portal', icon: UserCheck },
      { name: 'Supplier Management', icon: Building2 },
      { name: 'Supplier Automation', icon: SettingsIcon },
      { name: 'Transport Accounting', icon: Truck },
      { name: 'CRM Leads', icon: Globe },
      { name: 'HR Module', icon: Users },
      { name: 'Financial Forecasting', icon: TrendingUp },
      { name: 'Reports', icon: BarChart3 },
    ],
  },
];

const EMOJI_OPTIONS = ['👑', '🎯', '💼', '📊', '⚙️', '🚗', '🔒', '🧑‍💻', '📱', '🏨', '✈️', '🗂️', '💰', '🎪', '🧭', '🛡️', '🔑', '🌍'];
const COLOR_OPTIONS = [
  { value: 'emerald', label: 'Green', cls: 'bg-emerald-500' },
  { value: 'blue', label: 'Blue', cls: 'bg-blue-500' },
  { value: 'violet', label: 'Purple', cls: 'bg-violet-500' },
  { value: 'amber', label: 'Amber', cls: 'bg-amber-500' },
  { value: 'red', label: 'Red', cls: 'bg-red-500' },
  { value: 'pink', label: 'Pink', cls: 'bg-pink-500' },
  { value: 'cyan', label: 'Cyan', cls: 'bg-cyan-500' },
  { value: 'slate', label: 'Slate', cls: 'bg-slate-500' },
];

const defaultPerms = (): Record<string, PermLevel> => ({
  revenue: 'none', operations: 'none', finance: 'none', tools: 'none',
});

/* ─── Section Permission Row (inside modal) ──────────────── */
function SectionRow({
  section, value, onChange, expanded, onToggle,
}: {
  section: typeof SECTIONS[0];
  value: PermLevel;
  onChange: (v: PermLevel) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cfg = LEVEL_CONFIG[value];
  const Icon = section.icon;

  return (
    <div className={`rounded-xl border-2 transition-all ${value === 'none' ? 'border-slate-200 bg-white' : `${section.border} ${section.bg}`}`}>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${value === 'none' ? 'bg-slate-100' : `bg-${section.color}-100`}`}>
            <Icon size={16} className={value === 'none' ? 'text-slate-400' : section.iconColor} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">{section.label}</p>
            <p className="text-xs text-slate-400 truncate">{section.description}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            {LEVELS.map(lvl => {
              const c = LEVEL_CONFIG[lvl];
              const LIcon = c.icon;
              const active = value === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onChange(lvl)}
                  title={c.label}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    active ? c.activePill + ' shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <LIcon size={11} />
                  <span className="hidden sm:inline">{c.short}</span>
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
        >
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {expanded ? 'Hide' : 'Show'} {section.modules.length} modules
        </button>
      </div>
      {expanded && (
        <div className={`border-t px-4 pb-3 pt-2 space-y-1 ${value === 'none' ? 'border-slate-100' : `border-${section.color}-200`}`}>
          {section.modules.map(mod => {
            const MIcon = mod.icon;
            return (
              <div key={mod.name} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-white/60">
                <MIcon size={12} className={value === 'none' ? 'text-slate-300' : section.iconColor} />
                <span className={`text-xs ${value === 'none' ? 'text-slate-400' : 'text-slate-700'}`}>{mod.name}</span>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border font-medium ${LEVEL_CONFIG[value].pill}`}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
          <p className="text-[10px] text-slate-400 italic px-2 pt-1">All modules inherit the section permission.</p>
        </div>
      )}
    </div>
  );
}

/* ─── Preset Card ─────────────────────────────────────────── */
function PresetCard({
  preset, onEdit, onDelete, onDuplicate,
}: {
  preset: RolePreset;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const getSectionLabel = (key: string) => SECTIONS.find(s => s.key === key)?.label ?? key;
  const getSectionIcon = (key: string) => SECTIONS.find(s => s.key === key)?.icon ?? Shield;

  const levelEntries = Object.entries(preset.permissions) as [string, PermLevel][];
  const activeCount = levelEntries.filter(([, v]) => v !== 'none').length;

  const colorMap: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50',
    blue: 'border-blue-200 bg-blue-50',
    violet: 'border-violet-200 bg-violet-50',
    amber: 'border-amber-200 bg-amber-50',
    red: 'border-red-200 bg-red-50',
    pink: 'border-pink-200 bg-pink-50',
    cyan: 'border-cyan-200 bg-cyan-50',
    slate: 'border-slate-200 bg-slate-50',
    gray: 'border-slate-200 bg-slate-50',
  };
  const dotMap: Record<string, string> = {
    emerald: 'bg-emerald-500', blue: 'bg-blue-500', violet: 'bg-violet-500',
    amber: 'bg-amber-500', red: 'bg-red-500', pink: 'bg-pink-500',
    cyan: 'bg-cyan-500', slate: 'bg-slate-500', gray: 'bg-slate-400',
  };

  return (
    <div className={`rounded-2xl border-2 transition-all hover:shadow-md ${colorMap[preset.color] ?? 'border-slate-200 bg-white'}`}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-white shadow-sm border border-white/80`}>
                {preset.emoji}
              </div>
              <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${dotMap[preset.color] ?? 'bg-slate-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-base">{preset.name}</h3>
                {preset.isSystem && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 font-medium">System</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{preset.description}</p>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onDuplicate}
              title="Duplicate preset"
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={onEdit}
              title="Edit preset"
              className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
            >
              <Edit2 size={14} />
            </button>
            {!preset.isSystem && (
              <button
                onClick={onDelete}
                title="Delete preset"
                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Access Summary Pills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {levelEntries.map(([key, lvl]) => {
            const SectionIcon = getSectionIcon(key);
            const cfg = LEVEL_CONFIG[lvl];
            const LIcon = cfg.icon;
            return (
              <span key={key} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.pill}`}>
                <SectionIcon size={9} />
                {getSectionLabel(key)}:
                <LIcon size={9} />
                {cfg.short}
              </span>
            );
          })}
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {activeCount === 4 ? '✅ Full system access' : activeCount === 0 ? '🔒 No access' : `${activeCount}/4 sections active`}
          </span>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Less' : 'Details'}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/60 px-5 pb-4 pt-3 space-y-2">
          {levelEntries.map(([key, lvl]) => {
            const sec = SECTIONS.find(s => s.key === key);
            if (!sec) return null;
            const cfg = LEVEL_CONFIG[lvl];
            const LIcon = cfg.icon;
            const SecIcon = sec.icon;
            return (
              <div key={key} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/70">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${lvl === 'none' ? 'bg-slate-100' : `bg-${sec.color}-100`}`}>
                  <SecIcon size={13} className={lvl === 'none' ? 'text-slate-400' : sec.iconColor} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-700">{sec.label}</p>
                  <p className="text-[10px] text-slate-400">{sec.modules.length} modules</p>
                </div>
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.pill}`}>
                  <LIcon size={10} /> {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Preset Form Modal ───────────────────────────────────── */
function PresetModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: RolePreset | null;
  onSave: (data: Omit<RolePreset, 'id' | 'isSystem'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🎯');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color ?? 'blue');
  const [permissions, setPermissions] = useState<Record<string, PermLevel>>(
    initial?.permissions ?? defaultPerms()
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setSection = (key: string, lvl: PermLevel) =>
    setPermissions(prev => ({ ...prev, [key]: lvl }));

  const applyQuick = (type: 'all-full' | 'all-view' | 'all-none') => {
    const lvl = type === 'all-full' ? 'full' : type === 'all-view' ? 'view' : 'none';
    setPermissions({ revenue: lvl, operations: lvl, finance: lvl, tools: lvl });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Preset name is required';
    if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({ name: name.trim(), emoji, description: description.trim(), color, permissions });
  };

  const activeCount = Object.values(permissions).filter(v => v !== 'none').length;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[94vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {initial ? 'Edit Role Preset' : 'Create New Role Preset'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Define permissions for each section of the system</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* ── Identity ── */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Shield size={13} className="text-emerald-500" /> Preset Identity
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Preset Name <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {/* Emoji picker */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(v => !v)}
                      className="h-full px-3 border border-slate-200 rounded-lg text-xl hover:bg-slate-50 transition-colors"
                    >
                      {emoji}
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-20 grid grid-cols-6 gap-1 w-48">
                        {EMOJI_OPTIONS.map(e => (
                          <button
                            key={e} type="button"
                            onClick={() => { setEmoji(e); setShowEmojiPicker(false); }}
                            className={`text-xl p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${emoji === e ? 'bg-emerald-50 ring-1 ring-emerald-400' : ''}`}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Tour Guide, Receptionist"
                    className={`flex-1 border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${errors.name ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                  />
                </div>
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of this role's responsibilities"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Color */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Card Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      title={c.label}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        color === c.value ? 'border-slate-800 bg-slate-800 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${c.cls}`} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* ── Permissions ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Shield size={13} className="text-emerald-500" /> Section Permissions
              </h3>
              {/* Quick set all */}
              <div className="flex gap-1">
                <button type="button" onClick={() => applyQuick('all-none')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium border border-slate-200">
                  🔒 All None
                </button>
                <button type="button" onClick={() => applyQuick('all-view')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium border border-blue-200">
                  👁 All View
                </button>
                <button type="button" onClick={() => applyQuick('all-full')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium border border-emerald-200">
                  🔓 All Full
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 mb-4">
              {LEVELS.map(lvl => {
                const c = LEVEL_CONFIG[lvl];
                const LIcon = c.icon;
                return (
                  <span key={lvl} className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium ${c.pill}`}>
                    <LIcon size={10} /> {c.label}
                  </span>
                );
              })}
            </div>

            {/* Section rows */}
            <div className="space-y-3">
              {SECTIONS.map(sec => (
                <SectionRow
                  key={sec.key}
                  section={sec}
                  value={(permissions[sec.key] as PermLevel) ?? 'none'}
                  onChange={lvl => setSection(sec.key, lvl)}
                  expanded={!!expanded[sec.key]}
                  onToggle={() => setExpanded(prev => ({ ...prev, [sec.key]: !prev[sec.key] }))}
                />
              ))}
            </div>
          </div>

          {/* ── Live Summary ── */}
          <div className="bg-slate-800 rounded-2xl p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <CheckCircle2 size={12} /> Permission Summary Preview
            </p>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {SECTIONS.map(sec => {
                const lvl = (permissions[sec.key] as PermLevel) ?? 'none';
                const cfg = LEVEL_CONFIG[lvl];
                const CfgIcon = cfg.icon;
                const SecIcon = sec.icon;
                return (
                  <div key={sec.key} className="text-center">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2 ${
                      lvl === 'none' ? 'bg-slate-700' :
                      lvl === 'view' ? 'bg-blue-500/20' :
                      lvl === 'edit' ? 'bg-amber-500/20' : 'bg-emerald-500/20'
                    }`}>
                      <SecIcon size={18} className={
                        lvl === 'none' ? 'text-slate-500' :
                        lvl === 'view' ? 'text-blue-400' :
                        lvl === 'edit' ? 'text-amber-400' : 'text-emerald-400'
                      } />
                    </div>
                    <p className="text-xs font-semibold text-white">{sec.label}</p>
                    <div className={`flex items-center justify-center gap-1 mt-1 text-[10px] font-medium ${
                      lvl === 'none' ? 'text-slate-500' :
                      lvl === 'view' ? 'text-blue-400' :
                      lvl === 'edit' ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      <CfgIcon size={9} /> {cfg.short}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
              activeCount === 4 ? 'bg-emerald-500/20 text-emerald-300' :
              activeCount === 0 ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'
            }`}>
              {activeCount === 4 ? <Unlock size={14} /> : activeCount === 0 ? <Lock size={14} /> : <Eye size={14} />}
              {activeCount === 4 ? 'Full system access — this role can access everything' :
               activeCount === 0 ? 'No system access — this role cannot access any module' :
               `${activeCount} of 4 sections active`}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 font-medium shadow-sm">
              <Save size={16} /> {initial ? 'Save Changes' : 'Create Preset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Delete Confirm ──────────────────────────────────────── */
function DeleteConfirm({ preset, onConfirm, onCancel }: { preset: RolePreset; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
            <AlertCircle size={28} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Delete Preset?</h3>
            <p className="text-sm text-slate-500 mt-1">
              Are you sure you want to delete <strong>"{preset.name}"</strong>? Employees using this preset will keep their current permissions but the preset won't be available for new assignments.
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={onConfirm}
              className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 font-medium">
              Delete Preset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Settings Page ─────────────────────────────────── */
export default function Settings() {
  const { presets, addPreset, updatePreset, deletePreset } = usePresets();
  const [activeTab, setActiveTab] = useState<'presets' | 'approval' | 'general' | 'company'>('presets');
  const [showModal, setShowModal] = useState(false);
  const [editPreset, setEditPreset] = useState<RolePreset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RolePreset | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [useFixedCfoThreshold, setUseFixedCfoThreshold] = useState<boolean>(true);
  const [cfoThresholdAmount, setCfoThresholdAmount] = useState<number>(5000);

  useEffect(() => {
    (async () => {
      const [fixedRaw, amountRaw] = await Promise.all([
        fetchSetting('accountspro.approval.fixedCfoThreshold'),
        fetchSetting('accountspro.approval.cfoThresholdAmount'),
      ]);
      if (fixedRaw !== null) setUseFixedCfoThreshold(fixedRaw === 'true');
      if (amountRaw !== null) {
        const parsed = Number(amountRaw);
        if (Number.isFinite(parsed) && parsed > 0) setCfoThresholdAmount(parsed);
      }
    })().catch(catchAndReport('Load approval settings'));
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleSave = (data: Omit<RolePreset, 'id' | 'isSystem'>) => {
    if (editPreset) {
      updatePreset(editPreset.id, data);
      showSuccess(`"${data.name}" preset updated successfully.`);
    } else {
      addPreset(data);
      showSuccess(`"${data.name}" preset created successfully.`);
    }
    setShowModal(false);
    setEditPreset(null);
  };

  const handleEdit = (preset: RolePreset) => {
    setEditPreset(preset);
    setShowModal(true);
  };

  const handleDuplicate = (preset: RolePreset) => {
    addPreset({
      name: `${preset.name} (Copy)`,
      emoji: preset.emoji,
      description: preset.description,
      color: preset.color,
      permissions: { ...preset.permissions },
    });
    showSuccess(`"${preset.name}" duplicated successfully.`);
  };

  const handleDelete = (preset: RolePreset) => setDeleteTarget(preset);

  const confirmDelete = () => {
    if (deleteTarget) {
      deletePreset(deleteTarget.id);
      showSuccess(`"${deleteTarget.name}" preset deleted.`);
      setDeleteTarget(null);
    }
  };

  const systemPresets = presets.filter(p => p.isSystem);
  const customPresets = presets.filter(p => !p.isSystem);

  const tabs = [
    { id: 'presets' as const, label: 'Role Presets', icon: Shield },
    { id: 'approval' as const, label: 'Approval Controls', icon: Shield },
    { id: 'general' as const, label: 'General', icon: SettingsIcon },
    { id: 'company' as const, label: 'Company', icon: Building2 },
  ];

  const saveApprovalControls = () => {
    const safeAmount = Number.isFinite(cfoThresholdAmount) && cfoThresholdAmount > 0 ? cfoThresholdAmount : 5000;
    saveSetting('accountspro.approval.fixedCfoThreshold', String(useFixedCfoThreshold)).catch(catchAndReport('Save CFO threshold toggle'));
    saveSetting('accountspro.approval.cfoThresholdAmount', String(safeAmount)).catch(catchAndReport('Save CFO threshold amount'));
    setCfoThresholdAmount(safeAmount);
    showSuccess('Approval controls saved. CFO threshold updated.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
          <p className="text-slate-500 mt-1">System configuration, role presets & company settings</p>
        </div>
        {activeTab === 'presets' && (
          <button
            onClick={() => { setEditPreset(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm"
          >
            <Plus size={16} /> New Role Preset
          </button>
        )}
      </div>

      {/* Success Toast */}
      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map(tab => {
          const TIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <TIcon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ ROLE PRESETS TAB ═══ */}
      {activeTab === 'presets' && (
        <div className="space-y-6">
          {/* Overview KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Presets', value: presets.length, color: 'blue', icon: Shield },
              { label: 'System Presets', value: systemPresets.length, color: 'slate', icon: Lock },
              { label: 'Custom Presets', value: customPresets.length, color: 'emerald', icon: Unlock },
              { label: 'Sections Covered', value: 4, color: 'violet', icon: SettingsIcon },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 bg-${card.color}-50 rounded-lg flex items-center justify-center`}>
                    <card.icon size={17} className={`text-${card.color}-600`} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{card.label}</p>
                    <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Info Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white">
            <div className="flex items-start gap-4">
              <Shield size={28} className="text-emerald-200 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-base">Role-Based Access Control</h3>
                <p className="text-emerald-100 text-sm mt-1">
                  Role presets define which sections (Revenue, Operations, Finance, Tools) employees can access
                  and at what level. Create custom presets tailored to your team's specific needs.
                  When adding an employee in HR, select a preset to instantly apply all permissions.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {LEVELS.map(lvl => {
                    const c = LEVEL_CONFIG[lvl];
                    const LIcon = c.icon;
                    return (
                      <span key={lvl} className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                        <LIcon size={10} /> {c.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Custom Presets */}
          {customPresets.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Unlock size={14} className="text-emerald-500" /> Custom Presets
                <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs normal-case font-semibold">{customPresets.length}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {customPresets.map(p => (
                  <PresetCard
                    key={p.id}
                    preset={p}
                    onEdit={() => handleEdit(p)}
                    onDelete={() => handleDelete(p)}
                    onDuplicate={() => handleDuplicate(p)}
                  />
                ))}
                {/* Add new card */}
                <button
                  onClick={() => { setEditPreset(null); setShowModal(true); }}
                  className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all flex flex-col items-center justify-center gap-3 p-8 text-slate-400 hover:text-emerald-600 min-h-[180px]"
                >
                  <Plus size={28} />
                  <span className="text-sm font-medium">Create New Preset</span>
                </button>
              </div>
            </div>
          )}

          {customPresets.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 py-10 flex flex-col items-center gap-3 text-slate-400">
              <Shield size={36} className="text-slate-300" />
              <p className="font-semibold text-slate-500">No custom presets yet</p>
              <p className="text-sm text-center max-w-sm">Create custom role presets for your specific team needs — e.g. Tour Guide, Receptionist, Finance Intern</p>
              <button
                onClick={() => { setEditPreset(null); setShowModal(true); }}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
              >
                <Plus size={15} /> Create First Preset
              </button>
            </div>
          )}

          {/* System Presets */}
          <div>
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Lock size={14} className="text-slate-400" /> System Presets
              <span className="ml-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs normal-case font-semibold">{systemPresets.length}</span>
              <span className="ml-2 text-xs text-slate-400 normal-case font-normal">· Can be edited but not deleted</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemPresets.map(p => (
                <PresetCard
                  key={p.id}
                  preset={p}
                  onEdit={() => handleEdit(p)}
                  onDelete={() => handleDelete(p)}
                  onDuplicate={() => handleDuplicate(p)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ GENERAL TAB ═══ */}
      {activeTab === 'approval' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Shield size={16} className="text-emerald-500" /> Maker-Checker Approval Controls
            </h2>

            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50">
              <p className="text-sm font-semibold text-blue-800">Invoice Approval Threshold</p>
              <p className="text-xs text-blue-700 mt-1">
                Configure a fixed amount for CFO approval. This setting is used by the Approval Engine workflow.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center py-3 border-b border-slate-50">
              <label className="text-sm font-medium text-slate-700">Enable Fixed CFO Threshold</label>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setUseFixedCfoThreshold(v => !v)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${
                    useFixedCfoThreshold
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-slate-300 text-slate-600'
                  }`}
                >
                  {useFixedCfoThreshold ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {useFixedCfoThreshold ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center py-3 border-b border-slate-50">
              <label className="text-sm font-medium text-slate-700">CFO Approval Amount (AED)</label>
              <input
                type="number"
                min={1}
                value={cfoThresholdAmount}
                onChange={(e) => setCfoThresholdAmount(Number(e.target.value || 0))}
                className="sm:col-span-2 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 text-sm space-y-1">
              <p className="font-semibold text-slate-800">Effective Rule Preview</p>
              <p className="text-slate-600">IF invoice amount &lt; AED {cfoThresholdAmount.toLocaleString()} → Finance Manager approval</p>
              <p className="text-slate-600">IF invoice amount ≥ AED {cfoThresholdAmount.toLocaleString()} → CFO approval</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveApprovalControls}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
              >
                <Save size={15} /> Save Approval Controls
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2"><SettingsIcon size={16} className="text-emerald-500" /> General Settings</h2>
            {[
              { label: 'Default Currency', value: 'AED – UAE Dirham', type: 'select', options: ['AED – UAE Dirham', 'USD – US Dollar', 'EUR – Euro', 'GBP – British Pound'] },
              { label: 'VAT Rate (%)', value: '5', type: 'number' },
              { label: 'Date Format', value: 'DD/MM/YYYY', type: 'select', options: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] },
              { label: 'Fiscal Year Start', value: 'January', type: 'select', options: ['January', 'April', 'July', 'October'] },
              { label: 'Timezone', value: 'Asia/Dubai (UTC+4)', type: 'select', options: ['Asia/Dubai (UTC+4)', 'Asia/Riyadh (UTC+3)', 'Europe/London (UTC+0)', 'America/New_York (UTC-5)'] },
            ].map(field => (
              <div key={field.label} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center py-3 border-b border-slate-50 last:border-0">
                <label className="text-sm font-medium text-slate-700">{field.label}</label>
                {field.type === 'select' ? (
                  <select defaultValue={field.value} className="sm:col-span-2 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {field.options?.map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={field.type} defaultValue={field.value} className="sm:col-span-2 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <button className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                <Save size={15} /> Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ COMPANY TAB ═══ */}
      {activeTab === 'company' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2"><Building2 size={16} className="text-emerald-500" /> Company Information</h2>
            {[
              { label: 'Company Name', placeholder: 'TourAcco Travel & Tourism LLC', type: 'text' },
              { label: 'TRN Number', placeholder: '100123456789003', type: 'text' },
              { label: 'Trade License No.', placeholder: 'CN-1234567', type: 'text' },
              { label: 'Address', placeholder: 'Office 101, Business Bay, Dubai, UAE', type: 'text' },
              { label: 'Phone', placeholder: '+971 4 123 4567', type: 'tel' },
              { label: 'Email', placeholder: 'info@touracco.ae', type: 'email' },
              { label: 'Website', placeholder: 'https://www.touracco.ae', type: 'url' },
            ].map(field => (
              <div key={field.label} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center py-3 border-b border-slate-50 last:border-0">
                <label className="text-sm font-medium text-slate-700">{field.label}</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  className="sm:col-span-2 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            ))}
            <div className="flex justify-end">
              <button className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                <Save size={15} /> Save Company Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL ═══ */}
      {showModal && (
        <PresetModal
          initial={editPreset}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditPreset(null); }}
        />
      )}

      {/* ═══ DELETE CONFIRM ═══ */}
      {deleteTarget && (
        <DeleteConfirm
          preset={deleteTarget}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
