// ─── Approval Threshold Engine ────────────────────────────────────────────────
// Reads CFO threshold from Settings (localStorage) and determines
// which approver role is required based on amount and document type.

export interface ThresholdRule {
  id: string;
  name: string;
  module: 'Invoice' | 'Expense' | 'Purchase' | 'Journal Entry' | 'All';
  minAmount: number;
  maxAmount: number | null; // null = unlimited
  approverRole: string;
  approverLabel: string;
  sequence: number;         // lower = checked first
  requiresSecondApproval: boolean;
  secondApproverRole?: string;
  isActive: boolean;
}

export interface ApprovalRouting {
  primaryApprover: string;
  primaryLabel: string;
  requiresSecondApproval: boolean;
  secondApprover?: string;
  ruleName: string;
  ruleId: string;
}

// ─── Load CFO threshold from Settings localStorage ────────────────────────────
export function getCFOThreshold(): number {
  try {
    const enabled = localStorage.getItem('accountspro.approval.fixedCfoThreshold') === 'true';
    if (!enabled) return 5000; // default
    const amount = parseFloat(localStorage.getItem('accountspro.approval.cfoThresholdAmount') || '5000');
    return isNaN(amount) ? 5000 : amount;
  } catch {
    return 5000;
  }
}

// ─── Build threshold rules from Settings ─────────────────────────────────────
export function buildThresholdRules(): ThresholdRule[] {
  const cfoThreshold = getCFOThreshold();

  return [
    // Below CFO threshold → Finance Manager
    {
      id: 'TR-001',
      name: `Below AED ${cfoThreshold.toLocaleString()} — Finance Manager`,
      module: 'Invoice',
      minAmount: 0,
      maxAmount: cfoThreshold - 0.01,
      approverRole: 'finance_manager',
      approverLabel: 'Finance Manager',
      sequence: 1,
      requiresSecondApproval: false,
      isActive: true,
    },
    // At or above CFO threshold → CFO
    {
      id: 'TR-002',
      name: `AED ${cfoThreshold.toLocaleString()} and above — CFO Approval`,
      module: 'Invoice',
      minAmount: cfoThreshold,
      maxAmount: null,
      approverRole: 'cfo',
      approverLabel: 'CFO',
      sequence: 2,
      requiresSecondApproval: true,
      secondApproverRole: 'finance_director',
      isActive: true,
    },
    // Expenses below threshold → Finance Manager
    {
      id: 'TR-003',
      name: `Expense below AED ${cfoThreshold.toLocaleString()} — Finance Manager`,
      module: 'Expense',
      minAmount: 0,
      maxAmount: cfoThreshold - 0.01,
      approverRole: 'finance_manager',
      approverLabel: 'Finance Manager',
      sequence: 1,
      requiresSecondApproval: false,
      isActive: true,
    },
    // Expenses at or above threshold → CFO
    {
      id: 'TR-004',
      name: `Expense AED ${cfoThreshold.toLocaleString()}+ — CFO Approval`,
      module: 'Expense',
      minAmount: cfoThreshold,
      maxAmount: null,
      approverRole: 'cfo',
      approverLabel: 'CFO',
      sequence: 2,
      requiresSecondApproval: true,
      secondApproverRole: 'finance_director',
      isActive: true,
    },
    // Purchase Orders → Finance Manager always (separate stream)
    {
      id: 'TR-005',
      name: 'Purchase Order — Finance Manager',
      module: 'Purchase',
      minAmount: 0,
      maxAmount: null,
      approverRole: 'finance_manager',
      approverLabel: 'Finance Manager',
      sequence: 1,
      requiresSecondApproval: false,
      isActive: true,
    },
    // Journal Entries → Senior Accountant + Finance Manager
    {
      id: 'TR-006',
      name: 'Journal Entry — Senior Accountant + Finance Manager',
      module: 'Journal Entry',
      minAmount: 0,
      maxAmount: null,
      approverRole: 'senior_accountant',
      approverLabel: 'Senior Accountant',
      sequence: 1,
      requiresSecondApproval: true,
      secondApproverRole: 'finance_manager',
      isActive: true,
    },
  ];
}

// ─── Route a document to the correct approver ─────────────────────────────────
export function routeApproval(
  amount: number,
  module: ThresholdRule['module'],
): ApprovalRouting {
  const rules = buildThresholdRules()
    .filter(r => r.isActive && (r.module === module || r.module === 'All'))
    .filter(r => {
      const aboveMin = amount >= r.minAmount;
      const belowMax = r.maxAmount === null || amount <= r.maxAmount;
      return aboveMin && belowMax;
    })
    .sort((a, b) => a.sequence - b.sequence);

  if (rules.length === 0) {
    // Fallback
    return {
      primaryApprover: 'finance_manager',
      primaryLabel: 'Finance Manager',
      requiresSecondApproval: false,
      ruleName: 'Default',
      ruleId: 'default',
    };
  }

  const rule = rules[0];
  return {
    primaryApprover: rule.approverRole,
    primaryLabel: rule.approverLabel,
    requiresSecondApproval: rule.requiresSecondApproval,
    secondApprover: rule.secondApproverRole,
    ruleName: rule.name,
    ruleId: rule.id,
  };
}

