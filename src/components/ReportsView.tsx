import React from 'react';
import { Download, FileText } from 'lucide-react';
import type { TaskRun } from '../types';

interface ReportsViewProps {
  tasks: TaskRun[];
  onDownloadReport: (task: TaskRun) => void;
  onOpenTask: (task: TaskRun) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  tasks,
  onDownloadReport,
  onOpenTask,
}) => {
  const completedTasks = tasks.filter((t) => t.status === 'completed' && t.report);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Completion Reports
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Synthesized execution summaries, safety gate outcomes, and downloadable audit logs.
        </p>
      </div>

      {completedTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center">
          <FileText className="w-6 h-6 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-900">No completion reports yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Complete a task run on the Dashboard to generate and export a report.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {completedTasks.map((task) => {
            const report = task.report!;
            return (
              <article
                key={task.id}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {task.instruction}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                      Run {task.id} · Generated{' '}
                      {new Date(report.generatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenTask(task)}
                      className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                    >
                      View Run
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownloadReport(task)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Report
                    </button>
                  </div>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">{report.summary}</p>

                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Completed Steps</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5 block">
                      {report.completedCount}/{report.totalCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Approvals Granted</span>
                    <span className="font-mono font-semibold text-emerald-700 tabular-nums mt-0.5 block">
                      {report.approvedCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Rejected / Skipped</span>
                    <span className="font-mono font-semibold text-red-700 tabular-nums mt-0.5 block">
                      {report.rejectedCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Auto-Recovered</span>
                    <span className="font-mono font-semibold text-amber-700 tabular-nums mt-0.5 block">
                      {report.recoveredCount}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
