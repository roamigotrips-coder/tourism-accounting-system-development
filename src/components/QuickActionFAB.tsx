import { useState } from 'react';
import { Plus, X, FileText, Receipt, BookOpen, ClipboardList, DollarSign, Users } from 'lucide-react';
import { Page } from './Sidebar';

interface QuickActionFABProps { onNavigate: (page: Page) => void; }

const ACTIONS = [
  { label: 'New Invoice', icon: FileText, page: 'invoices' as Page, color: 'bg-blue-500' },
  { label: 'New Quote', icon: ClipboardList, page: 'quotes' as Page, color: 'bg-purple-500' },
  { label: 'New Expense', icon: DollarSign, page: 'expenses' as Page, color: 'bg-red-500' },
  { label: 'Journal Entry', icon: BookOpen, page: 'journalEntries' as Page, color: 'bg-slate-600' },
  { label: 'New Bill', icon: Receipt, page: 'bills' as Page, color: 'bg-amber-500' },
  { label: 'New Lead', icon: Users, page: 'crm' as Page, color: 'bg-cyan-500' },
];

export default function QuickActionFAB({ onNavigate }: QuickActionFABProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col items-end gap-2 mb-1 animate-fade-in">
          {ACTIONS.map((action, i) => (
            <button
              key={action.label}
              onClick={() => { onNavigate(action.page); setOpen(false); }}
              className="flex items-center gap-2 pl-3 pr-4 py-2 bg-white rounded-full shadow-lg border border-slate-100 hover:shadow-xl hover:scale-105 transition-all text-sm font-medium text-slate-700"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className={`w-7 h-7 rounded-full ${action.color} flex items-center justify-center`}>
                <action.icon size={13} className="text-white" />
              </div>
              {action.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 ${open ? 'bg-slate-700 rotate-45' : 'bg-emerald-600 hover:bg-emerald-700'}`}
      >
        {open ? <X size={20} className="text-white" /> : <Plus size={22} className="text-white" />}
      </button>
    </div>
  );
}
