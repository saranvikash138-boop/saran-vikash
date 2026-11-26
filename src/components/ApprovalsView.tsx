import React from 'react';
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import type { ApprovalRecord } from '../types';

interface ApprovalsViewProps {
  approvals: ApprovalRecord[];
  onApprove: (taskId: string) => Promise<void>;
  onReject: (taskId: string) => Promise<void>;
  busyTaskId: string | null;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  approvals,
  onApprove,
  onReject,
  busyTaskId,
}) => {
  const pending = approvals.filter((a) => a.decision === 'pending');
  const resolved = approvals.filter((a) => a.decision !== 'pending');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Human-in-the-Loop Approvals
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Sensitive actions pause automatically until reviewed and explicitly authorized.
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Pending Sign-Off</h2>
          <span className="text-xs font-mono text-slate-600 tabular-nums">
            {pending.length} waiting
          </span>
        </div>

        {pending.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-900">No actions awaiting approval</p>
            <p className="text-xs text-slate-500 mt-1">
              When an agent reaches an external email, booking, or destructive step, it pauses here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {pending.map((item) => (
              <div
                key={`${item.taskId}-${item.subtaskId}`}
                className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 bg-red-50/40"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-red-700 text-xs font-semibold">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Approval Gate Triggered</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {item.subtaskName}
                  </h3>
                  <p className="text-sm text-slate-700">{item.actionPreview}</p>
                  <p className="text-xs text-slate-500">
                    Task: {item.instruction} · Tool: {item.tool} · {item.reason}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    disabled={busyTaskId === item.taskId}
                    onClick={() => onApprove(item.taskId)}
                    className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    Approve & Continue
                  </button>
                  <button
                    type="button"
                    disabled={busyTaskId === item.taskId}
                    onClick={() => onReject(item.taskId)}
                    className="px-4 py-2 text-sm font-semibold text-red-700 bg-white border border-red-300 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    Reject & Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Audit Log</h2>
        </div>

        {resolved.length === 0 ? (
          <div className="px-6 py-10 text-center text-xs text-slate-500">
            Approved and rejected safety gate decisions will appear here.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {resolved.map((item) => (
              <div
                key={`${item.taskId}-${item.subtaskId}-hist`}
                className="px-6 py-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {item.subtaskName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {item.instruction} · {item.tool}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
                  {item.decision === 'approved' ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-red-700">
                      <XCircle className="w-4 h-4" />
                      Rejected
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
