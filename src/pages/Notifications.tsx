import { useState, useEffect, useCallback } from 'react';
import {
  Bell, ShieldCheck, AlertCircle, Building2, Package,
  CheckCheck, Trash2, Filter, Inbox
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Notification {
  id: string;
  userId: string;
  type: 'approval' | 'overdue' | 'bank_feed' | 'low_stock' | 'system';
  title: string;
  message: string;
  module: string;
  entityId: string;
  entityType: string;
  isRead: boolean;
  actionUrl: string;
  createdAt: string;
}

const TYPE_CONFIG: Record<Notification['type'], { icon: typeof Bell; bg: string; text: string; dot: string }> = {
  approval:  { icon: ShieldCheck, bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-500' },
  overdue:   { icon: AlertCircle, bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500' },
  bank_feed: { icon: Building2,   bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  low_stock: { icon: Package,     bg: 'bg-amber-50',  text: 'text-amber-600',  dot: 'bg-amber-500' },
  system:    { icon: Bell,        bg: 'bg-slate-50',  text: 'text-slate-600',  dot: 'bg-slate-400' },
};

const TABS = ['All', 'Approvals', 'Overdue', 'Bank Feed', 'Low Stock', 'System'] as const;
const TAB_TYPE_MAP: Record<string, Notification['type'] | null> = {
  All: null, Approvals: 'approval', Overdue: 'overdue',
  'Bank Feed': 'bank_feed', 'Low Stock': 'low_stock', System: 'system',
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return `Yesterday at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupLabel(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - target.getTime()) / 86400000;
  if (diff < 1) return 'Today';
  if (diff < 2) return 'Yesterday';
  if (diff < 7) return 'This Week';
  return 'Older';
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('All');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setNotifications(data.map((r: any) => ({
        id: r.id, userId: r.user_id, type: r.type, title: r.title,
        message: r.message, module: r.module, entityId: r.entity_id,
        entityType: r.entity_type, isRead: r.is_read,
        actionUrl: r.action_url, createdAt: r.created_at,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (!unreadIds.length) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const filtered = notifications.filter(n => {
    const typeKey = TAB_TYPE_MAP[activeTab];
    return typeKey === null || n.type === typeKey;
  });

  const grouped = filtered.reduce<Record<string, Notification[]>>((acc, n) => {
    const label = groupLabel(n.createdAt);
    (acc[label] ??= []).push(n);
    return acc;
  }, {});

  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];
  const total = notifications.length;
  const unread = notifications.filter(n => !n.isRead).length;
  const todayCount = notifications.filter(n => groupLabel(n.createdAt) === 'Today').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notifications</h1>
          <p className="text-slate-500 mt-1">Stay up to date with approvals, alerts, and system events</p>
        </div>
        <button onClick={markAllRead} disabled={unread === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <CheckCheck size={15} /> Mark All as Read
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: total, color: 'text-slate-800' },
          { label: 'Unread', value: unread, color: 'text-emerald-600' },
          { label: 'Today', value: todayCount, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-2 flex flex-wrap gap-1">
        <Filter size={14} className="text-slate-400 my-auto ml-2 mr-1" />
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-16 text-center">
          <p className="text-slate-400 text-sm">Loading notifications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-16 text-center">
          <Inbox size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-600">No notifications</h3>
          <p className="text-slate-400 text-sm mt-1">
            {activeTab === 'All' ? "You're all caught up!" : `No ${activeTab.toLowerCase()} notifications.`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupOrder.filter(g => grouped[g]).map(group => (
            <div key={group}>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">{group}</h2>
              <div className="space-y-2">
                {grouped[group].map(n => {
                  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system;
                  const Icon = cfg.icon;
                  return (
                    <div key={n.id}
                      className={`bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex items-start gap-4 transition-colors ${
                        !n.isRead ? 'border-l-4 border-l-emerald-500' : ''
                      }`}>
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                        <Icon size={18} className={cfg.text} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!n.isRead && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />}
                          <h3 className={`text-sm font-semibold ${!n.isRead ? 'text-slate-800' : 'text-slate-600'}`}>
                            {n.title}
                          </h3>
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                        {n.module && (
                          <span className="inline-block mt-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            {n.module}{n.entityType ? ` / ${n.entityType}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                        <div className="flex gap-1">
                          {!n.isRead && (
                            <button onClick={() => markAsRead(n.id)} title="Mark as read"
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                              <CheckCheck size={14} />
                            </button>
                          )}
                          <button onClick={() => deleteNotification(n.id)} title="Delete"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
