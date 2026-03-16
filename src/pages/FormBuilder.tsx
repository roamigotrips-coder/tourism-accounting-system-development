import { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Settings, Eye, Edit, X, ChevronDown, ChevronUp,
  LayoutTemplate, Smartphone, Calendar, DollarSign,
  FileText, Hash, CheckCircle, Info, Wifi
} from 'lucide-react';
import { FormConfiguration, FormField } from '../types/formBuilder';

export default function FormBuilder() {
  const [configurations, setConfigurations] = useState<FormConfiguration[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<FormConfiguration | null>(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = () => {
    setConfigurations([
      {
        formId: 'new-booking',
        formName: 'New Booking Form',
        formDescription: 'Form for creating new sales bookings and estimates',
        module: 'sales',
        fields: [
          { id: 'f1', label: 'Agent', fieldKey: 'agent', fieldType: 'dropdown', isRequired: true, order: 1, isSystem: true, options: ['Agent A', 'Agent B', 'Agent C'] },
          { id: 'f2', label: 'Customer Name', fieldKey: 'customerName', fieldType: 'text', isRequired: true, order: 2 },
          { id: 'f3', label: 'Customer Email', fieldKey: 'customerEmail', fieldType: 'text', isRequired: false, order: 3, placeholder: 'email@example.com' },
          { id: 'f4', label: 'Customer Phone', fieldKey: 'customerPhone', fieldType: 'text', isRequired: false, order: 4, placeholder: '+971 XX XXX XXXX' },
          { id: 'f5', label: 'Service Type', fieldKey: 'serviceType', fieldType: 'select', isRequired: true, order: 5, options: ['Tour Package', 'Transfer', 'Hotel Booking', 'Visa Service', 'Ticket', 'Activity'] },
          { id: 'f6', label: 'Service Date', fieldKey: 'serviceDate', fieldType: 'date', isRequired: true, order: 6 },
          { id: 'f7', label: 'Selling Price', fieldKey: 'sellingPrice', fieldType: 'currency', isRequired: true, order: 7 },
          { id: 'f8', label: 'Currency', fieldKey: 'currency', fieldType: 'dropdown', isRequired: true, order: 8, options: ['AED', 'USD', 'EUR', 'GBP'] },
          { id: 'f9', label: 'Payment Status', fieldKey: 'paymentStatus', fieldType: 'toggle', isRequired: true, order: 9 },
          { id: 'f10', label: 'Notes', fieldKey: 'notes', fieldType: 'textarea', isRequired: false, order: 10, placeholder: 'Additional details...' },
        ]
      },
      {
        formId: 'expense-form',
        formName: 'Expense Entry Form',
        formDescription: 'Form for recording operational expenses',
        module: 'expenses',
        fields: [
          { id: 'e1', label: 'Category', fieldKey: 'category', fieldType: 'select', isRequired: true, order: 1, options: ['Fuel', 'Driver Salary', 'Hotel Payments', 'Activity Tickets', 'Office Rent', 'Marketing', 'Other'] },
          { id: 'e2', label: 'Supplier', fieldKey: 'supplier', fieldType: 'dropdown', isRequired: true, order: 2, options: ['Hotel Al Maktoum', 'Al Futtaim Cars', 'Desert Safari Tours'] },
          { id: 'e3', label: 'Amount', fieldKey: 'amount', fieldType: 'currency', isRequired: true, order: 3 },
          { id: 'e4', label: 'Payment Mode', fieldKey: 'paymentMode', fieldType: 'dropdown', isRequired: true, order: 4, options: ['Cash', 'Bank Transfer', 'Card'] },
          { id: 'e5', label: 'Date', fieldKey: 'expenseDate', fieldType: 'date', isRequired: true, order: 5 },
          { id: 'e6', label: 'Status', fieldKey: 'status', fieldType: 'toggle', isRequired: true, order: 6 },
        ]
      },
      {
        formId: 'employee-form',
        formName: 'Employee Form',
        formDescription: 'Form for adding employees to HR module',
        module: 'hr',
        fields: [
          { id: 'h1', label: 'Employee Name', fieldKey: 'name', fieldType: 'text', isRequired: true, order: 1 },
          { id: 'h2', label: 'Email', fieldKey: 'email', fieldType: 'text', isRequired: true, order: 2 },
          { id: 'h3', label: 'Phone', fieldKey: 'phone', fieldType: 'text', isRequired: false, order: 3 },
          { id: 'h4', label: 'Department', fieldKey: 'department', fieldType: 'select', isRequired: true, order: 4, options: ['Sales', 'Operations', 'Finance', 'HR', 'Management'] },
          { id: 'h5', label: 'Role', fieldKey: 'role', fieldType: 'select', isRequired: true, order: 5, options: ['Manager', 'Staff', 'Driver', 'Coordinator', 'Accountant'] },
          { id: 'h6', label: 'Salary', fieldKey: 'salary', fieldType: 'number', isRequired: true, order: 6 },
          { id: 'h7', label: 'Join Date', fieldKey: 'joinDate', fieldType: 'date', isRequired: true, order: 7 },
          { id: 'h8', label: 'Status', fieldKey: 'status', fieldType: 'dropdown', isRequired: true, order: 8, options: ['Active', 'On Leave', 'Inactive'] },
        ]
      },
      {
        formId: 'supplier-form',
        formName: 'Supplier Form',
        formDescription: 'Form for adding new suppliers',
        module: 'suppliers',
        fields: [
          { id: 's1', label: 'Supplier Name', fieldKey: 'name', fieldType: 'text', isRequired: true, order: 1 },
          { id: 's2', label: 'Type', fieldKey: 'type', fieldType: 'select', isRequired: true, order: 2, options: ['Hotel', 'Transport', 'Activity Provider', 'Tickets', 'Visa Services', 'Tour Guide'] },
          { id: 's3', label: 'Contact Person', fieldKey: 'contact', fieldType: 'text', isRequired: false, order: 3 },
          { id: 's4', label: 'Email', fieldKey: 'email', fieldType: 'text', isRequired: false, order: 4 },
          { id: 's5', label: 'Phone', fieldKey: 'phone', fieldType: 'text', isRequired: false, order: 5 },
          { id: 's6', label: 'Payment Terms', fieldKey: 'paymentTerms', fieldType: 'text', isRequired: false, order: 6, placeholder: 'Net 30 days' },
          { id: 's7', label: 'Status', fieldKey: 'status', fieldType: 'dropdown', isRequired: true, order: 7, options: ['Active', 'Inactive'] },
        ]
      }
    ]);
  };

  const addField = (field: FormField) => {
    if (!selectedConfig) return;
    const updated = { ...selectedConfig, fields: [...selectedConfig.fields, field] };
    setSelectedConfig(updated);
    setConfigurations(configs => configs.map(c => c.formId === updated.formId ? updated : c));
    setShowFieldModal(false);
    setEditingField(null);
  };

  const updateField = (field: FormField) => {
    if (!selectedConfig) return;
    const updated = { ...selectedConfig, fields: selectedConfig.fields.map(f => f.id === field.id ? field : f) };
    setSelectedConfig(updated);
    setConfigurations(configs => configs.map(c => c.formId === updated.formId ? updated : c));
    setShowFieldModal(false);
    setEditingField(null);
  };

  const deleteField = (fieldId: string) => {
    if (!selectedConfig) return;
    const field = selectedConfig.fields.find(f => f.id === fieldId);
    if (field?.isSystem) {
      alert('System fields cannot be deleted. You can hide them instead.');
      return;
    }
    const updated = { ...selectedConfig, fields: selectedConfig.fields.filter(f => f.id !== fieldId) };
    setSelectedConfig(updated);
    setConfigurations(configs => configs.map(c => c.formId === updated.formId ? updated : c));
  };

  const reorderFields = (fieldId: string, direction: 'up' | 'down') => {
    if (!selectedConfig) return;
    const fields = [...selectedConfig.fields];
    const index = fields.findIndex(f => f.id === fieldId);
    if (direction === 'up' && index > 0) {
      [fields[index], fields[index - 1]] = [fields[index - 1], fields[index]];
    } else if (direction === 'down' && index < fields.length - 1) {
      [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
    }
    const updated = { ...selectedConfig, fields };
    setSelectedConfig(updated);
    setConfigurations(configs => configs.map(c => c.formId === updated.formId ? updated : c));
  };

  const toggleFieldVisibility = (fieldId: string) => {
    if (!selectedConfig) return;
    const updated = { ...selectedConfig, fields: selectedConfig.fields.map(f => 
      f.id === fieldId ? { ...f, visible: f.visible === undefined ? false : !f.visible } : f
    )};
    setSelectedConfig(updated);
    setConfigurations(configs => configs.map(c => c.formId === updated.formId ? updated : c));
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {!selectedConfig ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Form Builder (Backend Access)</h1>
              <p className="text-gray-600 mt-1">Configure and customize forms across all modules</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <LayoutTemplate className="text-purple-600" size={24} />
              <h2 className="text-xl font-semibold">Available Forms</h2>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">Select a form to manage its fields and configuration:</p>
            
            <div className="grid md:grid-cols-2 gap-4">
              {configurations.map(config => (
                <button
                  key={config.formId}
                  onClick={() => setSelectedConfig(config)}
                  className="text-left p-4 border border-gray-200 rounded-lg hover:border-purple-400 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Settings className="text-purple-500 group-hover:text-purple-600" />
                    <h3 className="font-semibold text-gray-900">{config.formName}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{config.formDescription}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">{config.fields.length} Fields</span>
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">{config.module}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-semibold text-amber-800 mb-1">What Can You Customize?</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• Add new fields (text, dropdown, date, number, currency, toggle, textarea)</li>
                <li>• Edit existing fields (label, required status, placeholder, options, validation)</li>
                <li>• Reorder fields by moving them up/down</li>
                <li>• Hide system fields you don't need</li>
                <li>• Set validation rules (min/max, pattern, length)</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => setSelectedConfig(null)} className="text-gray-500 hover:text-gray-700 flex items-center gap-2 mb-2">
                <ChevronUp size={16} /> Back to Forms
              </button>
              <h1 className="text-3xl font-bold text-gray-900">{selectedConfig.formName}</h1>
              <p className="text-gray-600 mt-1">{selectedConfig.formDescription}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setPreviewMode(!previewMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${previewMode ? 'bg-gray-100 text-gray-700' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
              >
                {previewMode ? <Settings size={18} /> : <Eye size={18} />}
                {previewMode ? 'Edit Mode' : 'Preview Mode'}
              </button>
              <button 
                onClick={() => {
                  setEditingField(null);
                  setShowFieldModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus size={18} />
                Add Field
              </button>
            </div>
          </div>

          {!previewMode ? (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <LayoutTemplate className="text-purple-600" size={24} />
                  <h2 className="text-xl font-semibold">Form Fields</h2>
                  <span className="text-sm text-gray-500">({selectedConfig.fields.length} fields)</span>
                </div>
              </div>

              <div className="space-y-2">
                {selectedConfig.fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-sm transition-all bg-white"
                  >
                    <button
                      onClick={() => reorderFields(field.id, 'up')}
                      disabled={index === 0}
                      className={`p-1 ${index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-purple-600'}`}
                    >
                      <ChevronUp size={18} />
                    </button>
                    <button
                      onClick={() => reorderFields(field.id, 'down')}
                      disabled={index === selectedConfig.fields.length - 1}
                      className={`p-1 ${index === selectedConfig.fields.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-purple-600'}`}
                    >
                      <ChevronDown size={18} />
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {field.isRequired && <span className="text-red-500 font-bold">*</span>}
                        <span className="font-medium text-gray-900">{field.label}</span>
                        {field.isSystem && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">System</span>
                        )}
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{field.fieldType}</span>
                        {field.visible === false && (
                          <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded-full">Hidden</span>
                        )}
                      </div>
                      {field.placeholder && (
                        <p className="text-sm text-gray-500 mt-0.5">Placeholder: {field.placeholder}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFieldVisibility(field.id)}
                        className={`p-2 rounded-lg ${field.visible === false ? 'text-gray-400 hover:text-purple-600' : 'text-purple-600 hover:text-gray-600'}`}
                        title={field.visible === false ? 'Show field' : 'Hide field'}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingField(field);
                          setShowFieldModal(true);
                        }}
                        className="p-2 text-gray-500 hover:text-purple-600 rounded-lg hover:bg-purple-50"
                        title="Edit field"
                      >
                        <Edit size={16} />
                      </button>
                      {!field.isSystem && (
                        <button
                          onClick={() => deleteField(field.id)}
                          className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50"
                          title="Delete field"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <Smartphone className="text-purple-600" size={24} />
                <h2 className="text-xl font-semibold">Form Preview</h2>
              </div>

              <div className="max-w-2xl mx-auto space-y-4">
                {selectedConfig.fields.map(field => {
                  if (field.visible === false) return null;
                  
                  return (
                    <div key={field.id} className="flex flex-col gap-2">
                      <label className="font-medium text-gray-700">
                        {field.label}
                        {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      
                      {renderFieldPreview(field)}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex justify-center gap-4">
                <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                  Cancel
                </button>
                <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                  Save Record
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showFieldModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold">
                {editingField ? 'Edit Field' : 'Add New Field'}
              </h2>
              <button
                onClick={() => {
                  setShowFieldModal(false);
                  setEditingField(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!editingField ? (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { type: 'text', label: 'Text Input', desc: 'Single line text entry' },
                    { type: 'textarea', label: 'Text Area', desc: 'Multi-line text entry' },
                    { type: 'number', label: 'Number', desc: 'Numeric values only' },
                    { type: 'currency', label: 'Currency', desc: 'Amount with currency symbol' },
                    { type: 'date', label: 'Date Picker', desc: 'Date selection' },
                    { type: 'dropdown', label: 'Dropdown', desc: 'Single select from options' },
                    { type: 'select', label: 'Select Menu', desc: 'Single select with search' },
                    { type: 'toggle', label: 'Toggle Switch', desc: 'On/Off boolean' },
                  ].map(({ type, label, desc }) => (
                    <button
                      key={type}
                      onClick={() => {
                        const newField: FormField = {
                          id: `field-${Date.now()}`,
                          label: 'New Field',
                          fieldKey: `field${Date.now()}`,
                          fieldType: type as any,
                          isRequired: false,
                          order: selectedConfig?.fields.length || 0,
                          options: (type === 'dropdown' || type === 'select') ? ['Option 1', 'Option 2'] : undefined,
                        };
                        setEditingField(newField);
                      }}
                      className="p-4 border border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all text-left"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {type === 'text' && <FileText className="text-purple-500" size={20} />}
                        {type === 'textarea' && <FileText className="text-purple-500" size={20} />}
                        {type === 'number' && <Hash className="text-purple-500" size={20} />}
                        {type === 'currency' && <DollarSign className="text-purple-500" size={20} />}
                        {type === 'date' && <Calendar className="text-purple-500" size={20} />}
                        {type === 'dropdown' && <ChevronDown className="text-purple-500" size={20} />}
                        {type === 'select' && <CheckCircle className="text-purple-500" size={20} />}
                        {type === 'toggle' && <Wifi className="text-purple-500" size={20} />}
                        <span className="font-medium text-gray-900">{label}</span>
                      </div>
                      <p className="text-sm text-gray-500">{desc}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Field Label <span className="text-gray-400">(what users see)</span>
                    </label>
                    <input
                      type="text"
                      value={editingField.label}
                      onChange={e => setEditingField({ ...editingField!, label: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      placeholder="e.g. Customer Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Field Key <span className="text-gray-400">(internal system key, unique)</span>
                    </label>
                    <input
                      type="text"
                      value={editingField.fieldKey}
                      onChange={e => setEditingField({ ...editingField!, fieldKey: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      placeholder="e.g. customerName"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingField.isRequired}
                        onChange={e => setEditingField({ ...editingField!, isRequired: e.target.checked })}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm">Required field</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Placeholder Text <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={editingField.placeholder || ''}
                      onChange={e => setEditingField({ ...editingField!, placeholder: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      placeholder="e.g. Enter the customer's full name"
                    />
                  </div>

                  {(editingField.fieldType === 'dropdown' || editingField.fieldType === 'select') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Options (one per line)
                      </label>
                      <textarea
                        value={(editingField.options || []).join('\n')}
                        onChange={e => setEditingField({ 
                          ...editingField!, 
                          options: e.target.value.split('\n').filter(o => o.trim())
                        })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:border-purple-500 min-h-[100px]"
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Validation (optional)</label>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-gray-500">Min Length</label>
                        <input
                          type="number"
                          value={editingField.validation?.minLength || ''}
                          onChange={e => setEditingField({ 
                            ...editingField!, 
                            validation: { ...(editingField.validation || {}), minLength: parseInt(e.target.value) || undefined }
                          })}
                          className="w-full p-2 border border-gray-300 rounded-lg"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Max Length</label>
                        <input
                          type="number"
                          value={editingField.validation?.maxLength || ''}
                          onChange={e => setEditingField({ 
                            ...editingField!, 
                            validation: { ...(editingField.validation || {}), maxLength: parseInt(e.target.value) || undefined }
                          })}
                          className="w-full p-2 border border-gray-300 rounded-lg"
                          placeholder="100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Min Value</label>
                        <input
                          type="number"
                          value={editingField.validation?.min || ''}
                          onChange={e => setEditingField({ 
                            ...editingField!, 
                            validation: { ...(editingField.validation || {}), min: parseInt(e.target.value) || undefined }
                          })}
                          className="w-full p-2 border border-gray-300 rounded-lg"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Max Value</label>
                        <input
                          type="number"
                          value={editingField.validation?.max || ''}
                          onChange={e => setEditingField({ 
                            ...editingField!, 
                            validation: { ...(editingField.validation || {}), max: parseInt(e.target.value) || undefined }
                          })}
                          className="w-full p-2 border border-gray-300 rounded-lg"
                          placeholder="100"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500">Regex Pattern</label>
                        <input
                          type="text"
                          value={editingField.validation?.pattern || ''}
                          onChange={e => setEditingField({ 
                            ...editingField!, 
                            validation: { ...(editingField.validation || {}), pattern: e.target.value }
                          })}
                          className="w-full p-2 border border-gray-300 rounded-lg"
                          placeholder="^\\d+$"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      onClick={() => {
                        setShowFieldModal(false);
                        setEditingField(null);
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (editingField.label && editingField.fieldKey) {
                          if (selectedConfig?.fields.find(f => f.id === editingField.id)) {
                            updateField(editingField);
                          } else {
                            addField(editingField);
                          }
                        }
                      }}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      {selectedConfig?.fields.find(f => f.id === editingField.id) ? 'Update Field' : 'Add Field'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderFieldPreview(field: FormField): React.ReactElement {
  const commonProps = {
    className: 'w-full p-3 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
  };

  switch (field.fieldType) {
    case 'text':
      return <input type="text" {...commonProps} placeholder={field.placeholder || `Enter ${field.label}`} />;
    case 'textarea':
      return <textarea {...commonProps} rows={3} placeholder={field.placeholder || `Enter ${field.label}`} /> as any;
    case 'number':
      return <input type="number" {...commonProps} placeholder={field.placeholder || `Enter ${field.label}`} />;
    case 'currency':
      return (
        <div className="flex">
          <span className="p-3 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-gray-600">AED</span>
          <input type="number" className="flex-1 p-3 border border-gray-300 rounded-r-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200" placeholder="0.00" />
        </div>
      );
    case 'date':
      return <input type="date" {...commonProps} />;
    case 'dropdown':
    case 'select':
      return (
        <select {...commonProps}>
          <option value="">Select {field.label}...</option>
          {(field.options || []).map(opt => <option key={opt}>{opt}</option>)}
        </select>
      );
    case 'toggle':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </div>
          <span className="text-gray-700">Enabled</span>
        </label>
      );
    default:
      return <input type="text" {...commonProps} placeholder={`Enter ${field.label}`} />;
  }
}