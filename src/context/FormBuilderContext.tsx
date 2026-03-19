import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { catchAndReport } from '../lib/toast';
import type { FormConfiguration, FormField } from '../types/formBuilder';
import {
  fetchFormConfigurations as fetchFormConfigurationsDb,
  upsertFormConfiguration as upsertFormConfigurationDb,
  upsertFormConfigurations as upsertFormConfigurationsDb,
  deleteFormConfigurationDb,
} from '../lib/supabaseSync';

function getDefaultConfigs(): FormConfiguration[] {
  return [
    {
      formId: 'new-booking',
      formName: 'New Booking Form',
      formDescription: 'Form for creating new sales bookings and estimates',
      module: 'sales',
      fields: [
        { id: 'f1', label: 'Agent', fieldKey: 'agent', fieldType: 'dropdown', isRequired: true, order: 1, isSystem: true, options: ['Agent A', 'Agent B', 'Agent C'] },
        { id: 'f2', label: 'Customer Name', fieldKey: 'customerName', fieldType: 'text', isRequired: true, order: 2, isSystem: true },
        { id: 'f3', label: 'Customer Email', fieldKey: 'customerEmail', fieldType: 'text', isRequired: false, order: 3, isSystem: true, placeholder: 'email@example.com' },
        { id: 'f4', label: 'Customer Phone', fieldKey: 'customerPhone', fieldType: 'text', isRequired: false, order: 4, isSystem: true, placeholder: '+971 XX XXX XXXX' },
        { id: 'f5', label: 'Service Type', fieldKey: 'serviceType', fieldType: 'select', isRequired: true, order: 5, isSystem: true, options: ['Tour Package', 'Transfer', 'Hotel Booking', 'Visa Service', 'Ticket', 'Activity'] },
        { id: 'f6', label: 'Service Date', fieldKey: 'serviceDate', fieldType: 'date', isRequired: true, order: 6, isSystem: true },
        { id: 'f7', label: 'Selling Price', fieldKey: 'sellingPrice', fieldType: 'currency', isRequired: true, order: 7, isSystem: true },
        { id: 'f8', label: 'Currency', fieldKey: 'currency', fieldType: 'dropdown', isRequired: true, order: 8, isSystem: true, options: ['AED', 'USD', 'EUR', 'GBP'] },
        { id: 'f9', label: 'Payment Status', fieldKey: 'paymentStatus', fieldType: 'toggle', isRequired: true, order: 9, isSystem: true },
        { id: 'f10', label: 'Notes', fieldKey: 'notes', fieldType: 'textarea', isRequired: false, order: 10, isSystem: true, placeholder: 'Additional details...' },
        { id: 'c1', label: 'Booking Source', fieldKey: 'bookingSource', fieldType: 'select', isRequired: false, order: 11, options: ['Website', 'WhatsApp', 'Email', 'Walk-in', 'Agent'] },
        { id: 'c2', label: 'Passenger Count', fieldKey: 'paxCount', fieldType: 'number', isRequired: false, order: 12, placeholder: 'e.g. 4' },
      ],
    },
    {
      formId: 'expense-form',
      formName: 'Expense Entry Form',
      formDescription: 'Form for recording operational expenses',
      module: 'expenses',
      fields: [
        { id: 'e1', label: 'Category', fieldKey: 'category', fieldType: 'select', isRequired: true, order: 1, isSystem: true, options: ['Fuel', 'Driver Salary', 'Hotel Payments', 'Activity Tickets', 'Office Rent', 'Marketing', 'Other'] },
        { id: 'e2', label: 'Supplier', fieldKey: 'supplier', fieldType: 'dropdown', isRequired: true, order: 2, isSystem: true, options: ['Hotel Al Maktoum', 'Al Futtaim Cars', 'Desert Safari Tours'] },
        { id: 'e3', label: 'Amount', fieldKey: 'amount', fieldType: 'currency', isRequired: true, order: 3, isSystem: true },
        { id: 'e4', label: 'Payment Mode', fieldKey: 'paymentMode', fieldType: 'dropdown', isRequired: true, order: 4, isSystem: true, options: ['Cash', 'Bank Transfer', 'Card'] },
        { id: 'e5', label: 'Date', fieldKey: 'expenseDate', fieldType: 'date', isRequired: true, order: 5, isSystem: true },
        { id: 'e6', label: 'Status', fieldKey: 'status', fieldType: 'toggle', isRequired: true, order: 6, isSystem: true },
      ],
    },
  ];
}

