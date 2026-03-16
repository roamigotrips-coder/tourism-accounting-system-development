import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type { FormConfiguration, FormField } from '../types/formBuilder';

const STORAGE_KEY = 'accountspro_form_builder_configs_v1';

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
        // Example custom (non-system) fields default
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

function loadFromStorage(): FormConfiguration[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveToStorage(configs: FormConfiguration[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch {}
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
}

const FormBuilderContext = createContext<FormBuilderContextType | null>(null);

export function FormBuilderProvider({ children }: { children: React.ReactNode }) {
  const [configurations, setConfigurations] = useState<FormConfiguration[]>(() => loadFromStorage() || getDefaultConfigs());

  useEffect(() => {
    saveToStorage(configurations);
  }, [configurations]);

  const getConfig = useCallback((formId: string) => {
    return configurations.find((c) => c.formId === formId) || null;
  }, [configurations]);

  const upsertConfiguration = (config: FormConfiguration) => {
    setConfigurations((prev) => {
      const exists = prev.some((c) => c.formId === config.formId);
      return exists ? prev.map((c) => (c.formId === config.formId ? config : c)) : [config, ...prev];
    });
  };

  const deleteConfiguration = (formId: string) => {
    setConfigurations((prev) => prev.filter((c) => c.formId !== formId));
  };

  const addField = (formId: string, field: FormField) => {
    setConfigurations((prev) => prev.map((c) => c.formId === formId ? { ...c, fields: [...c.fields, field] } : c));
  };

  const updateField = (formId: string, field: FormField) => {
    setConfigurations((prev) => prev.map((c) => c.formId === formId ? { ...c, fields: c.fields.map((f) => f.id === field.id ? field : f) } : c));
  };

  const deleteField = (formId: string, fieldId: string) => {
    setConfigurations((prev) => prev.map((c) => c.formId === formId ? { ...c, fields: c.fields.filter((f) => f.id !== fieldId) } : c));
  };

  const reorderField = (formId: string, fieldId: string, dir: 'up' | 'down') => {
    setConfigurations((prev) => prev.map((c) => {
      if (c.formId !== formId) return c;
      const fields = [...c.fields];
      const index = fields.findIndex((f) => f.id === fieldId);
      if (dir === 'up' && index > 0) {
        [fields[index], fields[index - 1]] = [fields[index - 1], fields[index]];
      } else if (dir === 'down' && index < fields.length - 1) {
        [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
      }
      return { ...c, fields };
    }));
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
  }), [configurations, getConfig]);

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
