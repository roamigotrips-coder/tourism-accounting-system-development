import { useMemo, useState } from 'react';
import { Plus, PlayCircle, PauseCircle, Trash2, Edit3, Sliders, CheckCircle } from 'lucide-react';
import { useAutomation, type Workflow, type TriggerType, type Condition, type Action } from '../context/AutomationContext';

const TRIGGERS: { value: TriggerType; label: string }[] = [
  { value: 'ESTIMATE_SUBMITTED', label: 'When an estimate is sent to Finance' },
  { value: 'INVOICE_APPROVED', label: 'When an invoice is approved' },
  { value: 'PAYMENT_RECORDED', label: 'When a payment is recorded' },
  { value: 'BANK_MATCHED', label: 'When a bank tx is matched' },
];

const ACTIONS: { value: Action['type']; label: string }[] = [
  { value: 'SEND_EMAIL', label: 'Send Email Notification' },
  { value: 'CREATE_TASK', label: 'Create Internal Task' },
  { value: 'ADD_TAG', label: 'Add Tag' },
  { value: 'MOVE_TO_STAGE', label: 'Move to Stage' },
];

export default function Automation() {
  const { workflows, addWorkflow, updateWorkflow, deleteWorkflow, logs } = useAutomation();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState<TriggerType>('ESTIMATE_SUBMITTED');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<Action[]>([]);

  const startNew = () => {
    setEditing(null);
    setName('New Workflow');
    setDescription('');
    setTrigger('ESTIMATE_SUBMITTED');
    setConditions([]);
    setActions([]);
    setShowModal(true);
  };

  const edit = (w: Workflow) => {
    setEditing(w);
    setName(w.name);
    setDescription(w.description || '');
    setTrigger(w.trigger);
    setConditions(w.conditions);
    setActions(w.actions);
    setShowModal(true);
  };

  const save = () => {
    if (!name.trim()) return;
    const payload = { name: name.trim(), description, enabled: true, trigger, conditions, actions } as Omit<Workflow, 'id' | 'createdAt'>;
    if (editing) updateWorkflow(editing.id, payload);
    else addWorkflow(payload);
    setShowModal(false);
  };

  const addCond = () => setConditions(prev => [...prev, { field: 'amount', op: 'gt', value: '0' }]);
  const updCond = (i: number, patch: Partial<Condition>) => setConditions(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  const delCond = (i: number) => setConditions(prev => prev.filter((_, idx) => idx !== i));

  const addAct = () => setActions(prev => [...prev, { type: 'SEND_EMAIL', to: 'accounts@example.com', subject: 'Notification', body: 'Event occurred' }]);
  const updAct = (i: number, patch: Partial<Action>) => setActions(prev => prev.map((a, idx) => idx === i ? { ...(a as any), ...patch } as Action : a));
  const delAct = (i: number) => setActions(prev => prev.filter((_, idx) => idx !== i));

  const totalEnabled = useMemo(() => workflows.filter(w => w.enabled).length, [workflows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Automation Workflows</h1>
          <p className="text-slate-500 text-sm mt-1">Create If-This-Then-That rules to automate approvals, notifications, and tagging across AccountsPro.</p>
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
          <Plus size={16} /> New Workflow
        </button>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total Workflows</p>
          <p className="text-2xl font-bold text-slate-800">{workflows.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Enabled</p>
          <p className="text-2xl font-bold text-emerald-700">{totalEnabled}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Recent Logs</p>
          <p className="text-2xl font-bold text-blue-700">{logs.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Last Updated</p>
          <p className="text-2xl font-bold text-slate-800">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Workflows</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {workflows.length === 0 && (
              <div className="text-center text-slate-500 text-sm py-6">No workflows yet. Click New Workflow to create one.</div>
            )}
            {workflows.map(w => (
              <div key={w.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${w.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{w.enabled ? 'Enabled' : 'Disabled'}</span>
                    <p className="font-medium text-slate-800">{w.name}</p>
                  </div>
                  <p className="text-xs text-slate-500">{TRIGGERS.find(t => t.value === w.trigger)?.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateWorkflow(w.id, { enabled: !w.enabled })} className={`p-2 rounded-lg ${w.enabled ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>{w.enabled ? <PauseCircle size={18} /> : <PlayCircle size={18} />}</button>
                  <button onClick={() => edit(w)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Edit3 size={18} /></button>
                  <button onClick={() => deleteWorkflow(w.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Activity Log</h2>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {logs.length === 0 && <div className="text-center text-slate-400 text-sm py-10">No activity yet.</div>}
            {logs.map(l => (
              <div key={l.id} className="flex items-center gap-2 text-sm bg-slate-50 border border-slate-200 rounded-lg p-2">
                <CheckCircle size={14} className="text-emerald-600" />
                <span className="text-slate-600">{l.message}</span>
                <span className="ml-auto text-xs text-slate-400">{new Date(l.time).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">{editing ? 'Edit Workflow' : 'New Workflow'}</h3>
                <p className="text-xs text-slate-500">Define a trigger, optional conditions, and actions to run.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500">Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Workflow name" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Trigger</label>
                  <select value={trigger} onChange={e => setTrigger(e.target.value as TriggerType)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500">Description</label>
                  <input value={description} onChange={e => setDescription(e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Short description" />
                </div>
              </div>

              {/* Conditions */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-slate-700 flex items-center gap-2"><Sliders size={16} /> Conditions (optional)</h4>
                  <button onClick={addCond} className="text-xs px-2 py-1 bg-white border border-slate-200 rounded">+ Add Condition</button>
                </div>
                {conditions.length === 0 && <p className="text-xs text-slate-500">No conditions. This workflow will run for every trigger event.</p>}
                <div className="space-y-2">
                  {conditions.map((c, i) => (
                    <div key={i} className="grid sm:grid-cols-[1fr_120px_1fr_40px] gap-2 items-center">
                      <input value={c.field} onChange={e => updCond(i, { field: e.target.value })} placeholder="Field (e.g., amount, serviceType, type)" className="px-2 py-1.5 border border-slate-200 rounded text-sm" />
                      <select value={c.op} onChange={e => updCond(i, { op: e.target.value as Condition['op'] })} className="px-2 py-1.5 border border-slate-200 rounded text-sm">
                        <option value="contains">contains</option>
                        <option value="eq">equals</option>
                        <option value="gt">greater than</option>
                        <option value="lt">less than</option>
                      </select>
                      <input value={c.value} onChange={e => updCond(i, { value: e.target.value })} placeholder="Value" className="px-2 py-1.5 border border-slate-200 rounded text-sm" />
                      <button onClick={() => delCond(i)} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-slate-700 flex items-center gap-2"><PlayCircle size={16} /> Actions</h4>
                  <button onClick={addAct} className="text-xs px-2 py-1 bg-white border border-slate-200 rounded">+ Add Action</button>
                </div>
                {actions.length === 0 && <p className="text-xs text-slate-500">No actions yet. Add at least one action.</p>}
                <div className="space-y-2">
                  {actions.map((a, i) => (
                    <div key={i} className="grid sm:grid-cols-[1fr_1fr_1fr_40px] gap-2 items-start">
                      <select value={a.type} onChange={e => updAct(i, { type: e.target.value as Action['type'] })} className="px-2 py-1.5 border border-slate-200 rounded text-sm">
                        {ACTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      {a.type === 'SEND_EMAIL' && (
                        <input value={(a as any).to} onChange={e => updAct(i, { to: e.target.value })} placeholder="to@email.com" className="px-2 py-1.5 border border-slate-200 rounded text-sm" />
                      )}
                      {a.type === 'SEND_EMAIL' && (
                        <input value={(a as any).subject} onChange={e => updAct(i, { subject: e.target.value })} placeholder="Subject" className="px-2 py-1.5 border border-slate-200 rounded text-sm" />
                      )}
                      {a.type === 'CREATE_TASK' && (
                        <input value={(a as any).title} onChange={e => updAct(i, { title: e.target.value })} placeholder="Task title" className="px-2 py-1.5 border border-slate-200 rounded text-sm" />
                      )}
                      <button onClick={() => delAct(i)} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={save} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">Save Workflow</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
