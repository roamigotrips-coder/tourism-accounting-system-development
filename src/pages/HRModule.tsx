import { useState, useEffect } from 'react';
import {
  Users, Calendar, DollarSign, Plus, X, Save, Search,
  Shield, Eye, Edit, Trash2, Lock, Unlock, ChevronDown, ChevronUp,
  Settings, Receipt, BarChart3, Truck,
  ShoppingBag, GitCompare, UserCheck, CheckCircle2, LayoutDashboard,
  ShoppingCart, Building2, Package, FileText, CreditCard,
  Globe, TrendingUp,
} from 'lucide-react';
import { fetchEmployees, upsertEmployee } from '../lib/supabaseSync';
// Employee type from mockData used by supabaseSync internally
import { usePresets } from '../context/PresetsContext';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

/* ─── Types ──────────────────────────────────────────────────── */
type PermLevel = 'none' | 'view' | 'edit' | 'full';

// All modules with their section grouping
interface ModuleDef {
  key: string;
  name: string;
  icon: React.ElementType;
  section: string;
}

interface SectionDef {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  iconColor: string;
  headerBg: string;
  modules: ModuleDef[];
}

interface Employee {
  id: string;
  name: string;
  department: string;
  role: string;
  salary: number;
  attendance: number;
  joinDate: string;
  status: 'Active' | 'On Leave' | 'Terminated';
  email?: string;
  phone?: string;
  systemAccess: boolean;
  permissions: Record<string, PermLevel>;
  preset?: string;
}

interface EmployeeForm {
  name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  salary: string;
  joinDate: string;
  status: string;
  systemAccess: boolean;
  permissions: Record<string, PermLevel>;
  selectedPreset: string;
}

/* ─── Constants ──────────────────────────────────────────────── */
const departments = ['All', 'Transport', 'Sales', 'Operations', 'Accounts', 'IT', 'Management'];
const departmentOptions = ['Transport', 'Sales', 'Operations', 'Accounts', 'IT', 'Management'];
const roles = ['Driver', 'Senior Driver', 'Sales Manager', 'Sales Executive', 'Operations Coordinator', 'Accountant', 'HR Manager', 'IT Support', 'General Manager', 'Finance Manager'];
const statusOptions = ['Active', 'On Leave', 'Terminated'];

