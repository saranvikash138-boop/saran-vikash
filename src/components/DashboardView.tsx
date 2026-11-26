import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Download,
  GitBranch,
  Layers,
  Loader2,
  PauseCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { ApiExchange, SubtaskStatus, TaskRun } from '../types';
import { ApiInspector } from './ApiInspector';

interface DashboardViewProps {
  instruction: string;
  onInstructionChange: (val: string) => void;
  onRunAgent: (overrideInstruction?: string) => Promise<void>;
  onApprove: (taskId: string) => Promise<void>;
  onReject: (taskId: string) => Promise<void>;
  onDownloadReport: (task: TaskRun) => void;
  onInspectTask: (taskId: string) => Promise<void>;
  task: TaskRun | null;
  isPlanning: boolean;
  isMutating: boolean;
  error: string | null;
  onDismissError: () => void;
  lastExchange: ApiExchange | null;
}

const PRESETS: Array<{ label: string; prompt: string }> = [
  { label: 'Project Meeting', prompt: 'Prepare project meeting for Friday' },
  {
    label: 'Onboard Intern',
    prompt: 'Onboard new intern and send welcome email',
  },
  {
    label: 'Weekly Report',
    prompt: 'Prepare weekly progress report and email to manager',
  },
  { label: 'Book Lunch', prompt: 'Book team lunch and confirm booking' },
];

function statusLabel(task: TaskRun | null, isPlanning: boolean): {
  text: string;
  tone: string;
  Icon: React.FC<{ className?: string }>;
} {
  if (isPlanning) {
    return { text: 'Planning', tone: 'text-indigo-700', Icon: Loader2 };
  }
  if (!task) {
    return { text: 'Idle', tone: 'text-slate-500', Icon: Circle };
  }
  switch (task.status) {
    case 'running':
      return { text: 'Running', tone: 'text-indigo-700', Icon: Loader2 };
    case 'waiting_approval':
      return {
        text: 'Waiting Approval',
        tone: 'text-red-700',
        Icon: PauseCircle,
      };
    case 'completed':
      return {
        text: 'Completed',
        tone: 'text-emerald-700',
        Icon: CheckCircle2,
      };
    case 'failed':
      return { text: 'Failed', tone: 'text-red-700', Icon: XCircle };
    default:
      return { text: 'Planned', tone: 'text-slate-700', Icon: Circle };
  }
}

