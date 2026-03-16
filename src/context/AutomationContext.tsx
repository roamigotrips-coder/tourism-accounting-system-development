import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AutomationEvent =
  | { type: 'ESTIMATE_SUBMITTED'; payload: { id: string; amount: number; serviceType: string; agent?: string; customer?: string } }
  | { type: 'INVOICE_APPROVED'; payload: { id: string; amount: number; currency: string; party: string } }
  | { type: 'PAYMENT_RECORDED'; payload: { id: string; amount: number; method: string; party: string } }
  | { type: 'BANK_MATCHED'; payload: { bankId: string; bookId: string; amount: number; date: string } };

export type TriggerType = AutomationEvent['type'];
export type Condition = { field: string; op: 'contains' | 'eq' | 'gt' | 'lt'; value: string };
export type Action =
  | { type: 'SEND_EMAIL'; to: string; subject: string; body: string }
  | { type: 'CREATE_TASK'; title: string; assignee?: string; dueInDays?: number }
  | { type: 'ADD_TAG'; tag: string }
  | { type: 'MOVE_TO_STAGE'; entity: 'estimate' | 'invoice' | 'payment'; stage: string };

export type Workflow = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: TriggerType;
  conditions: Condition[];
  actions: Action[];
  createdAt: string;
};

function load<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, v: T) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

const AutomationCtx = createContext<{
  workflows: Workflow[];
  addWorkflow: (w: Omit<Workflow, 'id' | 'createdAt'>) => void;
  updateWorkflow: (id: string, patch: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;
  publish: (evt: AutomationEvent) => void;
  logs: { id: string; time: string; message: string }[];
}>({ workflows: [], addWorkflow: () => {}, updateWorkflow: () => {}, deleteWorkflow: () => {}, publish: () => {}, logs: [] });

export function AutomationProvider({ children }: { children: React.ReactNode }) {
  const [workflows, setWorkflows] = useState<Workflow[]>(() => load<Workflow[]>('automation.workflows', []));
  const [logs, setLogs] = useState<{ id: string; time: string; message: string }[]>(() => load('automation.logs', []));

  useEffect(() => save('automation.workflows', workflows), [workflows]);
  useEffect(() => save('automation.logs', logs), [logs]);

  const addWorkflow = (w: Omit<Workflow, 'id' | 'createdAt'>) => {
    const id = 'WF-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    setWorkflows((prev) => [{ ...w, id, createdAt: new Date().toISOString() }, ...prev]);
  };
  const updateWorkflow = (id: string, patch: Partial<Workflow>) => setWorkflows((prev) => prev.map(w => w.id === id ? { ...w, ...patch } : w));
  const deleteWorkflow = (id: string) => setWorkflows((prev) => prev.filter(w => w.id !== id));

  const passConditions = (evt: AutomationEvent, conditions: Condition[]) => {
    const flat: Record<string, any> = { ...(evt as any).payload, type: evt.type };
    return conditions.every(c => {
      const v = String(flat[c.field] ?? '');
      const t = c.value;
      switch (c.op) {
        case 'contains': return v.toLowerCase().includes(String(t).toLowerCase());
        case 'eq': return v === String(t);
        case 'gt': return Number(v) > Number(t);
        case 'lt': return Number(v) < Number(t);
        default: return false;
      }
    });
  };

  const runActions = (_evt: AutomationEvent, actions: Action[]) => {
    actions.forEach(a => {
      if (a.type === 'SEND_EMAIL') {
        setLogs(prev => [{ id: crypto.randomUUID(), time: new Date().toISOString(), message: `Email to ${a.to}: ${a.subject}` }, ...prev]);
      } else if (a.type === 'CREATE_TASK') {
        setLogs(prev => [{ id: crypto.randomUUID(), time: new Date().toISOString(), message: `Task: ${a.title} assigned to ${a.assignee || 'Unassigned'}` }, ...prev]);
      } else if (a.type === 'ADD_TAG') {
        setLogs(prev => [{ id: crypto.randomUUID(), time: new Date().toISOString(), message: `Tag added: ${a.tag}` }, ...prev]);
      } else if (a.type === 'MOVE_TO_STAGE') {
        setLogs(prev => [{ id: crypto.randomUUID(), time: new Date().toISOString(), message: `Moved ${a.entity} to stage: ${a.stage}` }, ...prev]);
      }
    });
  };

  const publish = (evt: AutomationEvent) => {
    const eligible = workflows.filter(w => w.enabled && w.trigger === evt.type && passConditions(evt, w.conditions));
    if (eligible.length === 0) return;
    eligible.forEach(w => runActions(evt, w.actions));
  };

  const value = useMemo(() => ({ workflows, addWorkflow, updateWorkflow, deleteWorkflow, publish, logs }), [workflows, logs]);
  return <AutomationCtx.Provider value={value}>{children}</AutomationCtx.Provider>;
}

export const useAutomation = () => useContext(AutomationCtx);
