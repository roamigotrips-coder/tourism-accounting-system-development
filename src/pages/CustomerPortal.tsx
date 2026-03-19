import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Users, UserPlus, Search, Mail, MessageSquare, Eye, X, Send,
  CheckCircle, Clock, AlertCircle, ToggleLeft, ToggleRight, RefreshCw
} from 'lucide-react';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

type PortalUser = {
  id: string;
  customer_name: string;
  email: string;
  entity_type: 'Individual' | 'Corporate' | 'Travel Agent';
  status: 'Active' | 'Inactive';
  last_login: string | null;
  created_at: string;
};

type PortalMessage = {
  id: string;
  portal_user_id: string;
  sender: 'admin' | 'customer';
  message: string;
  created_at: string;
  read: boolean;
};

type PortalInvoice = {
  id: string;
  invoice_number: string;
  date: string;
  due_date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
};

export default function CustomerPortal() {
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPreview, setShowPreview] = useState<PortalUser | null>(null);
  const [showMessages, setShowMessages] = useState<PortalUser | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', entity_type: 'Individual' as PortalUser['entity_type'] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: users, error: uErr } = await supabase
          .from('portal_users')
          .select('*')
          .eq('portal_type', 'customer')
          .order('created_at', { ascending: false });
        if (uErr) throw uErr;

        const { data: msgs, error: mErr } = await supabase
          .from('portal_messages')
          .select('*')
          .eq('portal_type', 'customer')
          .order('created_at', { ascending: true });
        if (mErr) throw mErr;

        if (!cancelled) {
          setPortalUsers(users ?? []);
          setMessages(msgs ?? []);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Failed to load portal data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredUsers = useMemo(() => {
    return portalUsers.filter(u => {
      const matchesSearch =
        u.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [portalUsers, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: portalUsers.length,
    active: portalUsers.filter(u => u.status === 'Active').length,
    pendingMessages: messages.filter(m => m.sender === 'customer' && !m.read).length,
  }), [portalUsers, messages]);

  const userMessages = useMemo(() => {
    if (!showMessages) return [];
    return messages.filter(m => m.portal_user_id === showMessages.id);
  }, [messages, showMessages]);

  const handleInvite = async () => {
    if (!inviteForm.name || !inviteForm.email) return;
    try {
      const { data, error: iErr } = await supabase
        .from('portal_users')
        .insert({
          customer_name: inviteForm.name,
          email: inviteForm.email,
          entity_type: inviteForm.entity_type,
          portal_type: 'customer',
          status: 'Active',
        })
        .select()
        .single();
      if (iErr) throw iErr;
      if (data) setPortalUsers(prev => [data, ...prev]);
      setInviteForm({ name: '', email: '', entity_type: 'Individual' });
      setShowInviteModal(false);
    } catch (err: any) {
      alert(err.message ?? 'Failed to invite customer');
    }
  };

  const toggleStatus = async (user: PortalUser) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    const { error: tErr } = await supabase
      .from('portal_users')
      .update({ status: newStatus })
      .eq('id', user.id);
    if (!tErr) {
      setPortalUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !showMessages) return;
    try {
      const { data, error: sErr } = await supabase
        .from('portal_messages')
        .insert({
          portal_user_id: showMessages.id,
          portal_type: 'customer',
          sender: 'admin',
          message: newMessage.trim(),
          read: true,
        })
        .select()
        .single();
      if (sErr) throw sErr;
      if (data) setMessages(prev => [...prev, data]);
      setNewMessage('');
    } catch (err: any) {
      alert(err.message ?? 'Failed to send message');
    }
  };

  if (loading) return <LoadingSpinner message="Loading customer portal..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customer Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Manage customer self-service portal access and communication</p>
        </div>
        <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 font-medium text-sm">
          <UserPlus size={16} /> Invite Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Portal Users', value: stats.total, icon: Users, color: 'bg-blue-50 text-blue-600' },
          { label: 'Active Users', value: stats.active, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Messages Pending', value: stats.pendingMessages, icon: MessageSquare, color: 'bg-amber-50 text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.color}`}><s.icon size={22} /></div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{s.value}</p>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by name or email..." className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Customer Name', 'Email', 'Entity Type', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">No portal users found</td></tr>
              ) : filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{user.customer_name}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{user.entity_type}</span></td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{user.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setShowPreview(user)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Preview"><Eye size={15} /></button>
                      <button onClick={() => setShowMessages(user)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Messages"><MessageSquare size={15} /></button>
                      <button onClick={() => toggleStatus(user)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Toggle Status">
                        {user.status === 'Active' ? <ToggleRight size={15} className="text-emerald-600" /> : <ToggleLeft size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Invite Customer to Portal</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
                <input value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="email@company.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Entity Type</label>
                <select value={inviteForm.entity_type} onChange={e => setInviteForm(f => ({ ...f, entity_type: e.target.value as any }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="Individual">Individual</option>
                  <option value="Corporate">Corporate</option>
                  <option value="Travel Agent">Travel Agent</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setShowInviteModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg font-medium">Cancel</button>
              <button onClick={handleInvite} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center gap-2"><Mail size={14} /> Send Invite</button>
            </div>
          </div>
        </div>
      )}

      {/* Portal Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-emerald-600" />
                <span className="font-semibold text-slate-700">Portal Preview — {showPreview.customer_name}</span>
              </div>
              <button onClick={() => setShowPreview(null)} className="p-1 hover:bg-slate-200 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <h4 className="font-semibold text-emerald-800 mb-1">Welcome, {showPreview.customer_name}</h4>
                <p className="text-emerald-600 text-sm">Your self-service portal for invoices, payments, and communication.</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Outstanding Balance', value: 'AED 0.00', color: 'text-red-600' },
                  { label: 'Total Invoices', value: '0', color: 'text-slate-800' },
                  { label: 'Payments Made', value: 'AED 0.00', color: 'text-emerald-600' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 mb-3">Recent Invoices</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50"><tr>{['Invoice #', 'Date', 'Amount', 'Status'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">{h}</th>)}</tr></thead>
                    <tbody><tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">No invoices yet</td></tr></tbody>
                  </table>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 mb-3">Payment History</h4>
                <div className="border border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm">No payments recorded</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Modal */}
      {showMessages && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-emerald-600" />
                <span className="font-semibold text-slate-700">Messages — {showMessages.customer_name}</span>
              </div>
              <button onClick={() => setShowMessages(null)} className="p-1 hover:bg-slate-200 rounded-lg"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {userMessages.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">No messages yet. Start the conversation below.</p>
              ) : userMessages.map(m => (
                <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${m.sender === 'admin' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                    <p>{m.message}</p>
                    <p className={`text-xs mt-1 ${m.sender === 'admin' ? 'text-emerald-200' : 'text-slate-400'}`}>
                      {new Date(m.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
              <button onClick={sendMessage} className="bg-emerald-600 text-white p-2.5 rounded-lg hover:bg-emerald-700"><Send size={16} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