interface FormBuilderContextType {
  configurations: FormConfiguration[];
  getConfig: (formId: string) => FormConfiguration | null;
  setConfigurations: React.Dispatch<React.SetStateAction<FormConfiguration[]>>;
  upsertConfiguration: (config: FormConfiguration) => void;
  deleteConfiguration: (formId: string) => void;
  addField: (formId: string, field: FormField) => void;
  updateField: (formId: string, field: FormField) => void;
  deleteField: (formId: string, fieldId: string) => void;
  reorderField: (formId: string, fieldId: string, dir: 'up' | 'down') => void;
  loading: boolean;
  error: string | null;
}

const FormBuilderContext = createContext<FormBuilderContextType | null>(null);

export function FormBuilderProvider({ children }: { children: React.ReactNode }) {
  const [configurations, setConfigurationsState] = useState<FormConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load from Supabase on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchFormConfigurationsDb();
        if (cancelled) return;
        if (data !== null && data.length > 0) {
          setConfigurationsState(data);
        } else {
          const defaults = getDefaultConfigs();
          setConfigurationsState(defaults);
          upsertFormConfigurationsDb(defaults).catch(catchAndReport('Seed default form configurations'));
        }
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Failed to load form configurations');
          setConfigurationsState(getDefaultConfigs());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getConfig = useCallback((formId: string) => {
    return configurations.find((c) => c.formId === formId) || null;
  }, [configurations]);

  const setConfigurations: React.Dispatch<React.SetStateAction<FormConfiguration[]>> = (action) => {
    setConfigurationsState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      return next;
    });
  };

  const syncConfig = (formId: string, configs: FormConfiguration[]) => {
    const config = configs.find(c => c.formId === formId);
    if (config) upsertFormConfigurationDb(config).catch(catchAndReport('Sync form configuration'));
  };

  const upsertConfiguration = (config: FormConfiguration) => {
    setConfigurationsState((prev) => {
      const exists = prev.some((c) => c.formId === config.formId);
      const next = exists ? prev.map((c) => (c.formId === config.formId ? config : c)) : [config, ...prev];
      upsertFormConfigurationDb(config).catch(catchAndReport('Save form configuration'));
      return next;
    });
  };

  const deleteConfiguration = (formId: string) => {
    setConfigurationsState((prev) => prev.filter((c) => c.formId !== formId));
    deleteFormConfigurationDb(formId).catch(catchAndReport('Delete form configuration'));
  };

  const addField = (formId: string, field: FormField) => {
    setConfigurationsState((prev) => {
      const next = prev.map((c) => c.formId === formId ? { ...c, fields: [...c.fields, field] } : c);
      syncConfig(formId, next);
      return next;
    });
  };

  const updateField = (formId: string, field: FormField) => {
    setConfigurationsState((prev) => {
      const next = prev.map((c) => c.formId === formId ? { ...c, fields: c.fields.map((f) => f.id === field.id ? field : f) } : c);
      syncConfig(formId, next);
      return next;
    });
  };

  const deleteField = (formId: string, fieldId: string) => {
    setConfigurationsState((prev) => {
      const next = prev.map((c) => c.formId === formId ? { ...c, fields: c.fields.filter((f) => f.id !== fieldId) } : c);
      syncConfig(formId, next);
      return next;
    });
  };

  const reorderField = (formId: string, fieldId: string, dir: 'up' | 'down') => {
    setConfigurationsState((prev) => {
      const next = prev.map((c) => {
        if (c.formId !== formId) return c;
        const fields = [...c.fields];
        const index = fields.findIndex((f) => f.id === fieldId);
        if (dir === 'up' && index > 0) {
          [fields[index], fields[index - 1]] = [fields[index - 1], fields[index]];
        } else if (dir === 'down' && index < fields.length - 1) {
          [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
        }
        return { ...c, fields };
      });
      syncConfig(formId, next);
      return next;
    });
  };

  const value = useMemo(() => ({
    configurations,
    getConfig,
    setConfigurations,
    upsertConfiguration,
    deleteConfiguration,
    addField,
    updateField,
    deleteField,
    reorderField,
    loading,
    error,
  }), [configurations, getConfig, loading, error]);

  return (
    <FormBuilderContext.Provider value={value}>
      {children}
    </FormBuilderContext.Provider>
  );
}

export function useFormBuilder() {
  const ctx = useContext(FormBuilderContext);
  if (!ctx) throw new Error('useFormBuilder must be used within FormBuilderProvider');
  return ctx;
}
