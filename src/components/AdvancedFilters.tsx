import { useState } from 'react';
import { Filter, X, Save, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number' | 'dateRange';
  options?: { label: string; value: string }[];
  placeholder?: string;
}

export interface FilterValues { [key: string]: string; }
export interface SavedPreset { name: string; filters: FilterValues; }

interface AdvancedFiltersProps {
  fields: FilterField[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  presets?: SavedPreset[];
  onSavePreset?: (preset: SavedPreset) => void;
}

export default function AdvancedFilters({ fields, values, onChange, presets, onSavePreset }: AdvancedFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const activeCount = Object.values(values).filter(v => v && v.trim()).length;

  const reset = () => {
    const empty: FilterValues = {};
    fields.forEach(f => { empty[f.key] = ''; });
    onChange(empty);
  };

  const update = (key: string, value: string) => {
    onChange({ ...values, [key]: value });
  };

  const savePreset = () => {
    if (!presetName.trim() || !onSavePreset) return;
    onSavePreset({ name: presetName.trim(), filters: { ...values } });
    setPresetName('');
    setShowSave(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm">
          <Filter size={14} className="text-slate-400" />
          <span className="font-medium text-slate-600">Filters</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">{activeCount}</span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          {presets && presets.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Presets:</span>
              {presets.map(p => (
                <button key={p.name} onClick={() => onChange(p.filters)} className="px-2 py-1 bg-slate-50 hover:bg-emerald-50 text-xs text-slate-600 hover:text-emerald-700 rounded-md transition-colors">{p.name}</button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {fields.map(field => (
              <div key={field.key}>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">{field.label}</label>
                {field.type === 'select' ? (
                  <select value={values[field.key] || ''} onChange={e => update(field.key, e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white">
                    <option value="">All</option>
                    {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type === 'dateRange' ? 'date' : field.type}
                    value={values[field.key] || ''}
                    onChange={e => update(field.key, e.target.value)}
                    placeholder={field.placeholder || field.label}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
            <div className="flex items-center gap-2">
              <button onClick={reset} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                <RotateCcw size={12} /> Reset
              </button>
              {onSavePreset && !showSave && (
                <button onClick={() => setShowSave(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                  <Save size={12} /> Save Preset
                </button>
              )}
              {showSave && (
                <div className="flex items-center gap-1">
                  <input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Preset name..." className="px-2 py-1 border border-slate-200 rounded text-xs w-28" onKeyDown={e => e.key === 'Enter' && savePreset()} />
                  <button onClick={savePreset} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                  <button onClick={() => setShowSave(false)} className="text-slate-400"><X size={12} /></button>
                </div>
              )}
            </div>
            {activeCount > 0 && <span className="text-[10px] text-slate-400">{activeCount} filter{activeCount !== 1 ? 's' : ''} active</span>}
          </div>
        </div>
      )}
    </div>
  );
}
