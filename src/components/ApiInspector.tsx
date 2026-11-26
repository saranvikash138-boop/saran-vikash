import React, { useState } from 'react';
import { RefreshCw, Terminal } from 'lucide-react';
import type { ApiExchange, TaskRun } from '../types';

interface ApiInspectorProps {
  task: TaskRun | null;
  lastExchange: ApiExchange | null;
  onInspectTask: (taskId: string) => Promise<void>;
}

const ENDPOINTS: Array<{ method: 'POST' | 'GET'; path: string; desc: string }> = [
  { method: 'POST', path: '/api/tasks', desc: 'Create task & generate plan' },
  { method: 'POST', path: '/api/tasks/:id/run', desc: 'Execute permitted subtasks' },
  { method: 'POST', path: '/api/tasks/:id/approve', desc: 'Approve paused safety gate' },
  { method: 'GET', path: '/api/tasks/:id', desc: 'Fetch preserved state & report' },
];

export const ApiInspector: React.FC<ApiInspectorProps> = ({
  task,
  lastExchange,
  onInspectTask,
}) => {
  const [inspecting, setInspecting] = useState(false);

  const handleRefresh = async () => {
    if (!task) return;
    setInspecting(true);
    try {
      await onInspectTask(task.id);
    } finally {
      setInspecting(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-600 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-900">REST API State</h3>
        </div>
        {task && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={inspecting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${inspecting ? 'animate-spin' : ''}`} />
            Fetch GET
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {ENDPOINTS.map((ep) => (
          <div
            key={ep.path}
            className="px-5 py-2.5 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-mono font-semibold text-indigo-700 shrink-0 w-10">
                {ep.method}
              </span>
              <span className="font-mono text-slate-800 truncate">{ep.path}</span>
            </div>
            <span className="text-slate-500 whitespace-nowrap shrink-0 hidden sm:inline">
              {ep.desc}
            </span>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 bg-slate-900 text-slate-200 border-t border-slate-200">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
          <span>
            {lastExchange
              ? `${lastExchange.method} ${lastExchange.path} · HTTP ${lastExchange.statusCode}`
              : 'No API request sent yet'}
          </span>
          {lastExchange && <span className="tabular-nums">{lastExchange.timestamp}</span>}
        </div>
        <pre className="font-mono text-[11px] leading-relaxed text-slate-300 overflow-x-auto max-h-40">
          {lastExchange
            ? JSON.stringify(lastExchange.payload, null, 2)
            : '{\n  "status": "idle",\n  "note": "Run a task to inspect live JSON responses"\n}'}
        </pre>
      </div>
    </section>
  );
};
