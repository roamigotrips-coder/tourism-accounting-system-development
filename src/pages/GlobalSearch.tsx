import { useState, useEffect, useRef } from 'react';
import { Search, FileText, Users, ShoppingCart, Receipt, Building2, Truck, DollarSign, BookOpen, Clock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SearchResult { id: string; type: string; title: string; subtitle: string; icon: string; }

const TYPE_ICONS: Record<string, any> = {
  invoice: FileText, customer: Users, quote: FileText, sales_order: ShoppingCart,
  bill: Receipt, vendor: Building2, expense: DollarSign, journal: BookOpen,
  employee: Users, transport: Truck, project: Building2,
};

const TYPE_COLORS: Record<string, string> = {
  invoice: 'bg-blue-50 text-blue-600', customer: 'bg-emerald-50 text-emerald-600',
  quote: 'bg-purple-50 text-purple-600', sales_order: 'bg-indigo-50 text-indigo-600',
  bill: 'bg-amber-50 text-amber-600', vendor: 'bg-orange-50 text-orange-600',
  expense: 'bg-red-50 text-red-600', journal: 'bg-slate-100 text-slate-600',
  employee: 'bg-cyan-50 text-cyan-600', transport: 'bg-teal-50 text-teal-600',
  project: 'bg-pink-50 text-pink-600',
};

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(() => searchAll(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const searchAll = async (q: string) => {
    setLoading(true);
    const like = `%${q}%`;
    const allResults: SearchResult[] = [];

    const searches = [
      supabase.from('invoices').select('id, invoice_number, customer, total').ilike('customer', like).limit(5)
        .then(({ data }) => (data ?? []).forEach((r: any) => allResults.push({ id: r.id, type: 'invoice', title: r.invoice_number || 'Invoice', subtitle: `${r.customer} — AED ${Number(r.total).toLocaleString()}`, icon: 'invoice' }))),
      supabase.from('invoices').select('id, invoice_number, customer, total').ilike('invoice_number', like).limit(5)
        .then(({ data }) => (data ?? []).filter((r: any) => !allResults.find(x => x.id === r.id)).forEach((r: any) => allResults.push({ id: r.id, type: 'invoice', title: r.invoice_number || 'Invoice', subtitle: `${r.customer} — AED ${Number(r.total).toLocaleString()}`, icon: 'invoice' }))),
      supabase.from('quotes').select('id, quote_number, customer, total').ilike('customer', like).limit(5)
        .then(({ data }) => (data ?? []).forEach((r: any) => allResults.push({ id: r.id, type: 'quote', title: r.quote_number || 'Quote', subtitle: `${r.customer} — AED ${Number(r.total).toLocaleString()}`, icon: 'quote' }))),
      supabase.from('sales_orders').select('id, so_number, customer, total').ilike('customer', like).limit(5)
        .then(({ data }) => (data ?? []).forEach((r: any) => allResults.push({ id: r.id, type: 'sales_order', title: r.so_number || 'Sales Order', subtitle: `${r.customer} — AED ${Number(r.total).toLocaleString()}`, icon: 'sales_order' }))),
      supabase.from('bills').select('id, bill_number, vendor, total').ilike('vendor', like).limit(5)
        .then(({ data }) => (data ?? []).forEach((r: any) => allResults.push({ id: r.id, type: 'bill', title: r.bill_number || 'Bill', subtitle: `${r.vendor} — AED ${Number(r.total).toLocaleString()}`, icon: 'bill' }))),
      supabase.from('expenses').select('id, description, vendor, amount').ilike('description', like).limit(5)
        .then(({ data }) => (data ?? []).forEach((r: any) => allResults.push({ id: r.id, type: 'expense', title: r.description || 'Expense', subtitle: `${r.vendor || 'N/A'} — AED ${Number(r.amount).toLocaleString()}`, icon: 'expense' }))),
      supabase.from('journal_entries').select('id, entry_number, description').ilike('description', like).limit(5)
        .then(({ data }) => (data ?? []).forEach((r: any) => allResults.push({ id: r.id, type: 'journal', title: r.entry_number || 'Journal Entry', subtitle: r.description || '', icon: 'journal' }))),
      supabase.from('employees').select('id, name, department').ilike('name', like).limit(5)
        .then(({ data }) => (data ?? []).forEach((r: any) => allResults.push({ id: r.id, type: 'employee', title: r.name, subtitle: r.department || 'Employee', icon: 'employee' }))),
      supabase.from('projects').select('id, name, client, status').ilike('name', like).limit(5)
        .then(({ data }) => (data ?? []).forEach((r: any) => allResults.push({ id: r.id, type: 'project', title: r.name, subtitle: `${r.client || ''} — ${r.status || ''}`, icon: 'project' }))),
    ];

    await Promise.allSettled(searches);
    setResults(allResults);
    setLoading(false);

    if (q && !recentSearches.includes(q)) {
      setRecentSearches(prev => [q, ...prev].slice(0, 8));
    }
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] = acc[r.type] || []).push(r);
    return acc;
  }, {});

  const typeLabels: Record<string, string> = {
    invoice: 'Invoices', quote: 'Quotes', sales_order: 'Sales Orders', bill: 'Bills',
    expense: 'Expenses', journal: 'Journal Entries', employee: 'Employees',
    project: 'Projects', customer: 'Customers', vendor: 'Vendors', transport: 'Transport',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Search className="text-emerald-600" size={24} /> Global Search</h1>
        <p className="text-slate-500 mt-1">Search across all modules — invoices, quotes, bills, employees, and more</p>
      </div>

      <div className="relative">
        <Search size={20} className="absolute left-4 top-4 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type to search across all modules..."
          className="w-full pl-12 pr-12 py-4 border border-slate-200 rounded-2xl text-base bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); }} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && query && results.length === 0 && (
        <div className="text-center py-12">
          <Search size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400">No results found for "{query}"</p>
          <p className="text-sm text-slate-300 mt-1">Try different keywords or check spelling</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-6">
          <p className="text-sm text-slate-400">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = TYPE_ICONS[type] || FileText;
            const color = TYPE_COLORS[type] || 'bg-slate-50 text-slate-600';
            return (
              <div key={type}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{typeLabels[type] || type}</h3>
                <div className="space-y-1">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-emerald-200 hover:shadow-sm cursor-pointer transition-all">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}><Icon size={16} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{item.title}</p>
                        <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>{typeLabels[type] || type}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!query && recentSearches.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Clock size={14} className="text-slate-400" /> Recent Searches</h3>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((s, i) => (
              <button key={i} onClick={() => setQuery(s)} className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-sm hover:bg-emerald-50 hover:text-emerald-700 transition-colors">{s}</button>
            ))}
          </div>
        </div>
      )}

      {!query && recentSearches.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
          <Search size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400">Start typing to search across all modules</p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {['Invoices', 'Quotes', 'Bills', 'Expenses', 'Journal Entries', 'Employees', 'Projects'].map(t => (
              <span key={t} className="px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-xs">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
