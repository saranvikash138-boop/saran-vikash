import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Play, Search } from 'lucide-react';
import type { TaskRun } from '../types';

interface WorkflowsViewProps {
  tasks: TaskRun[];
  onOpenTask: (task: TaskRun) => void;
  onRunTemplate: (instruction: string) => void;
}

const TEMPLATES = [
  {
    title: 'Project Sync Preparation',
    instruction: 'Prepare project meeting for Friday',
    tools: 'Calendar · Planner · Docs · Gmail · Report',
    gate: 'External team invite email',
  },
  {
    title: 'Intern Onboarding Pipeline',
    instruction: 'Onboard new intern and send welcome email',
    tools: 'Planner · Docs · Gmail · Sheets',
    gate: 'Welcome email dispatch',
  },
  {
    title: 'Executive Weekly Digest',
    instruction: 'Prepare weekly progress report and email to manager',
    tools: 'Task · Planner · Docs · Gmail',
    gate: 'Manager report email',
  },
  {
    title: 'Team Offsite Reservation',
    instruction: 'Book team lunch and confirm booking',
    tools: 'Calendar · Search · Booking · Gmail',
    gate: 'Irreversible restaurant booking',
  },
];

export const WorkflowsView: React.FC<WorkflowsViewProps> = ({
  tasks,
  onOpenTask,
  onRunTemplate,
}) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesQuery = t.instruction
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ? true : t.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [tasks, query, statusFilter]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Workflows & Run History
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Inspect past autonomous task runs or launch a reusable workflow template.
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter runs by instruction..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {[
              { id: 'all', label: 'All' },
              { id: 'completed', label: 'Completed' },
              { id: 'waiting_approval', label: 'Waiting' },
              { id: 'running', label: 'Running' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-900">No workflow runs recorded yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Run a task from the Dashboard or launch one of the templates below.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50">
                  <th className="py-3 px-6">Instruction</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4 text-right">Subtasks</th>
                  <th className="py-3 px-4 text-right">Created</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredTasks.map((t) => {
                  const doneCount = t.subtasks.filter(
                    (s) => s.status === 'done' || s.status === 'approved'
                  ).length;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-6 font-medium text-slate-900 max-w-md truncate">
                        {t.instruction}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700 capitalize whitespace-nowrap">
                        {t.status.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                        {doneCount}/{t.subtasks.length}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenTask(t)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
                        >
                          Open
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Workflow Templates</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {TEMPLATES.map((tpl) => (
            <div
              key={tpl.title}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <h3 className="text-base font-semibold text-slate-900">{tpl.title}</h3>
                <p className="text-sm text-slate-600 mt-1">{tpl.instruction}</p>
                <p className="text-xs text-slate-500 mt-3">
                  {tpl.tools} · Gate: {tpl.gate}
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => onRunTemplate(tpl.instruction)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  Run Workflow
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
