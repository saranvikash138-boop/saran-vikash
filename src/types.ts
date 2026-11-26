export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

export type SubtaskStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'approved'
  | 'rejected'
  | 'blocked'
  | 'done';

export type TaskRunStatus =
  | 'idle'
  | 'planning'
  | 'planned'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed';

export interface Subtask {
  id: number;
  name: string;
  tool: string;
  priority: Priority;
  sensitive: boolean;
  sensitiveReason?: string;
  actionPreview: string;
  dependsOn: number[];
  status: SubtaskStatus;
  retried?: boolean;
  recovered?: boolean;
  outputSummary?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface ApprovalRecord {
  taskId: string;
  instruction: string;
  subtaskId: number;
  subtaskName: string;
  tool: string;
  reason: string;
  actionPreview: string;
  decision: 'pending' | 'approved' | 'rejected';
  decidedAt?: string;
}

export interface CompletionReport {
  summary: string;
  completedCount: number;
  totalCount: number;
  approvedCount: number;
  rejectedCount: number;
  recoveredCount: number;
  generatedAt: string;
}

export interface TaskRun {
  id: string;
  instruction: string;
  status: TaskRunStatus;
  subtasks: Subtask[];
  currentStepIndex: number;
  pendingApprovalIndex: number;
  logs: AgentLogEntry[];
  report?: CompletionReport;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiExchange {
  method: 'GET' | 'POST';
  path: string;
  statusCode: number;
  timestamp: string;
  payload: unknown;
}
