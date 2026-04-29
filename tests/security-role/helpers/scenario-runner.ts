/**
 * Scenario runner for Dynamics 365 security-role validation.
 *
 * Steps are defined as plain objects with a `run` function.
 * The runner executes them in order, captures results, and produces a
 * human-readable report.  Tests never abort early — every step is attempted
 * (unless a declared dependency failed).
 *
 * Verdict logic:
 *   expected "success"          + step passed           → ✅ correct
 *   expected "success"          + privilege denied      → ⛔ unexpected
 *   expected "success"          + other error           → 💥 unexpected
 *   expected "privilege-denied" + privilege denied      → 🔒 correct
 *   expected "privilege-denied" + step passed           → ❌ unexpected (hole in role!)
 *   skipped (dependency failed)                         → ⏭️  unexpected
 */

import type { Page, TestInfo } from '@playwright/test';
import { isPrivilegeError } from './d365';

// ─── Public error class ───────────────────────────────────────────────────────

/**
 * Throw this from a step's `run` function to signal that the operation was
 * correctly blocked by a privilege check.  The runner will record the step
 * as "privilege-denied".
 */
export class PrivilegeError extends Error {
  constructor(message?: string) {
    super(message ?? 'Insufficient privileges');
    this.name = 'PrivilegeError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpectedOutcome = 'success' | 'privilege-denied';
export type ActualStatus = 'passed' | 'privilege-denied' | 'error' | 'skipped';

/**
 * Shared mutable bag that flows through all steps in a scenario.
 * Steps read IDs created by earlier steps from here and write new ones into it.
 */
export interface ScenarioState extends Record<string, unknown> {
  page: Page;
}

export interface StepDef {
  /** Human-readable label used in the report and in `requires` references. */
  name: string;
  /** Optional longer explanation shown in verbose mode. */
  description?: string;
  /**
   * What the step should produce when the role is configured correctly.
   * - `"success"` → operation must succeed (privilege is granted)
   * - `"privilege-denied"` → operation must be blocked (privilege is absent)
   */
  expectedOutcome: ExpectedOutcome;
  /**
   * Names of other steps that must complete correctly before this step runs.
   * Use when this step depends on state (e.g. an ID) set by an earlier step.
   */
  requires?: string[];
  /**
   * The action to perform.
   * - Return normally to signal the operation succeeded.
   * - Throw `PrivilegeError` to signal the operation was correctly denied.
   * - Throw any other `Error` to signal an unexpected failure.
   */
  run: (state: ScenarioState) => Promise<void>;
}

export interface StepResult {
  index: number;
  name: string;
  status: ActualStatus;
  expected: ExpectedOutcome;
  /** true when status matches what the expected outcome demands */
  correct: boolean;
  error?: string;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

export async function runScenario(page: Page, steps: StepDef[]): Promise<StepResult[]> {
  const state: ScenarioState = { page };
  const results: StepResult[] = [];
  const passed = new Set<string>(); // tracks steps that completed correctly

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    const blockedBy = step.requires?.find(dep => !passed.has(dep));
    if (blockedBy) {
      results.push({
        index: i + 1,
        name: step.name,
        status: 'skipped',
        expected: step.expectedOutcome,
        correct: false,
        error: `Requires "${blockedBy}" to pass first`,
      });
      continue;
    }

    try {
      await step.run(state);
      const correct = step.expectedOutcome === 'success';
      if (correct) passed.add(step.name);
      results.push({ index: i + 1, name: step.name, status: 'passed', expected: step.expectedOutcome, correct });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isPriv = err instanceof PrivilegeError || isPrivilegeError(msg);

      if (isPriv) {
        const correct = step.expectedOutcome === 'privilege-denied';
        if (correct) passed.add(step.name);
        results.push({
          index: i + 1, name: step.name, status: 'privilege-denied',
          expected: step.expectedOutcome, correct, error: msg.substring(0, 300),
        });
      } else {
        results.push({
          index: i + 1, name: step.name, status: 'error',
          expected: step.expectedOutcome, correct: false, error: msg.substring(0, 300),
        });
      }
    }
  }

  return results;
}

// ─── Reporting ────────────────────────────────────────────────────────────────

const W = 76;
const LINE = '═'.repeat(W);
const DIV = '─'.repeat(W);

function icon(r: StepResult): string {
  if (r.status === 'passed' && r.correct) return '✅';
  if (r.status === 'privilege-denied' && r.correct) return '🔒';
  if (r.status === 'privilege-denied' && !r.correct) return '⛔';
  if (r.status === 'passed' && !r.correct) return '❌';
  if (r.status === 'error') return '💥';
  return '⏭️ ';
}

export function formatReport(results: StepResult[]): string {
  const rows = results.map(r => {
    const unexpected = !r.correct ? '  ← UNEXPECTED' : '';
    const errLine =
      !r.correct && r.error
        ? `\n      ↳ ${r.error.split('\n')[0].substring(0, 110)}`
        : '';
    return `  ${icon(r)}  [${String(r.index).padStart(2)}] ${r.name}${unexpected}${errLine}`;
  });

  const ok = results.filter(r => r.correct).length;
  const bad = results.filter(r => !r.correct).length;
  const summary =
    `  ${ok} / ${results.length} steps as expected` +
    (bad > 0 ? `  |  ⚠️  ${bad} UNEXPECTED` : '  |  All correct ✓');

  return [LINE, `  BSH CC Agent – Scenario Step Report`, DIV, ...rows, DIV, summary, LINE].join('\n');
}

export async function attachReport(testInfo: TestInfo, results: StepResult[]): Promise<void> {
  const text = formatReport(results);
  console.log('\n' + text + '\n');
  await testInfo.attach('Scenario Step Report', {
    body: Buffer.from(text),
    contentType: 'text/plain',
  });
}