const SECTIONS: SectionDef[] = [
  {
    key: 'revenue',
    label: 'Revenue',
    icon: ShoppingCart,
    color: 'emerald',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-600',
    headerBg: 'bg-emerald-600',
    modules: [
      { key: 'sales_bookings',    name: 'Sales & Booking Estimate', icon: ShoppingCart, section: 'revenue' },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    icon: Settings,
    color: 'blue',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconColor: 'text-blue-600',
    headerBg: 'bg-blue-600',
    modules: [
      { key: 'purchases',            name: 'Purchases',             icon: ShoppingBag, section: 'operations' },
      { key: 'expense_management',   name: 'Expense Management',    icon: DollarSign,  section: 'operations' },
      { key: 'supplier_management',  name: 'Supplier Management',   icon: Building2,   section: 'tools' },
      { key: 'supplier_automation',  name: 'Supplier Automation',   icon: Settings,    section: 'tools' },
      { key: 'transport_accounting', name: 'Transport Accounting',  icon: Truck,       section: 'tools' },
      { key: 'tour_costing',         name: 'Tour Package Costing',  icon: Package,     section: 'finance' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: Receipt,
    color: 'violet',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    iconColor: 'text-violet-600',
    headerBg: 'bg-violet-600',
    modules: [
      { key: 'vat_tax',             name: 'VAT & Tax',             icon: Receipt,     section: 'finance' },
      { key: 'bank_cash',           name: 'Bank & Cash',           icon: Building2,   section: 'finance' },
      { key: 'invoice_system',      name: 'Invoice System',        icon: FileText,    section: 'finance' },
      { key: 'bank_reconciliation', name: 'Bank Reconciliation',   icon: GitCompare,  section: 'finance' },
      { key: 'online_payments',     name: 'Online Payments',       icon: CreditCard,  section: 'finance' },
    ],
  },
  {
    key: 'tools',
    label: 'Tools',
    icon: BarChart3,
    color: 'amber',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-600',
    headerBg: 'bg-amber-600',
    modules: [
      { key: 'agent_management',  name: 'Agent Management',      icon: Users,       section: 'tools' },
      { key: 'agent_portal',      name: 'Agent Portal',          icon: UserCheck,   section: 'tools' },
      { key: 'crm_leads',    name: 'CRM Leads',            icon: Globe,       section: 'tools' },
      { key: 'hr_module',    name: 'HR Module',             icon: Users,       section: 'tools' },
      { key: 'forecasting',  name: 'Financial Forecasting', icon: TrendingUp,  section: 'tools' },
      { key: 'reports',      name: 'Reports',               icon: BarChart3,   section: 'tools' },
    ],
  },
];

// Flat list of all module keys
const ALL_MODULE_KEYS = SECTIONS.flatMap(s => s.modules.map(m => m.key));

const LEVEL_CONFIG: Record<PermLevel, {
  label: string; short: string; icon: React.ElementType;
  pill: string; activePill: string; dot: string;
}> = {
  none: { label: 'No Access',   short: 'None', icon: Lock,   dot: 'bg-slate-300',   pill: 'bg-slate-100 text-slate-500 border-slate-200',          activePill: 'bg-slate-600 text-white border-slate-600' },
  view: { label: 'View Only',   short: 'View', icon: Eye,    dot: 'bg-blue-400',    pill: 'bg-blue-50 text-blue-600 border-blue-200',              activePill: 'bg-blue-600 text-white border-blue-600' },
  edit: { label: 'Edit Access', short: 'Edit', icon: Edit,   dot: 'bg-amber-400',   pill: 'bg-amber-50 text-amber-700 border-amber-200',           activePill: 'bg-amber-500 text-white border-amber-500' },
  full: { label: 'Full Access', short: 'Full', icon: Unlock, dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',     activePill: 'bg-emerald-600 text-white border-emerald-600' },
};
const LEVELS: PermLevel[] = ['none', 'view', 'edit', 'full'];

const defaultPermissions = (): Record<string, PermLevel> => {
  const perms: Record<string, PermLevel> = {};
  ALL_MODULE_KEYS.forEach(k => { perms[k] = 'none'; });
  return perms;
};

const emptyForm: EmployeeForm = {
  name: '', email: '', phone: '', department: 'Transport', role: 'Driver',
  salary: '', joinDate: '', status: 'Active',
  systemAccess: false, permissions: defaultPermissions(), selectedPreset: 'No Access',
};

/* ─── Module Permission Row ──────────────────────────────────── */
function ModulePermRow({
  mod, value, onChange, sectionColor, sectionIconColor,
}: {
  mod: ModuleDef;
  value: PermLevel;
  onChange: (v: PermLevel) => void;
  sectionColor: string;
  sectionIconColor: string;
}) {
  const Icon = mod.icon;

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/70 transition-colors group">
      {/* Module Icon + Name */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${value === 'none' ? 'bg-slate-100' : `bg-${sectionColor}-100`}`}>
        <Icon size={13} className={value === 'none' ? 'text-slate-400' : sectionIconColor} />
      </div>
      <span className={`text-sm flex-1 min-w-0 truncate font-medium ${value === 'none' ? 'text-slate-400' : 'text-slate-700'}`}>
        {mod.name}
      </span>

      {/* 4-button level selector */}
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
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                active
                  ? c.activePill + ' shadow-sm scale-105'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <LIcon size={10} />
              <span className="hidden sm:inline">{c.short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Section Permission Panel ───────────────────────────────── */
function SectionPermPanel({
  section, permissions, onModuleChange, collapsed, onToggleCollapse,
}: {
  section: SectionDef;
  permissions: Record<string, PermLevel>;
  onModuleChange: (key: string, level: PermLevel) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const SecIcon = section.icon;

  // Compute section-level summary
  const levels = section.modules.map(m => permissions[m.key] || 'none');
  const fullCount  = levels.filter(l => l === 'full').length;
  const editCount  = levels.filter(l => l === 'edit').length;
  const viewCount  = levels.filter(l => l === 'view').length;
  const noneCount  = levels.filter(l => l === 'none').length;
  const total = section.modules.length;

  // Dominant level for header badge
  const dominant: PermLevel = fullCount === total ? 'full'
    : noneCount === total ? 'none'
    : editCount > 0 ? 'edit'
    : viewCount > 0 ? 'view' : 'none';

  const domCfg = LEVEL_CONFIG[dominant];
  const DomIcon = domCfg.icon;
  void domCfg; // used below via domCfg.activePill

  // Set all modules in section to a level
  const setAll = (lvl: PermLevel) => {
    section.modules.forEach(m => onModuleChange(m.key, lvl));
  };

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
      dominant === 'none' ? 'border-slate-200 bg-slate-50/50'
      : `${section.border} ${section.bg}`
    }`}>
      {/* Section Header */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            dominant === 'none' ? 'bg-slate-200' : `bg-${section.color}-100`
          }`}>
            <SecIcon size={18} className={dominant === 'none' ? 'text-slate-400' : section.iconColor} />
          </div>

          {/* Title & summary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={`font-bold text-sm ${dominant === 'none' ? 'text-slate-500' : 'text-slate-800'}`}>
                {section.label}
              </h4>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${domCfg.activePill}`}>
                <DomIcon size={8} /> {domCfg.short}
              </span>
            </div>
            {/* Mini dots summary */}
            <div className="flex items-center gap-1 mt-1">
              {section.modules.map(m => {
                const lvl = permissions[m.key] || 'none';
                return (
                  <div
                    key={m.key}
                    title={`${m.name}: ${LEVEL_CONFIG[lvl].label}`}
                    className={`w-2 h-2 rounded-full ${LEVEL_CONFIG[lvl].dot}`}
                  />
                );
              })}
              <span className="text-[10px] text-slate-400 ml-1">
                {total - noneCount}/{total} active
              </span>
            </div>
          </div>

          {/* Collapse toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg hover:bg-white/60 transition-colors text-slate-400 hover:text-slate-600 shrink-0"
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>

        {/* Quick set all buttons */}
        <div className="flex items-center gap-1.5 mt-3">
          <span className="text-[10px] text-slate-400 font-medium mr-1">Set all:</span>
          {LEVELS.map(lvl => {
            const c = LEVEL_CONFIG[lvl];
            const LIcon = c.icon;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => setAll(lvl)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold transition-all hover:scale-105 ${c.pill} hover:shadow-sm`}
              >
                <LIcon size={9} /> {c.short}
              </button>
            );
          })}
        </div>
      </div>

      {/* Module Rows */}
      {!collapsed && (
        <div className={`border-t ${dominant === 'none' ? 'border-slate-200' : `border-${section.color}-200`} px-3 py-2 space-y-0.5`}>
          {section.modules.map(mod => (
            <ModulePermRow
              key={mod.key}
              mod={mod}
              value={permissions[mod.key] || 'none'}
              onChange={lvl => onModuleChange(mod.key, lvl)}
              sectionColor={section.color}
              sectionIconColor={section.iconColor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function HRModule() {
  const { presets: contextPresets } = usePresets();
  const [dept, setDept] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<EmployeeForm>({ ...emptyForm, permissions: defaultPermissions() });
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchEmployees();
        if (!cancelled && data) {
          setEmployeeList(data.map((e: any) => ({
            ...e,
            systemAccess: e.systemAccess ?? false,
            permissions: e.permissions ?? defaultPermissions(),
            preset: e.preset ?? 'No Access',
          })));
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* Filtered list */
  const filtered = employeeList.filter(e =>
    (dept === 'All' || e.department === dept) &&
    (e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.role.toLowerCase().includes(search.toLowerCase()))
  );

  const totalSalary = employeeList.filter(e => e.status === 'Active').reduce((s, e) => s + e.salary, 0);
  const driverPayroll = employeeList.filter(e => ['Driver', 'Senior Driver'].includes(e.role) && e.status === 'Active').reduce((s, e) => s + e.salary, 0);

  /* Form handlers */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Apply preset: map section-level preset permissions to individual modules
  const applyPreset = (presetName: string) => {
    const found = contextPresets.find(p => p.name === presetName);
    if (!found) return;
    // Expand section permissions to every module in that section
    const newPerms: Record<string, PermLevel> = { ...defaultPermissions() };
    SECTIONS.forEach(sec => {
      const sectionLevel: PermLevel = (found.permissions[sec.key] as PermLevel) || 'none';
      sec.modules.forEach(mod => {
        newPerms[mod.key] = sectionLevel;
      });
    });
    setForm(prev => ({ ...prev, selectedPreset: presetName, permissions: newPerms }));
  };

  const handleModulePerm = (moduleKey: string, level: PermLevel) => {
    setForm(prev => ({
      ...prev,
      permissions: { ...prev.permissions, [moduleKey]: level },
      selectedPreset: 'Custom',
    }));
  };

  const toggleCollapse = (key: string) =>
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    const newEmp: Employee = {
      id: `EMP-${String(employeeList.length + 1).padStart(3, '0')}`,
      name: form.name,
      email: form.email,
      phone: form.phone,
      department: form.department,
      role: form.role,
      salary: parseFloat(form.salary) || 0,
      attendance: 0,
      joinDate: form.joinDate,
      status: form.status as Employee['status'],
      systemAccess: form.systemAccess,
      permissions: { ...form.permissions },
      preset: form.selectedPreset,
    };
    setEmployeeList(prev => [newEmp, ...prev]);
    upsertEmployee(newEmp).catch(() => {});
    setForm({ ...emptyForm, permissions: defaultPermissions() });
    setShowModal(false);
  };

  // Summary: count active modules per section
  const getSectionSummary = (perms: Record<string, PermLevel>, sec: SectionDef) => {
    const active = sec.modules.filter(m => (perms[m.key] || 'none') !== 'none').length;
    return `${active}/${sec.modules.length}`;
  };

  // Overall summary: total active modules
  const getActiveModules = (perms: Record<string, PermLevel>) =>
    ALL_MODULE_KEYS.filter(k => (perms[k] || 'none') !== 'none').length;

  if (loading) return <LoadingSpinner message="Loading employees..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">HR Module</h1>
          <p className="text-slate-500 mt-1">Employee records, attendance, payroll & system permissions</p>
        </div>
        <button
          onClick={() => { setForm({ ...emptyForm, permissions: defaultPermissions() }); setCollapsedSections({}); setShowModal(true); }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          <Plus size={16} /> Add Employee
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees', value: employeeList.length, icon: Users, color: 'blue' },
          { label: 'Monthly Payroll', value: `AED ${totalSalary.toLocaleString()}`, icon: DollarSign, color: 'emerald' },
          { label: 'Driver Payroll', value: `AED ${driverPayroll.toLocaleString()}`, icon: Truck, color: 'amber' },
          { label: 'On Leave', value: employeeList.filter(e => e.status === 'On Leave').length, icon: Calendar, color: 'red' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 bg-${card.color}-50 rounded-lg flex items-center justify-center`}>
                <card.icon size={18} className={`text-${card.color}-600`} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{card.label}</p>
                <p className="text-xl font-bold text-slate-800">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Section Access Overview */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-5 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} className="text-emerald-400" />
          <h3 className="font-semibold">System Access Overview</h3>
          <span className="text-xs text-slate-400 ml-auto">
            {employeeList.filter(e => e.systemAccess).length} of {employeeList.length} employees have access
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SECTIONS.map(sec => {
            const count = employeeList.filter(e => e.systemAccess && sec.modules.some(m => (e.permissions[m.key] || 'none') !== 'none')).length;
            return (
              <div key={sec.key} className="bg-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <sec.icon size={14} className="text-slate-300" />
                  <span className="text-xs text-slate-300 font-medium">{sec.label}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-slate-400 mt-0.5">employees with access</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Search employees..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {departments.map(d => (
              <button key={d} onClick={() => setDept(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dept === d ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Employee</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Department / Role</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Salary</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Attendance</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600 min-w-[320px]">Permissions</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Status</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const activeCount = getActiveModules(e.permissions);
                return (
                  <tr key={e.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    {/* Employee */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-semibold text-emerald-700">
                          {e.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{e.name}</div>
                          <div className="text-xs text-slate-400">{e.id}</div>
                        </div>
                      </div>
                    </td>
                    {/* Dept / Role */}
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium">{e.department}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{e.role}</p>
                    </td>
                    {/* Salary */}
                    <td className="px-5 py-3 text-right font-semibold text-slate-800">
                      AED {e.salary.toLocaleString()}
                    </td>
                    {/* Attendance */}
                    <td className="px-5 py-3 text-center">
                      <span className="font-medium text-slate-800">{e.attendance}%</span>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full mx-auto mt-1">
                        <div className="h-1.5 bg-emerald-400 rounded-full" style={{ width: `${e.attendance}%` }} />
                      </div>
                    </td>
                    {/* Permissions — section pills */}
                    <td className="px-5 py-3">
                      {!e.systemAccess ? (
                        <div className="flex items-center justify-center gap-1.5 text-slate-400">
                          <Lock size={13} />
                          <span className="text-xs">No Access</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {SECTIONS.map(sec => {
                              const summary = getSectionSummary(e.permissions, sec);
                              const activeInSec = sec.modules.filter(m => (e.permissions[m.key] || 'none') !== 'none').length;
                              const dominantLvl: PermLevel = activeInSec === 0 ? 'none'
                                : sec.modules.every(m => e.permissions[m.key] === 'full') ? 'full'
                                : sec.modules.some(m => e.permissions[m.key] === 'edit') ? 'edit'
                                : 'view';
                              const dc = LEVEL_CONFIG[dominantLvl];
                              return (
                                <span key={sec.key} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${dc.pill}`}>
                                  <sec.icon size={8} /> {sec.label} {summary}
                                </span>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-slate-400 text-center">
                            {e.preset === 'Custom' ? '✏️ Custom' : `⚡ ${e.preset}`} · {activeCount}/{ALL_MODULE_KEYS.length} modules
                          </p>
                        </div>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        e.status === 'Active' ? 'bg-emerald-50 text-emerald-700' :
                        e.status === 'On Leave' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'}`}>{e.status}</span>
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setViewEmployee(e); setShowPermModal(true); }}
                          title="View Permissions"
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                          <Shield size={15} />
                        </button>
                        <button className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"><Edit size={15} /></button>
                        <button className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════ ADD EMPLOYEE MODAL ═══════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Add Employee</h2>
                <p className="text-sm text-slate-500 mt-0.5">Employee details & system access permissions</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-8">

              {/* ── Basic Info ── */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Users size={14} className="text-emerald-600" /> Basic Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                    <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Mohammed Ahmed"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@company.com"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+971 50 000 0000"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Department <span className="text-red-500">*</span></label>
                    <select name="department" value={form.department} onChange={handleChange} required
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                      {departmentOptions.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Role <span className="text-red-500">*</span></label>
                    <select name="role" value={form.role} onChange={handleChange} required
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                      {roles.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Salary (AED) <span className="text-red-500">*</span></label>
                    <input type="number" name="salary" value={form.salary} onChange={handleChange} required min="0" placeholder="5000"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Join Date <span className="text-red-500">*</span></label>
                    <input type="date" name="joinDate" value={form.joinDate} onChange={handleChange} required
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select name="status" value={form.status} onChange={handleChange}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                      {statusOptions.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* ── System Access & Permissions ── */}
              <div>
                {/* Toggle header */}
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Shield size={14} className="text-emerald-600" /> System Access & Permissions
                  </h3>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, systemAccess: !prev.systemAccess }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.systemAccess ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.systemAccess ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {!form.systemAccess ? (
                  <div className="flex items-center gap-3 p-5 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
                    <Lock size={20} className="shrink-0 text-slate-300" />
                    <div>
                      <p className="text-sm font-semibold text-slate-600">No System Access</p>
                      <p className="text-xs mt-0.5">Enable the toggle above to assign module-level permissions to this employee.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">

                    {/* ── Quick Presets ── */}
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-4 border border-slate-200">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <LayoutDashboard size={12} /> Quick Role Presets
                        <span className="ml-auto text-[10px] text-slate-400 font-normal normal-case">Applies permissions to all modules in each section</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {contextPresets.map(p => (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => applyPreset(p.name)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              form.selectedPreset === p.name
                                ? 'bg-slate-800 text-white border-slate-800 shadow-md scale-105'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            {p.emoji} {p.name}
                          </button>
                        ))}
                        {form.selectedPreset === 'Custom' && (
                          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white border border-purple-600 scale-105">
                            ✏️ Custom
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Legend ── */}
                    <div className="flex flex-wrap items-center gap-2 px-1">
                      <span className="text-xs text-slate-500 font-semibold">Access levels:</span>
                      {LEVELS.map(lvl => {
                        const c = LEVEL_CONFIG[lvl];
                        const LIcon = c.icon;
                        return (
                          <span key={lvl} className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${c.pill}`}>
                            <LIcon size={10} /> {c.label}
                          </span>
                        );
                      })}
                    </div>

                    {/* ── Section Permission Panels ── */}
                    <div className="space-y-3">
                      {SECTIONS.map(sec => (
                        <SectionPermPanel
                          key={sec.key}
                          section={sec}
                          permissions={form.permissions}
                          onModuleChange={handleModulePerm}
                          collapsed={!!collapsedSections[sec.key]}
                          onToggleCollapse={() => toggleCollapse(sec.key)}
                        />
                      ))}
                    </div>

                    {/* ── Permission Summary Bar ── */}
                    <div className="bg-slate-800 rounded-2xl p-4 text-white">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                        <CheckCircle2 size={12} /> Permission Summary
                        <span className="ml-auto text-slate-300 normal-case font-normal">
                          {getActiveModules(form.permissions)}/{ALL_MODULE_KEYS.length} modules active
                        </span>
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {SECTIONS.map(sec => {
                          const activeInSec = sec.modules.filter(m => (form.permissions[m.key] || 'none') !== 'none').length;
                          const fulls = sec.modules.filter(m => form.permissions[m.key] === 'full').length;
                          const edits = sec.modules.filter(m => form.permissions[m.key] === 'edit').length;
                          const views = sec.modules.filter(m => form.permissions[m.key] === 'view').length;
                          return (
                            <div key={sec.key} className="bg-white/10 rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <sec.icon size={13} className="text-slate-300" />
                                <span className="text-xs text-slate-300 font-bold">{sec.label}</span>
                              </div>
                              <p className="text-lg font-bold">{activeInSec}<span className="text-xs text-slate-400 font-normal">/{sec.modules.length}</span></p>
                              <div className="mt-2 space-y-1">
                                {fulls > 0 && <div className="flex items-center gap-1 text-[10px] text-emerald-400"><Unlock size={8}/> {fulls} Full</div>}
                                {edits > 0 && <div className="flex items-center gap-1 text-[10px] text-amber-400"><Edit size={8}/> {edits} Edit</div>}
                                {views > 0 && <div className="flex items-center gap-1 text-[10px] text-blue-400"><Eye size={8}/> {views} View</div>}
                                {activeInSec === 0 && <div className="flex items-center gap-1 text-[10px] text-slate-500"><Lock size={8}/> No Access</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 font-medium">
                  <Save size={16} /> Add Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════ VIEW PERMISSIONS MODAL ═══════════ */}
      {showPermModal && viewEmployee && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700">
                  {viewEmployee.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">{viewEmployee.name}</h2>
                  <p className="text-xs text-slate-500">{viewEmployee.role} · {viewEmployee.department}</p>
                </div>
              </div>
              <button onClick={() => setShowPermModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4">
              {!viewEmployee.systemAccess ? (
                <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                  <Lock size={40} className="text-slate-300" />
                  <p className="font-semibold text-slate-600">No System Access</p>
                  <p className="text-sm text-center text-slate-400">This employee has no access to any system module.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5 text-sm font-medium border border-emerald-100">
                    <Unlock size={15} /> System Access Enabled
                    <span className="ml-auto text-xs font-normal text-emerald-600">
                      {viewEmployee.preset === 'Custom' ? '✏️ Custom' : `⚡ ${viewEmployee.preset}`}
                    </span>
                  </div>

                  {/* Per-section, per-module view */}
                  <div className="space-y-3">
                    {SECTIONS.map(sec => {
                      const SecIcon = sec.icon;
                      const activeInSec = sec.modules.filter(m => (viewEmployee.permissions[m.key] || 'none') !== 'none').length;
                      return (
                        <div key={sec.key} className={`rounded-2xl border-2 overflow-hidden ${activeInSec === 0 ? 'border-slate-200 bg-slate-50' : `${sec.border} ${sec.bg}`}`}>
                          {/* Section header */}
                          <div className="flex items-center gap-3 p-3 px-4">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeInSec === 0 ? 'bg-slate-200' : `bg-${sec.color}-100`}`}>
                              <SecIcon size={15} className={activeInSec === 0 ? 'text-slate-400' : sec.iconColor} />
                            </div>
                            <span className={`font-bold text-sm flex-1 ${activeInSec === 0 ? 'text-slate-400' : 'text-slate-700'}`}>{sec.label}</span>
                            <span className="text-xs text-slate-400">{activeInSec}/{sec.modules.length} active</span>
                          </div>
                          {/* Module rows */}
                          <div className="px-3 pb-3 space-y-1 border-t border-white/60">
                            {sec.modules.map(mod => {
                              const lvl: PermLevel = (viewEmployee.permissions[mod.key] as PermLevel) || 'none';
                              const cfg = LEVEL_CONFIG[lvl];
                              const MIcon = mod.icon;
                              const LIcon = cfg.icon;
                              return (
                                <div key={mod.key} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-white/50">
                                  <MIcon size={13} className={lvl === 'none' ? 'text-slate-300' : sec.iconColor} />
                                  <span className={`text-xs flex-1 ${lvl === 'none' ? 'text-slate-400' : 'text-slate-700'}`}>{mod.name}</span>
                                  <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${cfg.pill}`}>
                                    <LIcon size={9} /> {cfg.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowPermModal(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
