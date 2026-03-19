import { useState, useEffect } from 'react';
import { Store, Plus, Search, Mail, Send, Eye, ToggleLeft, ToggleRight, MessageSquare, Clock, CheckCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PortalUser { id: string; entityType: string; entityId: string; email: string; name: string; isActive: boolean; lastLogin: string | null; createdAt: string; }
interface PortalMessage { id: string; portalUserId: string; direction: 'inbound' | 'outbound'; subject: string; body: string; isRead: boolean; createdAt: string; }

export default function VendorPortal() {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PortalUser | null>(null);
  const [newMsg, setNewMsg] = useState('');
  const [invite, setInvite] = useState({ name: '', email: '', entityId: '' });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.from('portal_users').select('*').eq('entity_type', 'vendor').order('created_at', { ascending: false });
      const { data: m } = await supabase.from('portal_messages').select('*').order('created_at', { ascending: false });
      setUsers((u ?? []).map((r: any) => ({ id: r.id, entityType: r.entity_type, entityId: r.entity_id, email: r.email, name: r.name, isActive: r.is_active, lastLogin: r.last_login, createdAt: r.created_at })));
      setMessages((m ?? []).map((r: any) => ({ id: r.id, portalUserId: r.portal_user_id, direction: r.direction, subject: r.subject, body: r.body, isRead: r.is_read, createdAt: r.created_at })));
      setLoading(false);
    })();
  }, []);

  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
  const activeCount = users.filter(u => u.isActive).length;
  const pendingMsgs = messages.filter(m => !m.isRead && m.direction === 'inbound').length;
  const userMessages = selectedUser ? messages.filter(m => m.portalUserId === selectedUser.id) : [];

  const handleInvite = async () => {
    if (!invite.name || !invite.email) return;
    const nu: any = { id: crypto.randomUUID(), entity_type: 'vendor', entity_id: invite.entityId || invite.name, email: invite.email, name: invite.name, is_active: true };
    await supabase.from('portal_users').upsert(nu, { onConflict: 'id' });
    setUsers(prev => [{ id: nu.id, entityType: 'vendor', entityId: nu.entity_id, email: invite.email, name: invite.name, isActive: true, lastLogin: null, createdAt: new Date().toISOString() }, ...prev]);
    setInvite({ name: '', email: '', entityId: '' });
    setShowInvite(false);
  };

  const toggleActive = async (u: PortalUser) => {
    await supabase.from('portal_users').update({ is_active: !u.isActive }).eq('id', u.id);
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !x.isActive } : x));
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedUser) return;
    const msg: any = { id: crypto.randomUUID(), portal_user_id: selectedUser.id, direction: 'outbound', subject: 'Message', body: newMsg, is_read: true };
    await supabase.from('portal_messages').upsert(msg, { onConflict: 'id' });
    setMessages(prev => [{ id: msg.id, portalUserId: selectedUser.id, direction: 'outbound', subject: 'Message', body: newMsg, isRead: true, createdAt: new Date().toISOString() }, ...prev]);
    setNewMsg('');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Store className="text-emerald-600" size={24} /> Vendor Portal</h1>
          <p className="text-slate-500 mt-1">Manage vendor self-service access and communication</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> Invite Vendor
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[{ label: 'Total Vendors', value: users.length, color: 'text-slate-800' }, { label: 'Active', value: activeCount, color: 'text-emerald-600' }, { label: 'Pending Messages', value: pendingMsgs, color: 'text-amber-600' }].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..." className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Vendor Portal Users</div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Vendor</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Email</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Last Login</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-700">{u.name}</td>
                  <td className="px-5 py-3 text-slate-500">{u.email}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{u.isActive ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-5 py-3 text-center text-xs text-slate-400">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setSelectedUser(u)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Messages"><MessageSquare size={15} /></button>
                      <button onClick={() => toggleActive(u)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Toggle">
                        {u.isActive ? <ToggleRight size={15} className="text-emerald-500" /> : <ToggleLeft size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-slate-400">No vendors found</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col" style={{ maxHeight: 500 }}>
          <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800 flex items-center gap-2">
            <Mail size={15} className="text-emerald-500" /> {selectedUser ? `Chat: ${selectedUser.name}` : 'Select a vendor'}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!selectedUser && <p className="text-center text-slate-400 text-sm mt-8">Click a vendor's message icon to view conversation</p>}
            {userMessages.map(m => (
              <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${m.direction === 'outbound' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  <p>{m.body}</p>
                  <p className={`text-[10px] mt-1 ${m.direction === 'outbound' ? 'text-emerald-100' : 'text-slate-400'}`}>{new Date(m.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
          {selectedUser && (
            <div className="p-3 border-t border-slate-100 flex gap-2">
              <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..." className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" onKeyDown={e => e.key === 'Enter' && sendMessage()} />
              <button onClick={sendMessage} className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"><Send size={15} /></button>
            </div>
          )}
        </div>
      </div>

      {/* Vendor Portal Preview */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Eye size={16} className="text-blue-500" /> Vendor Portal Preview</h3>
        <p className="text-sm text-slate-500 mb-4">This is what vendors see when they log into their portal:</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2"><Store size={18} className="text-blue-500" /></div>
            <p className="text-sm font-semibold text-slate-700">Purchase Orders</p>
            <p className="text-xs text-slate-400 mt-1">View assigned POs and delivery schedules</p>
          </div>
          <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-2"><Clock size={18} className="text-amber-500" /></div>
            <p className="text-sm font-semibold text-slate-700">Bills & Payments</p>
            <p className="text-xs text-slate-400 mt-1">Track bill status and payment history</p>
          </div>
          <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2"><CheckCircle size={18} className="text-emerald-500" /></div>
            <p className="text-sm font-semibold text-slate-700">Upload Invoices</p>
            <p className="text-xs text-slate-400 mt-1">Submit invoices for processing</p>
          </div>
        </div>
      </div>

      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-800">Invite Vendor</h3><button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button></div>
            <div className="space-y-4">
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Vendor Name *</label><input value={invite.name} onChange={e => setInvite(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email *</label><input type="email" value={invite.email} onChange={e => setInvite(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              <button onClick={handleInvite} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">Send Invitation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
