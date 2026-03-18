import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchWorkflows as fetchWorkflowsDb,
  upsertWorkflow as upsertWorkflowDb,
  deleteWorkflowDb,
  fetchAutomationLogs as fetchAutomationLogsDb,
  insertAutomationLog as insertAutomationLogDb,
} from '../lib/supabaseSync';

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

const AutomationCtx = createContext<{
  workflows: Workflow[];
  addWorkflow: (w: Omit<Workflow, 'id' | 'createdAt'>) => void;
  updateWorkflow: (id: string, patch: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;
  publish: (evt: AutomationEvent) => void;
  logs: { id: string; time: string; message: string }[];
  loading: boolean;
  error: string | null;
}>({ workflows: [], addWorkflow: () => {}, updateWorkflow: () => {}, deleteWorkflow: () => {}, publish: () => {}, logs: [], loading: true, error: null });

export function AutomationProvider({ children }: { children: React.ReactNode }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [logs, setLogs] = useState<{ id: string; time: string; message: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load from Supabase on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [wfs, autoLogs] = await Promise.all([
          fetchWorkflowsDb(),
          fetchAutomationLogsDb(),
        ]);
        if (cancelled) return;
        if (wfs !== null) setWorkflows(wfs);
        if (autoLogs !== null) setLogs(autoLogs);
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load automation data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const addWorkflow = (w: Omit<Workflow, 'id' | 'createdAt'>) => {
    const id = 'WF-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const newWf: Workflow = { ...w, id, createdAt: new Date().toISOString() };
    setWorkflows((prev) => [newWf, ...prev]);
    upsertWorkflowDb(newWf).catch(() => {});
  };

  const updateWorkflow = (id: string, patch: Partial<Workflow>) => {
    setWorkflows((prev) => {
      const next = prev.map(w => w.id === id ? { ...w, ...patch } : w);
      const changed = next.find(w => w.id === id);
      if (changed) upsertWorkflowDb(changed).catch(() => {});
      return next;
    });
  };

  const deleteWorkflow = (id: string) => {
    setWorkflows((prev) => prev.filter(w => w.id !== id));
    deleteWorkflowDb(id).catch(() => {});
  };

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
      let message = '';
      if (a.type === 'SEND_EMAIL') {
        message = `Email to ${a.to}: ${a.subject}`;
      } else if (a.type === 'CREATE_TASK') {
        message = `Task: ${a.title} assigned to ${a.assignee || 'Unassigned'}`;
      } else if (a.type === 'ADD_TAG') {
        message = `Tag added: ${a.tag}`;
      } else if (a.type === 'MOVE_TO_STAGE') {
        message = `Moved ${a.entity} to stage: ${a.stage}`;
      }
      if (message) {
        const entry = { id: crypto.randomUUID(), time: new Date().toISOString(), message };
        setLogs(prev => [entry, ...prev]);
        insertAutomationLogDb(entry).catch(() => {});
      }
    });
  };

  const publish = (evt: AutomationEvent) => {
    const eligible = workflows.filter(w => w.enabled && w.trigger === evt.type && passConditions(evt, w.conditions));
    if (eligible.length === 0) return;
    eligible.forEach(w => runActions(evt, w.actions));
  };

  const value = useMemo(() => ({ workflows, addWorkflow, updateWorkflow, deleteWorkflow, publish, logs, loading, error }), [workflows, logs, loading, error]);
  return <AutomationCtx.Provider value={value}>{children}</AutomationCtx.Provider>;
}

export const useAutomation = () => useContext(AutomationCtx);
