import { useEffect, useMemo, useState } from 'react';
import { Plus, Clock, Save, User, Folder, PenSquare, Trash2 } from 'lucide-react';
import {
  fetchProjects as fetchProjectsDb, upsertProject as upsertProjectDb, deleteProjectDb,
  fetchTimeEntries as fetchTimeEntriesDb, upsertTimeEntry as upsertTimeEntryDb, deleteTimeEntryDb,
  type Project, type TimeEntry,
} from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

function minutesToHhmm(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from Supabase
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [projs, ents] = await Promise.all([fetchProjectsDb(), fetchTimeEntriesDb()]);
        if (cancelled) return;
        if (projs) setProjects(projs);
        if (ents) setEntries(ents);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load projects');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Derived
  const totals = useMemo(() => {
    const byProj: Record<string, { minutes: number; amount: number }> = {};
    for (const p of projects) byProj[p.id] = { minutes: 0, amount: 0 };
    for (const e of entries) {
      const p = projects.find(pr => pr.id === e.projectId);
      if (!p) continue;
      byProj[p.id].minutes += e.durationMin;
      byProj[p.id].amount += (e.durationMin/60) * (p.hourlyRate || 0);
    }
    return byProj;
  }, [projects, entries]);

  // Forms state
  const [pForm, setPForm] = useState<Partial<Project>>({ status: 'Active', hourlyRate: 0 });
  const [tForm, setTForm] = useState<Partial<TimeEntry>>({ date: new Date().toISOString().split('T')[0], durationMin: 60 });

  const resetProjectForm = () => setPForm({ status: 'Active', hourlyRate: 0 });
  const resetTimeForm = () => setTForm({ date: new Date().toISOString().split('T')[0], durationMin: 60 });

  const openNewProject = () => { setEditingProject(null); resetProjectForm(); setShowProjectModal(true); };
  const openEditProject = (p: Project) => { setEditingProject(p); setPForm(p); setShowProjectModal(true); };

  const openNewEntry = (projectId?: string) => { setEditingEntry(null); resetTimeForm(); setTForm(prev => ({...prev, projectId })); setShowEntryModal(true); };
  const openEditEntry = (e: TimeEntry) => { setEditingEntry(e); setTForm(e); setShowEntryModal(true); };

  const saveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pForm.name || !pForm.status) return;
    if (editingProject) {
      const updated = { ...(editingProject as Project), ...(pForm as Project) };
      setProjects(prev => prev.map(pp => pp.id === editingProject.id ? updated : pp));
      upsertProjectDb(updated).catch(() => {});
    } else {
      const newProj: Project = { id: `PROJ-${Date.now()}`, name: pForm.name!, client: pForm.client||'', code: pForm.code||'', status: (pForm.status as any)||'Active', hourlyRate: Number(pForm.hourlyRate)||0, budgetHours: pForm.budgetHours ? Number(pForm.budgetHours) : undefined, createdAt: new Date().toISOString() };
      setProjects(prev => [...prev, newProj]);
      upsertProjectDb(newProj).catch(() => {});
    }
    setShowProjectModal(false);
  };

  const saveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tForm.projectId || !tForm.date || !tForm.durationMin) return;
    if (editingEntry) {
      const updated: TimeEntry = { ...(editingEntry as TimeEntry), ...(tForm as TimeEntry), durationMin: Number(tForm.durationMin) };
      setEntries(prev => prev.map(te => te.id === editingEntry.id ? updated : te));
      upsertTimeEntryDb(updated).catch(() => {});
    } else {
      const newEntry: TimeEntry = { id: `TE-${Date.now()}`, projectId: String(tForm.projectId), user: tForm.user||'Unassigned', date: String(tForm.date), notes: tForm.notes||'', durationMin: Number(tForm.durationMin)||0 };
      setEntries(prev => [...prev, newEntry]);
      upsertTimeEntryDb(newEntry).catch(() => {});
    }
    setShowEntryModal(false);
  };

  const deleteProject = (id: string) => {
    if (entries.some(e => e.projectId === id)) return alert('Cannot delete: this project has time entries.');
    setProjects(prev => prev.filter(p => p.id !== id));
    deleteProjectDb(id).catch(() => {});
  };
  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    deleteTimeEntryDb(id).catch(() => {});
  };

  if (loading) return <LoadingSpinner message="Loading projects..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Projects & Time Tracking</h1>
          <p className="text-slate-500 text-sm">Track work by project, log time, and prepare for invoicing.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openNewProject} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700"><Plus size={16}/> New Project</button>
          <button onClick={() => openNewEntry()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><Clock size={16}/> Log Time</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {projects.slice(0,4).map(p => (
          <div key={p.id} className="border border-slate-200 rounded-xl p-4 bg-white">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-slate-800 truncate" title={p.name}>{p.name}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${p.status==='Active'?'bg-emerald-100 text-emerald-700':p.status==='Paused'?'bg-amber-100 text-amber-700':'bg-slate-200 text-slate-600'}`}>{p.status}</span>
            </div>
            <div className="text-xs text-slate-500 mb-2 flex items-center gap-1"><User size={12}/> {p.client||'—'}</div>
            <div className="flex items-end justify-between">
              <div className="text-sm text-slate-500">Logged</div>
              <div className="text-lg font-bold text-slate-800">{minutesToHhmm(totals[p.id]?.minutes||0)} h</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="font-semibold text-slate-800">Projects</div>
            <div className="text-xs text-slate-500">{projects.length} total</div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr><th className="text-left px-3 py-2">Code</th><th className="text-left px-3 py-2">Project</th><th className="text-left px-3 py-2">Client</th><th className="text-right px-3 py-2">Rate</th><th className="text-right px-3 py-2">Logged</th><th className="px-3 py-2 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500">{p.code||'—'}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                  <td className="px-3 py-2 text-slate-500">{p.client||'—'}</td>
                  <td className="px-3 py-2 text-right">{p.hourlyRate.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                  <td className="px-3 py-2 text-right">{minutesToHhmm(totals[p.id]?.minutes||0)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openNewEntry(p.id)} className="text-blue-600 hover:text-blue-800" title="Log Time"><PenSquare size={16}/></button>
                      <button onClick={() => openEditProject(p)} className="text-slate-600 hover:text-slate-800" title="Edit"><Folder size={16}/></button>
                      <button onClick={() => deleteProject(p.id)} className="text-red-500 hover:text-red-700" title="Delete"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Time entries */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="font-semibold text-slate-800">Time Entries</div>
            <div className="text-xs text-slate-500">{entries.length} records</div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr><th className="text-left px-3 py-2">Project</th><th className="text-left px-3 py-2">User</th><th className="text-left px-3 py-2">Date</th><th className="text-right px-3 py-2">Time</th><th className="px-3 py-2 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const p = projects.find(pp => pp.id === e.projectId);
                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{p?.name || '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{e.user || '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{e.date}</td>
                    <td className="px-3 py-2 text-right">{minutesToHhmm(e.durationMin)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => openEditEntry(e)} className="text-slate-600 hover:text-slate-800" title="Edit"><PenSquare size={16}/></button>
                        <button onClick={() => deleteEntry(e.id)} className="text-red-500 hover:text-red-700" title="Delete"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="font-semibold text-slate-800">{editingProject?'Edit Project':'New Project'}</div>
              <button onClick={() => setShowProjectModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={saveProject} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
                <input value={pForm.name||''} onChange={e=>setPForm(v=>({...v,name:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
                  <input value={pForm.client||''} onChange={e=>setPForm(v=>({...v,client:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                  <input value={pForm.code||''} onChange={e=>setPForm(v=>({...v,code:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate</label>
                  <input type="number" step="0.01" value={pForm.hourlyRate||0} onChange={e=>setPForm(v=>({...v,hourlyRate:Number(e.target.value)}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Budget (hours)</label>
                  <input type="number" step="0.1" value={pForm.budgetHours||''} onChange={e=>setPForm(v=>({...v,budgetHours:Number(e.target.value)}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={pForm.status as any} onChange={e=>setPForm(v=>({...v,status:e.target.value as any}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm">
                  <option>Active</option>
                  <option>Paused</option>
                  <option>Completed</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={()=>setShowProjectModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"><Save size={16}/> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Time Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="font-semibold text-slate-800">{editingEntry?'Edit Time Entry':'Log Time'}</div>
              <button onClick={() => setShowEntryModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={saveEntry} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project *</label>
                <select required value={tForm.projectId||''} onChange={e=>setTForm(v=>({...v,projectId:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm">
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">User</label>
                  <input value={tForm.user||''} onChange={e=>setTForm(v=>({...v,user:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input type="date" required value={tForm.date as any} onChange={e=>setTForm(v=>({...v,date:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duration (minutes) *</label>
                  <input type="number" required min={1} value={tForm.durationMin as any} onChange={e=>setTForm(v=>({...v,durationMin:Number(e.target.value)}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <input value={tForm.notes||''} onChange={e=>setTForm(v=>({...v,notes:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={()=>setShowEntryModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"><Save size={16}/> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