// ─── Get human-readable workflow steps ───────────────────────────────────────
export function getWorkflowSteps(routing: ApprovalRouting): {
  step: number;
  role: string;
  label: string;
  status: 'pending' | 'active' | 'done';
}[] {
  const steps = [
    { step: 1, role: 'maker', label: 'Maker Creates', status: 'done' as const },
    { step: 2, role: 'reviewer', label: 'Reviewer', status: 'active' as const },
    { step: 3, role: routing.primaryApprover, label: routing.primaryLabel, status: 'pending' as const },
  ];

  if (routing.requiresSecondApproval && routing.secondApprover) {
    steps.push({ step: 4, role: routing.secondApprover, label: 'Finance Director', status: 'pending' as const });
  }

  steps.push({ step: steps.length + 1, role: 'finance', label: 'Post to GL', status: 'pending' as const });

  return steps;
}

// ─── Database schema (for reference / documentation) ─────────────────────────
export const APPROVAL_SCHEMA = {
  approval_workflows: {
    columns: [
      { name: 'id', type: 'UUID', pk: true },
      { name: 'module', type: "ENUM('Invoice','Expense','Purchase','Journal Entry','All')", nullable: false },
      { name: 'threshold_amount', type: 'DECIMAL(15,4)', nullable: false },
      { name: 'approver_role', type: 'VARCHAR(100)', nullable: false },
      { name: 'sequence', type: 'INT', nullable: false, default: '1' },
      { name: 'requires_second_approval', type: 'BOOLEAN', default: 'false' },
      { name: 'second_approver_role', type: 'VARCHAR(100)', nullable: true },
      { name: 'is_active', type: 'BOOLEAN', default: 'true' },
      { name: 'created_by', type: 'UUID', fk: 'users.id' },
      { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    ],
    indexes: ['module', 'threshold_amount', 'sequence'],
    ddl: `CREATE TABLE approval_workflows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module        VARCHAR(50) NOT NULL,
  threshold_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
  approver_role VARCHAR(100) NOT NULL,
  sequence      INT NOT NULL DEFAULT 1,
  requires_second_approval BOOLEAN DEFAULT false,
  second_approver_role VARCHAR(100),
  is_active     BOOLEAN DEFAULT true,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_threshold CHECK (threshold_amount >= 0),
  CONSTRAINT chk_sequence  CHECK (sequence > 0)
);
CREATE INDEX idx_approval_workflows_module ON approval_workflows(module);
CREATE INDEX idx_approval_workflows_active ON approval_workflows(is_active, sequence);`,
  },

  approval_requests: {
    columns: [
      { name: 'id', type: 'UUID', pk: true },
      { name: 'module', type: 'VARCHAR(50)', nullable: false },
      { name: 'record_id', type: 'VARCHAR(100)', nullable: false },
      { name: 'requested_by', type: 'UUID', fk: 'users.id' },
      { name: 'status', type: "ENUM('Draft','Submitted','Under Review','Approved','Rejected','Correction Requested','Posted')", default: "'Draft'" },
      { name: 'amount', type: 'DECIMAL(15,4)', nullable: false },
      { name: 'currency', type: 'CHAR(3)', default: "'AED'" },
      { name: 'assigned_to_role', type: 'VARCHAR(100)', nullable: true },
      { name: 'workflow_id', type: 'UUID', fk: 'approval_workflows.id' },
      { name: 'gl_posted', type: 'BOOLEAN', default: 'false' },
      { name: 'gl_entry_ref', type: 'VARCHAR(50)', nullable: true },
      { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMP', nullable: true },
    ],
    ddl: `CREATE TABLE approval_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module          VARCHAR(50) NOT NULL,
  record_id       VARCHAR(100) NOT NULL,
  requested_by    UUID REFERENCES users(id),
  status          VARCHAR(50) NOT NULL DEFAULT 'Draft',
  amount          DECIMAL(15,4) NOT NULL,
  currency        CHAR(3) DEFAULT 'AED',
  assigned_to_role VARCHAR(100),
  workflow_id     UUID REFERENCES approval_workflows(id),
  gl_posted       BOOLEAN DEFAULT false,
  gl_entry_ref    VARCHAR(50),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP,
  CONSTRAINT chk_status CHECK (status IN ('Draft','Submitted','Under Review','Approved','Rejected','Correction Requested','Posted')),
  CONSTRAINT uq_record UNIQUE (module, record_id)
);
CREATE INDEX idx_approval_requests_status  ON approval_requests(status);
CREATE INDEX idx_approval_requests_module  ON approval_requests(module, record_id);
CREATE INDEX idx_approval_requests_created ON approval_requests(created_at DESC);`,
  },

  approval_actions: {
    columns: [
      { name: 'id', type: 'UUID', pk: true },
      { name: 'request_id', type: 'UUID', fk: 'approval_requests.id' },
      { name: 'user_id', type: 'UUID', fk: 'users.id' },
      { name: 'action', type: 'VARCHAR(100)', nullable: false },
      { name: 'from_status', type: 'VARCHAR(50)', nullable: true },
      { name: 'to_status', type: 'VARCHAR(50)', nullable: false },
      { name: 'comments', type: 'TEXT', nullable: true },
      { name: 'ip_address', type: 'VARCHAR(45)', nullable: true },
      { name: 'timestamp', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    ],
    ddl: `CREATE TABLE approval_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  from_status VARCHAR(50),
  to_status   VARCHAR(50) NOT NULL,
  comments    TEXT,
  ip_address  VARCHAR(45),
  timestamp   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_approval_actions_request   ON approval_actions(request_id);
CREATE INDEX idx_approval_actions_timestamp ON approval_actions(timestamp DESC);`,
  },
};