function subtaskStatusDisplay(status: SubtaskStatus): {
  label: string;
  className: string;
  Icon: React.FC<{ className?: string }>;
} {
  switch (status) {
    case 'done':
    case 'approved':
      return {
        label: 'Completed',
        className: 'text-emerald-700',
        Icon: CheckCircle2,
      };
    case 'running':
      return {
        label: 'Running',
        className: 'text-indigo-700',
        Icon: Loader2,
      };
    case 'waiting':
      return {
        label: 'Needs Approval',
        className: 'text-red-700',
        Icon: PauseCircle,
      };
    case 'rejected':
      return {
        label: 'Skipped',
        className: 'text-slate-500',
        Icon: XCircle,
      };
    case 'blocked':
      return {
        label: 'Blocked',
        className: 'text-amber-700',
        Icon: AlertTriangle,
      };
    default:
      return {
        label: 'Pending',
        className: 'text-slate-500',
        Icon: Circle,
      };
  }
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  instruction,
  onInstructionChange,
  onRunAgent,
  onApprove,
  onReject,
  onDownloadReport,
  onInspectTask,
  task,
  isPlanning,
  isMutating,
  error,
  onDismissError,
  lastExchange,
}) => {
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [task?.logs.length]);

  const totalCount = task?.subtasks.length ?? 0;
  const doneCount =
    task?.subtasks.filter(
      (s) => s.status === 'done' || s.status === 'approved'
    ).length ?? 0;
  const waitCount =
    task?.subtasks.filter((s) => s.status === 'waiting').length ?? 0;
  const progressPct =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const badge = statusLabel(task, isPlanning);
  const BadgeIcon = badge.Icon;

  const pendingStep =
    task && task.status === 'waiting_approval' && task.pendingApprovalIndex >= 0
      ? task.subtasks[task.pendingApprovalIndex]
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onRunAgent();
  };

  return (
    <div className="space-y-8">
      {/* Editorial Hero + Command Bar */}
      <section className="max-w-3xl space-y-5">
        <div className="space-y-2">
          <h1
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900"
            style={{ textWrap: 'balance' }}
          >
            Tell it in words. Review before it acts.
          </h1>
          <p className="text-base text-slate-600 max-w-2xl leading-relaxed">
            Describe a goal. The planner breaks it into ordered subtasks, maps tool
            dependencies, pauses for human sign-off on sensitive steps, and
            recovers from transient failures.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <label htmlFor="task-instruction" className="sr-only">
              Task instruction
            </label>
            <input
              id="task-instruction"
              type="text"
              value={instruction}
              onChange={(e) => onInstructionChange(e.target.value)}
              placeholder="e.g. Prepare project meeting for Friday"
              className="flex-1 min-w-0 px-4 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600"
            />
            <button
              type="submit"
              disabled={isPlanning || isMutating}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              {isPlanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isPlanning ? 'Planning...' : 'Run Agent'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-slate-500 mr-1">Examples:</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onInstructionChange(preset.prompt)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </form>

        {error && (
          <div
            role="alert"
            className="flex items-start justify-between gap-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={onDismissError}
              className="text-xs font-semibold text-red-700 hover:text-red-900 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
      </section>

      {/* 4-Column Tabular KPI Strip */}
      <section
        aria-label="Execution metrics"
        className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200"
      >
        <div className="px-6 py-4">
          <p className="text-xs font-medium text-slate-500">Subtasks</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {totalCount}
          </p>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs font-medium text-slate-500">Completed</p>
          <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {doneCount}
          </p>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs font-medium text-slate-500">Waiting Approval</p>
          <p className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
            {waitCount}
          </p>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs font-medium text-slate-500">Progress</p>
          <p className="text-2xl font-bold text-indigo-700 font-mono tabular-nums mt-1">
            {progressPct}%
          </p>
        </div>
      </section>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Plan & Execution */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900">
              Agent Plan & Execution
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${badge.tone}`}
            >
              <BadgeIcon
                className={`w-4 h-4 ${
                  isPlanning || task?.status === 'running' ? 'animate-spin' : ''
                }`}
              />
              {badge.text}
            </span>
          </div>

          {isPlanning ? (
            <div className="divide-y divide-slate-100">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="px-6 py-4 flex items-center justify-between gap-4 animate-pulse">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                  <div className="h-4 bg-slate-100 rounded w-20" />
                </div>
              ))}
            </div>
          ) : !task ? (
            <div className="px-6 py-14 text-center space-y-3">
              <p className="text-sm font-medium text-slate-900">
                No execution plan active
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Enter an instruction above or launch the default sample workflow to
                see structured subtask planning and safety controls in action.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => void onRunAgent('Prepare project meeting for Friday')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  Run Sample Workflow
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="divide-y divide-slate-100">
                {task.subtasks.map((step, idx) => {
                  const st = subtaskStatusDisplay(step.status);
                  const StatusIcon = st.Icon;
                  const depsLabel =
                    step.dependsOn.length > 0
                      ? `Depends on Step ${step.dependsOn.map((d) => d + 1).join(', ')}`
                      : 'Root step';

                  return (
                    <div
                      key={step.id}
                      className={`px-6 py-4 flex items-start justify-between gap-4 transition-colors ${
                        step.status === 'running'
                          ? 'bg-indigo-50/40'
                          : step.status === 'waiting'
                          ? 'bg-red-50/40'
                          : ''
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <span className="font-mono text-xs font-semibold text-slate-400 tabular-nums pt-0.5 shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 leading-snug">
                            {step.name}
                          </p>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {step.outputSummary || step.actionPreview}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 pt-0.5">
                            <span>{step.tool}</span>
                            <span aria-hidden="true">·</span>
                            <span>Priority: {step.priority}</span>
                            <span aria-hidden="true">·</span>
                            <span>{depsLabel}</span>
                            {step.sensitive && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-red-700 font-medium">
                                  Human approval required
                                </span>
                              </>
                            )}
                            {step.recovered && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-700 font-medium">
                                  Auto-recovered on retry
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 pt-0.5 ${st.className}`}
                      >
                        <StatusIcon
                          className={`w-4 h-4 ${
                            step.status === 'running' ? 'animate-spin' : ''
                          }`}
                        />
                        <span>{st.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Human Approval Gate */}
              {pendingStep && (
                <div className="px-6 py-5 bg-red-50 border-t border-red-200 space-y-3">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <h3 className="text-sm font-bold">Human Approval Required</h3>
                  </div>
                  <p className="text-sm text-slate-800">
                    Paused before executing{' '}
                    <span className="font-semibold">"{pendingStep.name}"</span> via{' '}
                    <span className="font-medium">{pendingStep.tool}</span>.
                  </p>
                  <p className="text-xs text-slate-600">
                    Action preview: {pendingStep.actionPreview} · Reason:{' '}
                    {pendingStep.sensitiveReason}
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => void onApprove(task.id)}
                      className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      Approve & Continue
                    </button>
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => void onReject(task.id)}
                      className="px-4 py-2 text-sm font-semibold text-red-700 bg-white border border-red-300 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      Reject & Skip
                    </button>
                  </div>
                </div>
              )}

              {/* Completion Report */}
              {task.status === 'completed' && task.report && (
                <div className="px-6 py-5 bg-emerald-50/70 border-t border-emerald-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <h3 className="text-sm font-bold">Completion Report</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDownloadReport(task)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap self-start"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Report
                    </button>
                  </div>

                  <p className="text-sm text-slate-800 leading-relaxed">
                    {task.report.summary}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-mono tabular-nums pt-1">
                    <span>
                      Completed: {task.report.completedCount}/{task.report.totalCount}
                    </span>
                    <span>Approved: {task.report.approvedCount}</span>
                    <span>Skipped: {task.report.rejectedCount}</span>
                    <span>Recovered: {task.report.recoveredCount}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right: Logs + API Inspector */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">
                Live Agent Logs
              </h3>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                {task?.logs.length ?? 0} entries
              </span>
            </div>

            <div className="p-4 h-72 overflow-y-auto font-mono text-xs space-y-1.5">
              {!task || task.logs.length === 0 ? (
                <p className="text-slate-400">
                  &gt; Planner idle. Submit an instruction to trace tool execution.
                </p>
              ) : (
                task.logs.map((entry) => {
                  const color =
                    entry.level === 'success'
                      ? 'text-emerald-400'
                      : entry.level === 'warn'
                      ? 'text-amber-300'
                      : entry.level === 'error'
                      ? 'text-rose-400'
                      : 'text-slate-300';
                  return (
                    <div key={entry.id} className="leading-relaxed">
                      <span className="text-slate-500 tabular-nums mr-2">
                        [{entry.timestamp}]
                      </span>
                      <span className={color}>{entry.message}</span>
                    </div>
                  );
                })
              )}
              <div ref={logEndRef} />
            </div>
          </section>

          <ApiInspector
            task={task}
            lastExchange={lastExchange}
            onInspectTask={onInspectTask}
          />
        </div>
      </div>

      {/* Architecture Capabilities */}
      <section
        aria-label="Core capabilities"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <Layers className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900 pt-1">Planning</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Converts plain-language goals into structured, tool-assigned subtasks.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <GitBranch className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900 pt-1">Dependencies</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Orders execution steps and verifies prerequisites before running.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900 pt-1">
            Safety Control
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Pauses automatically on external emails, bookings, or irreversible writes.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <RotateCcw className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900 pt-1">
            Failure Recovery
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Retries transient tool timeouts automatically and logs full audit traces.
          </p>
        </div>
      </section>
    </div>
  );
};
