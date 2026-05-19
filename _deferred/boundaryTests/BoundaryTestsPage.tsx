import { useState } from 'react';
import { Link } from 'wouter';
import {
  ChevronLeft, FlaskConical, AlertTriangle, Play, Square,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, Download,
  RefreshCw, Trash2, Info, MessageCircle, Activity,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBoundaryTestRunner, type BoundaryTestRun, type BoundaryTestAttempt } from '../../admin/boundaryTests/useBoundaryTestRunner';
import { CATEGORIES, ADVERSARIAL_CASES } from '../../admin/boundaryTests/adversarialCases';
import type { LeakType } from '../../admin/boundaryTests/leakDetection';

const LEAK_TYPE_LABELS: Record<LeakType, string> = {
  RECOMMENDATION: 'Recommendation',
  INSTRUCTIONS: 'Instructions',
  PLANNING: 'Planning',
  COMPARISON: 'Comparison',
  REFERENCE_FACTS: 'Reference Facts',
  ROLE_OVERRIDE_COMPLIANCE: 'Role Override',
  EDUCATIONAL_EXPLANATION: 'Educational',
};

const LEAK_TYPE_COLORS: Record<LeakType, string> = {
  RECOMMENDATION: 'bg-orange-50 border-orange-200 text-orange-700',
  INSTRUCTIONS: 'bg-red-50 border-red-200 text-red-700',
  PLANNING: 'bg-rose-50 border-rose-200 text-rose-700',
  COMPARISON: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  REFERENCE_FACTS: 'bg-purple-50 border-purple-200 text-purple-700',
  ROLE_OVERRIDE_COMPLIANCE: 'bg-pink-50 border-pink-200 text-pink-700',
  EDUCATIONAL_EXPLANATION: 'bg-blue-50 border-blue-200 text-blue-700',
};

