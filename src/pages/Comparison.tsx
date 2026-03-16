import { CheckCircle2, XCircle, Lightbulb, Target, Sparkles, ArrowRight, Rocket, PlugZap, ShieldCheck, Workflow } from 'lucide-react';

export default function Comparison() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">AccountsPro vs Zoho Books</h1>
          <p className="text-slate-500 mt-1">Honest comparison, gaps, and a practical roadmap to reach parity and differentiate for tourism/DMC workflows.</p>
        </div>
      </div>

      {/* Overview */}
      <section className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold"><Sparkles size={18}/> Where we shine</div>
          <ul className="mt-3 text-sm text-slate-600 space-y-2 list-disc list-inside">
            <li>Built-in DMC modules: Sales & Booking Estimate, Agent Portal, Supplier Automation</li>
            <li>Tour Package Costing with live profit & loss</li>
            <li>Bank Reconciliation tailored to tourism operations</li>
            <li>HR + Transport + Operations in one place</li>
            <li>Form Builder and section-based permissions</li>
          </ul>
        </div>
        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 text-blue-600 font-semibold"><ShieldCheck size={18}/> Zoho Books strengths</div>
          <ul className="mt-3 text-sm text-slate-600 space-y-2 list-disc list-inside">
            <li>Mature double-entry engine and compliance in many countries</li>
            <li>Bank feeds, rules, and automatic reconciliation</li>
            <li>Advanced invoicing, estimates, retainer invoices, reminders</li>
            <li>Deep reporting, multi-currency, projects, timesheets</li>
            <li>Mobile apps, public API, marketplace integrations</li>
          </ul>
        </div>
        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 text-amber-600 font-semibold"><Lightbulb size={18}/> Strategy</div>
          <ul className="mt-3 text-sm text-slate-600 space-y-2 list-disc list-inside">
            <li>Win on vertical depth (tourism/DMC) + great UX for freshers</li>
            <li>Reach parity on core accounting (GL/JE/TB/COA)</li>
            <li>Selective parity on bank feeds, automation, and approvals</li>
            <li>Offer migration/imports to switch from other tools</li>
          </ul>
        </div>
      </section>

      {/* Parity scorecard */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Core feature parity</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {label:'Chart of Accounts', status:'Ready'},
            {label:'General Ledger', status:'Ready'},
            {label:'Journal Entries', status:'Ready'},
            {label:'Trial Balance', status:'Ready'},
            {label:'Recurring Billing', status:'Beta'},
            {label:'Audit Trail', status:'Beta'},
            {label:'Inventory Management', status:'Beta'},
            {label:'Fixed Asset Management', status:'Beta'},
            {label:'Bank Reconciliation', status:'Ready'},
            {label:'Invoices & Payments', status:'Ready'},
            {label:'Online Payments', status:'Beta'},
            {label:'Form Builder', status:'Ready'},
          ].map(({label,status})=> (
            <div key={label} className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-700">{label}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                status==='Ready' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                status==='Beta' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-slate-50 text-slate-600 border border-slate-200'
              }`}>{status}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Gaps vs Zoho */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Gaps vs Zoho Books (Opportunities)</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-slate-700 font-semibold mb-2"><XCircle className="text-rose-500" size={18}/> Currently behind</div>
            <ul className="mt-2 text-sm text-slate-600 space-y-2 list-disc list-inside">
              <li>Bank feeds (automatic statements), bank rules</li>
              <li>Multi-currency with revaluation and FX gains/losses</li>
              <li>Advanced recurring billing (schedules, proration)</li>
              <li>Document attachments with OCR and email-in</li>
              <li>Project/time tracking, retainer invoices</li>
              <li>Automation: if-this-then-that workflows</li>
              <li>Public API + webhooks + integrations marketplace</li>
              <li>Mobile apps (iOS/Android) for receipts, approvals</li>
              <li>Deep reporting: cash flow, AR/AP aging, custom reports</li>
            </ul>
          </div>
          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-slate-700 font-semibold mb-2"><CheckCircle2 className="text-emerald-600" size={18}/> Strengthen further</div>
            <ul className="mt-2 text-sm text-slate-600 space-y-2 list-disc list-inside">
              <li>Approvals: estimates → finance → invoice (multi-step)</li>
              <li>Permissions: field-level + maker/checker flows</li>
              <li>Inventory: FIFO/LIFO, batches/serials, price lists, landed costs</li>
              <li>Fixed assets: depreciation methods, asset register, disposals</li>
              <li>Audit Trail: immutable logs with before/after values</li>
              <li>Attachments: drag-drop on all transactions</li>
              <li>Budgeting + cost centers (MVP scope later)</li>
              <li>VAT: return filing export (FTA XML/Excel) + adjustments</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Recommended roadmap */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Recommended roadmap</h2>
        <ol className="space-y-3">
          <li className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 font-semibold text-slate-800"><Target size={18}/> Phase 1 — Core parity (4–6 weeks)</div>
            <ul className="mt-2 text-sm text-slate-600 space-y-2 list-disc list-inside">
              <li>Harden Double-Entry modules (GL, JE, TB, COA) with validations</li>
              <li>Finance Approval Queue → finalized invoices + postings</li>
              <li>Bank Reconciliation: add rules, import mapping presets</li>
              <li>Attachments on invoices, expenses, JEs (files + notes)</li>
              <li>Audit Trail v2 with diff view and export</li>
            </ul>
          </li>
          <li className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 font-semibold text-slate-800"><Workflow size={18}/> Phase 2 — Automation & multi-currency (6–8 weeks)</div>
            <ul className="mt-2 text-sm text-slate-600 space-y-2 list-disc list-inside">
              <li>Bank feeds via provider (Salt/Mono/Plaid regionally), matching rules</li>
              <li>Multi-currency (document currency + base, revaluation JE)</li>
              <li>Recurring billing v2 with schedules and proration</li>
              <li>Approvals engine (maker-checker, thresholds)</li>
            </ul>
          </li>
          <li className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 font-semibold text-slate-800"><Rocket size={18}/> Phase 3 — Advanced inventory & assets (8–10 weeks)</div>
            <ul className="mt-2 text-sm text-slate-600 space-y-2 list-disc list-inside">
              <li>Inventory: FIFO, batches/serials, landed cost allocation</li>
              <li>Assets: depreciation schedules, adjustments, disposal JEs</li>
              <li>Projects: basic job-costing for packages/tours</li>
            </ul>
          </li>
        </ol>
      </section>

      {/* How it works today */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">How AccountsPro works today (simple terms)</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="font-semibold text-slate-800 mb-1">Money coming in</div>
            <ul className="text-sm text-slate-600 space-y-2 list-disc list-inside">
              <li>Create an estimate in Sales & Booking Estimate</li>
              <li>Send to Finance for approval → auto-creates invoice</li>
              <li>Record payment (bank/cash) → marks invoice as paid</li>
              <li>Appears in General Ledger and reports</li>
            </ul>
          </div>
          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="font-semibold text-slate-800 mb-1">Money going out</div>
            <ul className="text-sm text-slate-600 space-y-2 list-disc list-inside">
              <li>Create purchases/expenses with suppliers</li>
              <li>Attach bills, tickets, or receipts</li>
              <li>Pay suppliers from Bank & Cash</li>
              <li>Reconcile with bank statements</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Integration readiness */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Integration and extensibility</h2>
        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <ul className="text-sm text-slate-600 space-y-2 list-disc list-inside">
            <li>Extensible via Form Builder to add fields without code</li>
            <li>Pluggable payments (Stripe/Telr/Tap/Payfort) — roadmap</li>
            <li>Public API + webhooks — roadmap</li>
            <li>Data export: CSV/XLSX everywhere</li>
          </ul>
          <div className="mt-3 text-xs text-slate-500 flex items-center gap-1"><PlugZap size={14}/> Want a specific integration? We can add connectors based on priority.</div>
        </div>
      </section>

      {/* CTA */}
      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div>
          <div className="font-semibold text-emerald-800">Your feedback shapes our roadmap</div>
          <div className="text-sm text-emerald-700">Tell us which features you need next to match or beat Zoho Books.</div>
        </div>
        <button className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md">
          Share priorities <ArrowRight size={16}/>
        </button>
      </div>
    </div>
  );
}
