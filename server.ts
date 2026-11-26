import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type {
  AgentLogEntry,
  ApprovalRecord,
  CompletionReport,
  Subtask,
  TaskRun,
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add it in Settings > Secrets to enable autonomous planning.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isNonRetryable =
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('NOT_FOUND') ||
        msg.includes('400') ||
        msg.includes('403') ||
        msg.includes('404');
      if (isNonRetryable || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastErr;
}

const taskStore = new Map<string, TaskRun>();
const activeRunners = new Set<string>();

function nowTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function appendLog(
  task: TaskRun,
  level: AgentLogEntry['level'],
  message: string
): void {
  task.logs.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: nowTime(),
    level,
    message,
  });
  task.updatedAt = new Date().toISOString();
}

async function generatePlanWithGemini(instruction: string): Promise<Subtask[]> {
  const ai = getAiClient();

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Decompose the following user task instruction into a realistic, ordered sequence of 4 to 5 executable subtasks for an autonomous enterprise task manager.

Instruction: "${instruction}"

Rules:
- Order steps logically so later steps depend on earlier steps where appropriate.
- Assign each step a concise tool name from: "Calendar Tool", "Planner Tool", "Docs Tool", "Gmail Tool", "Sheets Tool", "Search Tool", "Booking Tool", "Report Tool", "Task Tool".
- Mark any step that sends an external email/message, confirms an irreversible booking/payment, or modifies external records as sensitive: true, and provide a clear sensitiveReason.
- Provide a concrete 1-sentence actionPreview describing what the tool will actually produce or do.
- Set dependsOn to the array of 0-based step indices that must complete before this step runs (usually [i - 1] for sequential steps, [] for step 0).`,
      config: {
        systemInstruction:
          'You are an autonomous task planning engine. Output strictly structured JSON matching the schema. Be concise, practical, and accurate.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: 'Concise action-oriented subtask title (max 65 chars).',
              },
              tool: {
                type: Type.STRING,
                description: 'Assigned execution tool name.',
              },
              priority: {
                type: Type.STRING,
                description: 'HIGH, MEDIUM, or LOW',
              },
              sensitive: {
                type: Type.BOOLEAN,
                description:
                  'True if external communication, irreversible booking, deletion, or commitment.',
              },
              sensitiveReason: {
                type: Type.STRING,
                description:
                  'Brief explanation of why human approval is required if sensitive is true, otherwise empty string.',
              },
              actionPreview: {
                type: Type.STRING,
                description:
                  'Concrete preview of the payload, draft, or action this step executes.',
              },
              dependsOn: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: '0-based indices of prerequisite subtasks.',
              },
            },
            required: [
              'name',
              'tool',
              'priority',
              'sensitive',
              'actionPreview',
              'dependsOn',
            ],
          },
        },
      },
    })
  );

  const rawText = (response.text ?? '[]').trim();
  const parsed = JSON.parse(rawText) as Array<{
    name: string;
    tool: string;
    priority: string;
    sensitive: boolean;
    sensitiveReason?: string;
    actionPreview: string;
    dependsOn: number[];
  }>;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Planner returned an empty execution plan.');
  }

  return parsed.slice(0, 6).map((item, idx) => {
    const normalizedPriority =
      item.priority === 'HIGH' || item.priority === 'MEDIUM' || item.priority === 'LOW'
        ? item.priority
        : 'MEDIUM';

    const validDeps = Array.isArray(item.dependsOn)
      ? item.dependsOn.filter((d) => Number.isInteger(d) && d >= 0 && d < idx)
      : idx > 0
      ? [idx - 1]
      : [];

    return {
      id: idx,
      name: item.name,
      tool: item.tool || 'Planner Tool',
      priority: normalizedPriority,
      sensitive: Boolean(item.sensitive),
      sensitiveReason: item.sensitive
        ? item.sensitiveReason || 'External or irreversible action requires human sign-off.'
        : undefined,
      actionPreview: item.actionPreview,
      dependsOn: validDeps,
      status: 'pending',
    };
  });
}

async function generateReportWithGemini(task: TaskRun): Promise<CompletionReport> {
  const completedCount = task.subtasks.filter(
    (s) => s.status === 'done' || s.status === 'approved'
  ).length;
  const approvedCount = task.subtasks.filter(
    (s) => s.sensitive && s.status === 'done'
  ).length;
  const rejectedCount = task.subtasks.filter((s) => s.status === 'rejected').length;
  const recoveredCount = task.subtasks.filter((s) => s.recovered).length;

  let summary = `Executed ${completedCount} of ${task.subtasks.length} planned subtasks for "${task.instruction}".`;

  try {
    const ai = getAiClient();
    const stepDigest = task.subtasks
      .map(
        (s, i) =>
          `${i + 1}. ${s.name} [${s.tool}] -> ${s.status.toUpperCase()}${
            s.recovered ? ' (recovered after retry)' : ''
          }${s.outputSummary ? ` | Result: ${s.outputSummary}` : ''}`
      )
      .join('\n');

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Write a crisp 2-to-3 sentence executive completion summary for this autonomous task run.

Instruction: "${task.instruction}"
Subtasks:
${stepDigest}

Keep it factual, specific to the subtasks above, and plain text (no markdown headers or bullets).`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    );
    if (response.text?.trim()) {
      summary = response.text.trim();
    }
  } catch {
    // Preserve structured deterministic summary if report narration fails
  }

  return {
    summary,
    completedCount,
    totalCount: task.subtasks.length,
    approvedCount,
    rejectedCount,
    recoveredCount,
    generatedAt: new Date().toISOString(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeFromCurrentStep(taskId: string): Promise<void> {
  if (activeRunners.has(taskId)) return;
  activeRunners.add(taskId);

  try {
    const task = taskStore.get(taskId);
    if (!task) return;

    task.status = 'running';
    task.updatedAt = new Date().toISOString();

    for (let idx = task.currentStepIndex; idx < task.subtasks.length; idx++) {
      const currentTask = taskStore.get(taskId);
      if (!currentTask) return;

      const step = currentTask.subtasks[idx];
      currentTask.currentStepIndex = idx;

      if (step.status === 'done' || step.status === 'rejected') {
        continue;
      }

      // Check prerequisites
      const blockingDeps = step.dependsOn.filter((depIdx) => {
        const dep = currentTask.subtasks[depIdx];
        return dep && dep.status !== 'done' && dep.status !== 'approved' && dep.status !== 'rejected';
      });

      if (blockingDeps.length > 0) {
        step.status = 'blocked';
        appendLog(
          currentTask,
          'warn',
          `BLOCKED: ${step.name} waiting on prerequisite step(s) ${blockingDeps
            .map((d) => d + 1)
            .join(', ')}`
        );
        return;
      }

      // Pause at human approval safety gate if sensitive and not yet approved
      if (step.sensitive && step.status !== 'approved') {
        step.status = 'waiting';
        currentTask.status = 'waiting_approval';
        currentTask.pendingApprovalIndex = idx;
        appendLog(
          currentTask,
          'warn',
          `PAUSED: "${step.name}" [${step.tool}] requires human approval`
        );
        return;
      }

      step.status = 'running';
      step.startedAt = new Date().toISOString();
      appendLog(currentTask, 'info', `Executing: ${step.name} [${step.tool}]`);

      await sleep(750);

      // Demonstrate deterministic failure recovery on the second step (index 1) if non-sensitive
      if (idx === 1 && !step.sensitive && !step.retried) {
        step.retried = true;
        appendLog(
          currentTask,
          'error',
          `FAILED: ${step.name} — transient tool timeout (504). Auto-retrying...`
        );
        await sleep(800);
        step.recovered = true;
        step.status = 'done';
        step.completedAt = new Date().toISOString();
        step.outputSummary = `${step.actionPreview} (recovered on retry attempt 2)`;
        appendLog(currentTask, 'success', `RECOVERED: ${step.name} succeeded on retry`);
      } else {
        step.status = 'done';
        step.completedAt = new Date().toISOString();
        step.outputSummary = step.actionPreview;
        appendLog(currentTask, 'success', `DONE: ${step.name}`);
      }
    }

    const finishedTask = taskStore.get(taskId);
    if (!finishedTask) return;

    finishedTask.currentStepIndex = finishedTask.subtasks.length;
    finishedTask.pendingApprovalIndex = -1;
    appendLog(finishedTask, 'info', 'All permitted steps processed. Generating report...');
    finishedTask.report = await generateReportWithGemini(finishedTask);
    finishedTask.status = 'completed';
    finishedTask.updatedAt = new Date().toISOString();
    appendLog(finishedTask, 'success', 'Completion report ready.');
  } finally {
    activeRunners.delete(taskId);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'autotask-ai', timestamp: new Date().toISOString() });
  });

  // List all tasks
  app.get('/api/tasks', (_req, res) => {
    const list = Array.from(taskStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ tasks: list });
  });

  // List approval queue & history across all tasks
  app.get('/api/approvals', (_req, res) => {
    const approvals: ApprovalRecord[] = [];
    for (const task of taskStore.values()) {
      for (const s of task.subtasks) {
        if (!s.sensitive) continue;
        const decision: ApprovalRecord['decision'] =
          s.status === 'rejected'
            ? 'rejected'
            : s.status === 'approved' || s.status === 'done'
            ? 'approved'
            : 'pending';
        approvals.push({
          taskId: task.id,
          instruction: task.instruction,
          subtaskId: s.id,
          subtaskName: s.name,
          tool: s.tool,
          reason:
            s.sensitiveReason ||
            'External or irreversible action requires human confirmation.',
          actionPreview: s.actionPreview,
          decision,
          decidedAt: s.completedAt,
        });
      }
    }
    res.json({ approvals });
  });

  // POST /api/tasks - Create & plan task using Gemini
  app.post('/api/tasks', async (req, res) => {
    const instruction =
      typeof req.body?.instruction === 'string' ? req.body.instruction.trim() : '';

    if (!instruction) {
      res.status(400).json({ error: 'Please enter a task instruction.' });
      return;
    }

    try {
      const subtasks = await generatePlanWithGemini(instruction);
      const id = `tsk_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const now = new Date().toISOString();

      const taskRun: TaskRun = {
        id,
        instruction,
        status: 'planned',
        subtasks,
        currentStepIndex: 0,
        pendingApprovalIndex: -1,
        logs: [
          {
            id: `${Date.now()}-init`,
            timestamp: nowTime(),
            level: 'info',
            message: `Received: "${instruction}"`,
          },
          {
            id: `${Date.now()}-plan`,
            timestamp: nowTime(),
            level: 'success',
            message: `Planner: ${subtasks.length} subtasks created with dependencies & safety gates`,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      taskStore.set(id, taskRun);
      res.status(201).json(taskRun);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to plan task.';
      const status =
        msg.includes('API_KEY') || msg.includes('PERMISSION_DENIED') ? 403 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // POST /api/tasks/:id/run - Start or resume agent execution
  app.post('/api/tasks/:id/run', (req, res) => {
    const task = taskStore.get(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (task.status === 'waiting_approval') {
      res.status(409).json({
        error: 'Execution is paused awaiting human approval.',
        task,
      });
      return;
    }
    if (task.status === 'completed') {
      res.json(task);
      return;
    }

    task.status = 'running';
    appendLog(task, 'info', 'Execution started by user');
    void executeFromCurrentStep(task.id);
    res.json(task);
  });

  // POST /api/tasks/:id/approve - Approve paused sensitive action and continue
  app.post('/api/tasks/:id/approve', (req, res) => {
    const task = taskStore.get(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    const idx = task.pendingApprovalIndex;
    if (task.status !== 'waiting_approval' || idx < 0 || !task.subtasks[idx]) {
      res.status(400).json({ error: 'No subtask is currently awaiting approval.' });
      return;
    }

    const step = task.subtasks[idx];
    step.status = 'approved';
    task.pendingApprovalIndex = -1;
    appendLog(task, 'success', `HUMAN APPROVED: ${step.name} [${step.tool}]`);

    task.status = 'running';
    void executeFromCurrentStep(task.id);
    res.json(task);
  });

  // POST /api/tasks/:id/reject - Reject paused sensitive action, skip safely, and continue
  app.post('/api/tasks/:id/reject', (req, res) => {
    const task = taskStore.get(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    const idx = task.pendingApprovalIndex;
    if (task.status !== 'waiting_approval' || idx < 0 || !task.subtasks[idx]) {
      res.status(400).json({ error: 'No subtask is currently awaiting approval.' });
      return;
    }

    const step = task.subtasks[idx];
    step.status = 'rejected';
    step.completedAt = new Date().toISOString();
    step.outputSummary = 'Skipped safely after human rejection at safety gate.';
    task.pendingApprovalIndex = -1;
    task.currentStepIndex = idx + 1;
    appendLog(
      task,
      'warn',
      `HUMAN REJECTED: ${step.name} — skipped safely, continuing remaining steps`
    );

    task.status = 'running';
    void executeFromCurrentStep(task.id);
    res.json(task);
  });

  // GET /api/tasks/:id - Fetch current state & report
  app.get('/api/tasks/:id', (req, res) => {
    const task = taskStore.get(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    res.json(task);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AutoTask AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
