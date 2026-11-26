import { useCallback, useEffect, useState } from 'react';
import { Header, type NavTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { WorkflowsView } from './components/WorkflowsView';
import { ApprovalsView } from './components/ApprovalsView';
import { ReportsView } from './components/ReportsView';
import type { ApiExchange, ApprovalRecord, TaskRun } from './types';

function formatTimestamp(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [instruction, setInstruction] = useState(
    'Prepare project meeting for Friday'
  );
  const [activeTask, setActiveTask] = useState<TaskRun | null>(null);
  const [allTasks, setAllTasks] = useState<TaskRun[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastExchange, setLastExchange] = useState<ApiExchange | null>(null);

  const refreshCollections = useCallback(async () => {
    try {
      const [tasksRes, approvalsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/approvals'),
      ]);
      if (tasksRes.ok) {
        const data = (await tasksRes.json()) as { tasks: TaskRun[] };
        setAllTasks(data.tasks);
      }
      if (approvalsRes.ok) {
        const data = (await approvalsRes.json()) as {
          approvals: ApprovalRecord[];
        };
        setApprovals(data.approvals);
      }
    } catch {
      // Ignore background refresh errors while server is restarting
    }
  }, []);

  useEffect(() => {
    void refreshCollections();
  }, [refreshCollections]);

  const recordExchange = (
    method: 'GET' | 'POST',
    path: string,
    statusCode: number,
    payload: unknown
  ) => {
    setLastExchange({
      method,
      path,
      statusCode,
      timestamp: formatTimestamp(),
      payload,
    });
  };

  // Poll active running task from GET /api/tasks/:id
  useEffect(() => {
    if (!activeTask || activeTask.status !== 'running') return;

    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks/${activeTask.id}`);
        if (!res.ok) return;
        const updated = (await res.json()) as TaskRun;
        setActiveTask(updated);
        recordExchange('GET', `/api/tasks/${updated.id}`, res.status, {
          id: updated.id,
          status: updated.status,
          currentStepIndex: updated.currentStepIndex,
          subtasksCompleted: updated.subtasks.filter((s) => s.status === 'done')
            .length,
        });
        if (updated.status !== 'running') {
          void refreshCollections();
        }
      } catch {
        // Retry next tick
      }
    }, 300);

    return () => window.clearInterval(timer);
  }, [activeTask?.id, activeTask?.status, refreshCollections]);

  const handleRunAgent = async (overrideInstruction?: string) => {
    const targetText = (overrideInstruction ?? instruction).trim();
    if (!targetText) {
      setError('Enter a task instruction before running the agent.');
      return;
    }
    if (overrideInstruction) {
      setInstruction(overrideInstruction);
    }

    setError(null);
    setIsPlanning(true);
    setActiveTab('dashboard');

    try {
      const createRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: targetText }),
      });
      const createdBody = await createRes.json();
      recordExchange('POST', '/api/tasks', createRes.status, createdBody);

      if (!createRes.ok) {
        throw new Error(createdBody.error || 'Failed to create task plan.');
      }

      const createdTask = createdBody as TaskRun;
      setActiveTask(createdTask);
      setIsPlanning(false);

      const runRes = await fetch(`/api/tasks/${createdTask.id}/run`, {
        method: 'POST',
      });
      const runBody = await runRes.json();
      recordExchange(
        'POST',
        `/api/tasks/${createdTask.id}/run`,
        runRes.status,
        runBody
      );

      if (!runRes.ok) {
        throw new Error(runBody.error || 'Failed to start execution.');
      }

      setActiveTask(runBody as TaskRun);
      void refreshCollections();
    } catch (err: unknown) {
      setIsPlanning(false);
      setError(err instanceof Error ? err.message : 'Unexpected agent error.');
    }
  };

  const handleApprove = async (taskId: string) => {
    setError(null);
    setIsMutating(true);
    setBusyTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/approve`, {
        method: 'POST',
      });
      const body = await res.json();
      recordExchange('POST', `/api/tasks/${taskId}/approve`, res.status, body);

      if (!res.ok) {
        throw new Error(body.error || 'Failed to approve action.');
      }
      if (activeTask?.id === taskId || !activeTask) {
        setActiveTask(body as TaskRun);
      }
      await refreshCollections();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Approval failed.');
    } finally {
      setIsMutating(false);
      setBusyTaskId(null);
    }
  };

  const handleReject = async (taskId: string) => {
    setError(null);
    setIsMutating(true);
    setBusyTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/reject`, {
        method: 'POST',
      });
      const body = await res.json();
      recordExchange('POST', `/api/tasks/${taskId}/reject`, res.status, body);

      if (!res.ok) {
        throw new Error(body.error || 'Failed to reject action.');
      }
      if (activeTask?.id === taskId || !activeTask) {
        setActiveTask(body as TaskRun);
      }
      await refreshCollections();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Rejection failed.');
    } finally {
      setIsMutating(false);
      setBusyTaskId(null);
    }
  };

  const handleInspectTask = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`);
    const body = await res.json();
    recordExchange('GET', `/api/tasks/${taskId}`, res.status, body);
    if (res.ok) {
      setActiveTask(body as TaskRun);
    }
  };

  const handleDownloadReport = (task: TaskRun) => {
    const lines = [
      'AUTOTASK AI - COMPLETION REPORT',
      `Run ID: ${task.id}`,
      `Instruction: ${task.instruction}`,
      `Generated: ${task.report?.generatedAt ?? new Date().toISOString()}`,
      '',
      'Summary:',
      task.report?.summary ?? 'No summary available.',
      '',
      'Subtasks:',
      ...task.subtasks.map(
        (s, idx) =>
          `${idx + 1}. ${s.name} [${s.tool}] - ${s.status.toUpperCase()}${
            s.recovered ? ' (recovered on retry)' : ''
          }`
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AutoTask-Report-${task.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleNewTask = () => {
    setActiveTask(null);
    setInstruction('');
    setError(null);
    setActiveTab('dashboard');
  };

  const handleOpenTask = (task: TaskRun) => {
    setActiveTask(task);
    setInstruction(task.instruction);
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          void refreshCollections();
        }}
        onNewTask={handleNewTask}
      />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            instruction={instruction}
            onInstructionChange={setInstruction}
            onRunAgent={handleRunAgent}
            onApprove={handleApprove}
            onReject={handleReject}
            onDownloadReport={handleDownloadReport}
            onInspectTask={handleInspectTask}
            task={activeTask}
            isPlanning={isPlanning}
            isMutating={isMutating}
            error={error}
            onDismissError={() => setError(null)}
            lastExchange={lastExchange}
          />
        )}

        {activeTab === 'workflows' && (
          <WorkflowsView
            tasks={allTasks}
            onOpenTask={handleOpenTask}
            onRunTemplate={(prompt) => void handleRunAgent(prompt)}
          />
        )}

        {activeTab === 'approvals' && (
          <ApprovalsView
            approvals={approvals}
            onApprove={handleApprove}
            onReject={handleReject}
            busyTaskId={busyTaskId}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            tasks={allTasks}
            onDownloadReport={handleDownloadReport}
            onOpenTask={handleOpenTask}
          />
        )}
      </main>
    </div>
  );
}
