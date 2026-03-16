export interface FormField {
  id: string;
  label: string;
  fieldKey: string; // used as state key
  fieldType: 'text' | 'dropdown' | 'date' | 'number' | 'toggle' | 'textarea' | 'currency' | 'select' | 'multi-select';
  isRequired: boolean;
  placeholder?: string;
  options?: string[]; // for dropdowns
  defaultValue?: any;
  order: number;
  section?: string; // for grouping fields
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
  icon?: string; // heroicon name
  isSystem?: boolean; // true if default field that can't be deleted
  visible?: boolean; // controls field visibility
}

export interface FormConfiguration {
  formId: string;
  formName: string;
  formDescription: string;
  module: string; // 'sales', 'expenses', 'hr', etc.
  fields: FormField[];
  isLocked?: boolean;
}

export interface FormFieldConfig extends FormField {
  visible: boolean;
  editable: boolean;
}