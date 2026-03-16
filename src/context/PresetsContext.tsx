import { createContext, useContext, useState, ReactNode } from 'react';

export type PermLevel = 'none' | 'view' | 'edit' | 'full';

export interface RolePreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  permissions: Record<string, PermLevel>;
  isSystem: boolean; // system presets can't be deleted
}

const DEFAULT_PRESETS: RolePreset[] = [
  {
    id: 'admin',
    name: 'Admin',
    emoji: '👑',
    description: 'Full access to all modules',
    color: 'red',
    isSystem: true,
    permissions: { revenue: 'full', operations: 'full', finance: 'full', tools: 'full' },
  },
  {
    id: 'manager',
    name: 'Manager',
    emoji: '🎯',
    description: 'Edit access to all, view-only tools',
    color: 'blue',
    isSystem: true,
    permissions: { revenue: 'edit', operations: 'edit', finance: 'edit', tools: 'view' },
  },
  {
    id: 'sales',
    name: 'Sales Staff',
    emoji: '💼',
    description: 'Revenue full, limited finance & ops',
    color: 'emerald',
    isSystem: true,
    permissions: { revenue: 'full', operations: 'view', finance: 'view', tools: 'edit' },
  },
  {
    id: 'accountant',
    name: 'Accountant',
    emoji: '📊',
    description: 'Finance full access, limited others',
    color: 'violet',
    isSystem: true,
    permissions: { revenue: 'view', operations: 'edit', finance: 'full', tools: 'view' },
  },
  {
    id: 'operations',
    name: 'Operations',
    emoji: '⚙️',
    description: 'Operations full, view others',
    color: 'amber',
    isSystem: true,
    permissions: { revenue: 'view', operations: 'full', finance: 'view', tools: 'view' },
  },
  {
    id: 'driver',
    name: 'Driver',
    emoji: '🚗',
    description: 'Operations view only, tools view',
    color: 'slate',
    isSystem: true,
    permissions: { revenue: 'none', operations: 'view', finance: 'none', tools: 'view' },
  },
  {
    id: 'noaccess',
    name: 'No Access',
    emoji: '🔒',
    description: 'No access to any module',
    color: 'gray',
    isSystem: true,
    permissions: { revenue: 'none', operations: 'none', finance: 'none', tools: 'none' },
  },
];

interface PresetsContextType {
  presets: RolePreset[];
  addPreset: (preset: Omit<RolePreset, 'id' | 'isSystem'>) => void;
  updatePreset: (id: string, preset: Partial<RolePreset>) => void;
  deletePreset: (id: string) => void;
}

const PresetsContext = createContext<PresetsContextType | null>(null);

export function PresetsProvider({ children }: { children: ReactNode }) {
  const [presets, setPresets] = useState<RolePreset[]>(DEFAULT_PRESETS);

  const addPreset = (preset: Omit<RolePreset, 'id' | 'isSystem'>) => {
    const id = preset.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    setPresets(prev => [...prev, { ...preset, id, isSystem: false }]);
  };

  const updatePreset = (id: string, updates: Partial<RolePreset>) => {
    setPresets(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePreset = (id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id || p.isSystem));
  };

  return (
    <PresetsContext.Provider value={{ presets, addPreset, updatePreset, deletePreset }}>
      {children}
    </PresetsContext.Provider>
  );
}

export function usePresets() {
  const ctx = useContext(PresetsContext);
  if (!ctx) throw new Error('usePresets must be used within PresetsProvider');
  return ctx;
}
