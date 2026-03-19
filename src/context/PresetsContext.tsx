import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { catchAndReport } from '../lib/toast';
import {
  fetchRolePresets as fetchRolePresetsDb,
  upsertRolePreset as upsertRolePresetDb,
  upsertRolePresets as upsertRolePresetsDb,
  deleteRolePresetDb,
} from '../lib/supabaseSync';

export type PermLevel = 'none' | 'view' | 'edit' | 'full';

export interface RolePreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  permissions: Record<string, PermLevel>;
  isSystem: boolean;
}

const DEFAULT_PRESETS: RolePreset[] = [
  { id: 'admin', name: 'Admin', emoji: '👑', description: 'Full access to all modules', color: 'red', isSystem: true, permissions: { revenue: 'full', operations: 'full', finance: 'full', tools: 'full' } },
  { id: 'manager', name: 'Manager', emoji: '🎯', description: 'Edit access to all, view-only tools', color: 'blue', isSystem: true, permissions: { revenue: 'edit', operations: 'edit', finance: 'edit', tools: 'view' } },
  { id: 'sales', name: 'Sales Staff', emoji: '💼', description: 'Revenue full, limited finance & ops', color: 'emerald', isSystem: true, permissions: { revenue: 'full', operations: 'view', finance: 'view', tools: 'edit' } },
  { id: 'accountant', name: 'Accountant', emoji: '📊', description: 'Finance full access, limited others', color: 'violet', isSystem: true, permissions: { revenue: 'view', operations: 'edit', finance: 'full', tools: 'view' } },
  { id: 'operations', name: 'Operations', emoji: '⚙️', description: 'Operations full, view others', color: 'amber', isSystem: true, permissions: { revenue: 'view', operations: 'full', finance: 'view', tools: 'view' } },
  { id: 'driver', name: 'Driver', emoji: '🚗', description: 'Operations view only, tools view', color: 'slate', isSystem: true, permissions: { revenue: 'none', operations: 'view', finance: 'none', tools: 'view' } },
  { id: 'noaccess', name: 'No Access', emoji: '🔒', description: 'No access to any module', color: 'gray', isSystem: true, permissions: { revenue: 'none', operations: 'none', finance: 'none', tools: 'none' } },
];

interface PresetsContextType {
  presets: RolePreset[];
  addPreset: (preset: Omit<RolePreset, 'id' | 'isSystem'>) => void;
  updatePreset: (id: string, preset: Partial<RolePreset>) => void;
  deletePreset: (id: string) => void;
  loading: boolean;
  error: string | null;
}

const PresetsContext = createContext<PresetsContextType | null>(null);

export function PresetsProvider({ children }: { children: ReactNode }) {
  const [presets, setPresets] = useState<RolePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load from Supabase on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchRolePresetsDb();
        if (cancelled) return;
        if (data !== null && data.length > 0) {
          setPresets(data);
        } else {
          // Seed defaults
          setPresets(DEFAULT_PRESETS);
          upsertRolePresetsDb(DEFAULT_PRESETS).catch(catchAndReport('Seed default role presets'));
        }
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Failed to load presets');
          setPresets(DEFAULT_PRESETS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const addPreset = (preset: Omit<RolePreset, 'id' | 'isSystem'>) => {
    const id = preset.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    const newPreset: RolePreset = { ...preset, id, isSystem: false };
    setPresets(prev => [...prev, newPreset]);
    upsertRolePresetDb(newPreset).catch(catchAndReport('Add role preset'));
  };

  const updatePreset = (id: string, updates: Partial<RolePreset>) => {
    setPresets(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...updates } : p);
      const changed = next.find(p => p.id === id);
      if (changed) upsertRolePresetDb(changed).catch(catchAndReport('Update role preset'));
      return next;
    });
  };

  const deletePreset = (id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id || p.isSystem));
    deleteRolePresetDb(id).catch(catchAndReport('Delete role preset'));
  };

  return (
    <PresetsContext.Provider value={{ presets, addPreset, updatePreset, deletePreset, loading, error }}>
      {children}
    </PresetsContext.Provider>
  );
}

export function usePresets() {
  const ctx = useContext(PresetsContext);
  if (!ctx) throw new Error('usePresets must be used within PresetsProvider');
  return ctx;
}