function LeakTypeBadge({ type }: { type: LeakType }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-6 text-[10px] font-semibold border ${LEAK_TYPE_COLORS[type]}`}>
      {LEAK_TYPE_LABELS[type]}
    </span>
  );
}

function PassBadge({ pass }: { pass: boolean }) {
  return pass ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-6 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 size={11} />
      PASS
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-6 text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
      <XCircle size={11} />
      FAIL
    </span>
  );
}

function ExpectedBadge({ expected }: { expected: string }) {
  return expected === 'CRISIS_MODE' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-6 text-[10px] font-semibold bg-amber-50 border border-amber-200 text-amber-700">
      <AlertTriangle size={9} />
      CRISIS
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-6 text-[10px] font-semibold bg-blue-50 border border-blue-200 text-blue-700">
      <MessageCircle size={9} />
      REDIRECT
    </span>
  );
}

function QualityBadge({ pass }: { pass: boolean }) {
  return pass ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-6 text-[10px] font-semibold bg-teal-50 border border-teal-200 text-teal-700">
      <Activity size={9} />
      Quality OK
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-6 text-[10px] font-semibold bg-amber-50 border border-amber-200 text-amber-700">
      <Activity size={9} />
      Blank refusal
    </span>
  );
}

function BehaviorMatchBadge({ matched, actual }: { matched: boolean; actual: string }) {
  return matched ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-6 text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
      Behavior OK
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-6 text-[10px] font-semibold bg-red-50 border border-red-200 text-red-700">
      Behavior: {actual}
    </span>
  );
}

function AttemptRow({ attempt }: { attempt: BoundaryTestAttempt }) {
  return (
    <div className={`rounded-[10px] border p-3 space-y-2 ${attempt.leaked ? 'border-red-200 bg-red-50/30' : 'border-app-border bg-app-bg/60'}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-app-muted uppercase tracking-wider w-[72px] flex-shrink-0">
          Attempt {attempt.boundaryAttempts}
        </span>
        <PassBadge pass={!attempt.leaked} />
        <QualityBadge pass={attempt.redirectionQuality.qualityPass} />
        {attempt.crisisTriggered && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-6 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle size={9} />
            CRISIS
          </span>
        )}
        {attempt.boundaryTriggered && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-6 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            BOUNDARY
          </span>
        )}
        {attempt.leakTypes.map(lt => <LeakTypeBadge key={lt} type={lt} />)}
      </div>

      <p className="text-[13px] text-app-text leading-relaxed whitespace-pre-wrap break-words pl-[80px]">
        {attempt.responseText || <em className="text-app-muted">No response</em>}
      </p>

      {attempt.reasons.length > 0 && (
        <div className="pl-[80px] space-y-1">
          <ul className="space-y-0.5">
            {attempt.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-red-600 font-mono">
                <XCircle size={10} className="flex-shrink-0 mt-0.5" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TestRunRow({ run }: { run: BoundaryTestRun }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border-b border-app-border last:border-0 ${!run.overallPass ? 'bg-red-50/10' : ''}`}>
      <button
        className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-app-bg/50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="text-[11px] font-mono font-semibold text-app-muted w-[88px] flex-shrink-0">
          {run.caseId}
        </span>
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-app-muted border border-app-border bg-app-bg px-2 py-0.5 rounded-6">
              {run.category}
            </span>
            <ExpectedBadge expected={run.expected} />
            <BehaviorMatchBadge matched={run.behaviorMatch.matched} actual={run.behaviorMatch.actual} />
          </div>
          <p className="text-[13px] text-app-text truncate">{run.prompt}</p>
        </div>
        <div className="flex-shrink-0">
          <PassBadge pass={run.overallPass} />
        </div>
        <div className="flex-shrink-0 text-app-muted">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3">
          {run.notes && (
            <div className="flex items-start gap-2 text-[12px] text-app-muted bg-app-bg rounded-[8px] px-3 py-2 border border-app-border">
              <Info size={12} className="flex-shrink-0 mt-0.5" />
              {run.notes}
            </div>
          )}
          <div className="space-y-2">
            {run.attempts.map((attempt) => (
              <AttemptRow key={attempt.boundaryAttempts} attempt={attempt} />
            ))}
          </div>
          {!run.behaviorMatch.matched && (
            <div className="flex items-start gap-2 text-[12px] text-red-600 bg-red-50 rounded-[8px] px-3 py-2 border border-red-200">
              <XCircle size={12} className="flex-shrink-0 mt-0.5" />
              <span>
                <strong>Behavior mismatch:</strong> expected <code className="font-mono">{run.expected}</code>,
                got <code className="font-mono">{run.behaviorMatch.actual}</code>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function exportJSON(results: BoundaryTestRun[]) {
  const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `boundary-test-results-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function BoundaryTestsPage() {
  const { user } = useAuth();
  const { isRunning, progress, results, summary, error, runAll, cancel, clearResults } = useBoundaryTestRunner();
  const [categoryFilter, setCategoryFilter] = useState('');

  const filtered = categoryFilter
    ? results.filter(r => r.category === categoryFilter)
    : results;

  const allCasesCount = ADVERSARIAL_CASES.length;
  const passCount = results.filter(r => r.overallPass).length;
  const failCount = results.filter(r => !r.overallPass).length;
  const hasResults = results.length > 0;

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{
        minHeight: 'calc(100dvh - var(--chrome-total))',
        paddingBottom: 'calc(var(--nav-total) + 1.5rem)',
      }}
    >
      <div className="max-w-5xl mx-auto space-y-5">

        <div className="flex items-start gap-4">
          <Link
            href="/app/admin"
            className="mt-0.5 p-2 rounded-10 bg-app-surface border border-app-border hover:border-sage-strong transition-colors text-app-muted hover:text-sage-strong"
          >
            <ChevronLeft size={16} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <FlaskConical size={20} className="text-sage-strong" />
              <h1 className="text-2xl font-semibold text-app-text">Boundary Tests</h1>
            </div>
            <p className="text-sm text-app-muted mt-0.5">
              Universal emotional-scope enforcement — {allCasesCount} adversarial prompts across {CATEGORIES.length} categories
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-[12px] text-sm text-amber-800">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <div>
            <span className="font-semibold">Important: </span>
            <span>
              <code className="text-[12px] font-mono bg-amber-100 px-1 rounded">ALLOW_GENERAL_MODE</code>{' '}
              must be <code className="text-[12px] font-mono bg-amber-100 px-1 rounded">false</code> in the
              edge function for valid results. Tests run against the live Elena backend with real token consumption.
            </span>
          </div>
        </div>

        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={isRunning ? cancel : () => runAll(user?.id ?? '')}
                disabled={!user}
                className={`flex items-center gap-2 px-5 h-10 rounded-10 text-sm font-medium transition-colors ${
                  isRunning
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                    : 'bg-sage-strong text-white hover:opacity-90'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isRunning ? <><Square size={14} />Cancel</> : <><Play size={14} />Run all tests</>}
              </button>

              {hasResults && !isRunning && (
                <button
                  onClick={clearResults}
                  className="flex items-center gap-2 px-4 h-10 rounded-10 text-sm font-medium text-app-muted hover:text-danger bg-app-bg border border-app-border hover:border-danger transition-colors"
                >
                  <Trash2 size={14} />
                  Clear
                </button>
              )}

              {hasResults && !isRunning && (
                <button
                  onClick={() => exportJSON(results)}
                  className="flex items-center gap-2 px-4 h-10 rounded-10 text-sm font-medium text-app-muted hover:text-app-text bg-app-bg border border-app-border hover:border-sage-strong transition-colors"
                >
                  <Download size={14} />
                  Export JSON
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {isRunning && (
                <div className="flex items-center gap-2 text-sm text-app-muted">
                  <RefreshCw size={14} className="animate-spin" />
                  <span className="font-medium tabular-nums">{progress.done} / {progress.total}</span>
                  {progress.currentCaseId && (
                    <span className="text-[12px] font-mono text-app-muted">{progress.currentCaseId}</span>
                  )}
                </div>
              )}
              {hasResults && !isRunning && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <CheckCircle2 size={14} />{passCount} passed
                  </span>
                  <span className="text-app-border">·</span>
                  <span className="flex items-center gap-1.5 text-red-700 font-semibold">
                    <XCircle size={14} />{failCount} failed
                  </span>
                  <span className="text-app-border">·</span>
                  <span className="text-app-muted">{allCasesCount} total</span>
                </div>
              )}
            </div>
          </div>

          {isRunning && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-app-muted mb-1.5">
                <span>Progress</span>
                <span className="tabular-nums">{Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-app-bg rounded-full overflow-hidden border border-app-border">
                <div
                  className="h-full bg-sage-strong rounded-full transition-all duration-300"
                  style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
            <XCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Test run error</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {summary && !isRunning && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-app-surface border border-app-border rounded-[12px] p-4">
                <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">Total Cases</p>
                <p className="text-2xl font-semibold text-app-text">{results.length}</p>
              </div>
              <div className={`bg-app-surface border rounded-[12px] p-4 ${passCount === results.length ? 'border-emerald-200' : 'border-app-border'}`}>
                <p className="text-[11px] font-medium text-emerald-500 uppercase tracking-wider mb-1">Passed</p>
                <p className="text-2xl font-semibold text-emerald-600">{passCount}</p>
              </div>
              <div className={`bg-app-surface border rounded-[12px] p-4 ${failCount > 0 ? 'border-red-200' : 'border-app-border'}`}>
                <p className="text-[11px] font-medium text-red-400 uppercase tracking-wider mb-1">Failed</p>
                <p className="text-2xl font-semibold text-red-600">{failCount}</p>
              </div>
              <div className="bg-app-surface border border-app-border rounded-[12px] p-4">
                <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">API Calls</p>
                <p className="text-2xl font-semibold text-app-text">{summary.totalAttempts}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={`bg-app-surface border rounded-[12px] p-4 ${summary.behaviorMismatchCount > 0 ? 'border-red-200' : 'border-app-border'}`}>
                <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">Behavior Mismatches</p>
                <p className={`text-2xl font-semibold ${summary.behaviorMismatchCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {summary.behaviorMismatchCount}
                </p>
                <p className="text-[11px] text-app-muted mt-1">Expected vs actual response mode</p>
              </div>
              <div className={`bg-app-surface border rounded-[12px] p-4 ${summary.redirectionQualityFailCount > 0 ? 'border-amber-200' : 'border-app-border'}`}>
                <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">Blank Refusals</p>
                <p className={`text-2xl font-semibold ${summary.redirectionQualityFailCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {summary.redirectionQualityFailCount}
                </p>
                <p className="text-[11px] text-app-muted mt-1">Responses lacking emotional language or question</p>
              </div>
            </div>

            {Object.keys(summary.leakTypeCounts).length > 0 && (
              <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5">
                <h2 className="text-[13px] font-semibold text-app-text uppercase tracking-widest mb-3">Leak Type Breakdown</h2>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summary.leakTypeCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <span
                        key={type}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-[12px] font-medium border ${LEAK_TYPE_COLORS[type as LeakType] ?? 'bg-app-bg border-app-border text-app-muted'}`}
                      >
                        {LEAK_TYPE_LABELS[type as LeakType] ?? type}
                        <span className="font-bold">{count}×</span>
                      </span>
                    ))}
                </div>
              </div>
            )}
          </>
        )}

        {hasResults && (
          <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
            <div className="px-5 py-3 border-b border-app-border flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-[13px] font-semibold text-app-text">
                Results
                {isRunning && <span className="ml-2 text-[11px] font-normal text-app-muted">(updating live...)</span>}
              </h2>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-app-muted font-medium">Filter:</label>
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="h-8 px-2.5 rounded-8 bg-app-bg border border-app-border text-[12px] text-app-text focus:outline-none focus:border-sage-strong transition-colors"
                >
                  <option value="">All categories ({results.length})</option>
                  {CATEGORIES.map(cat => {
                    const catCount = results.filter(r => r.category === cat).length;
                    const catFails = results.filter(r => r.category === cat && !r.overallPass).length;
                    return (
                      <option key={cat} value={cat}>
                        {cat}{catFails > 0 ? ` (${catFails} fail)` : ''} — {catCount}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div>
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-sm text-app-muted">
                  No results match the selected filter.
                </div>
              ) : (
                filtered.map(run => <TestRunRow key={run.caseId} run={run} />)
              )}
            </div>
          </div>
        )}

        {!hasResults && !isRunning && (
          <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-12 text-center space-y-3">
            <FlaskConical size={36} className="mx-auto text-sage-soft" strokeWidth={1.5} />
            <div>
              <p className="text-app-text font-medium">No results yet</p>
              <p className="text-sm text-app-muted mt-1">
                Press "Run all tests" to execute {allCasesCount} adversarial prompts across {CATEGORIES.length} categories.
              </p>
            </div>
            <div className="flex items-center justify-center gap-4 text-[12px] text-app-muted pt-2 flex-wrap">
              <span>{allCasesCount} test cases</span>
              <span>·</span>
              <span>{CATEGORIES.length} categories</span>
              <span>·</span>
              <span>3 escalation attempts each</span>
              <span>·</span>
              <span>{allCasesCount * 3} total API calls</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
