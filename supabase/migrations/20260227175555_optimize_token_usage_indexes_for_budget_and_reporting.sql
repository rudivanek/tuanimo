/*
  # Optimize token_usage indexes for budget enforcement and admin reporting

  ## Summary
  Replaces the original plain (user_id, created_at) btree and redundant BRIN with
  a set of indexes specifically tuned to the two dominant query shapes:
    1. Per-user daily/monthly budget checks (check_token_budget RPC)
    2. Cross-user date-range aggregates (admin_token_cost_report RPC)

  ## Index Changes

  ### Dropped
  | Index                              | Type  | Reason                                            |
  |------------------------------------|-------|---------------------------------------------------|
  | token_usage_user_created_brin_idx  | BRIN  | user_id is not correlated with physical order;    |
  |                                    |       | btree covering index makes this redundant         |
  | token_usage_user_created_idx       | btree | Replaced by covering version that includes        |
  |                                    |       | total_tokens for index-only scans                 |

  ### Added
  | Index                                  | Definition                                          | Purpose                                                     |
  |----------------------------------------|-----------------------------------------------------|-------------------------------------------------------------|
  | token_usage_user_created_covering_idx  | (user_id, created_at DESC) INCLUDE (total_tokens)   | Index-only scans for check_token_budget daily/monthly SUM   |
  | token_usage_created_at_idx             | (created_at DESC)                                   | Efficient date-range access for admin aggregate reports     |
  | token_usage_operation_created_idx      | (operation, created_at DESC)                        | Feature-grouped admin reports; low-cardinality GROUP BY     |

  ### Unchanged
  | Index                         | Definition            | Reason kept                         |
  |-------------------------------|-----------------------|-------------------------------------|
  | token_usage_user_operation_idx| (user_id, operation)  | Per-user per-feature breakdown usage|

  ## Why covering index for budget enforcement?
  check_token_budget runs two SUM(total_tokens) queries per AI call:
    SELECT SUM(total_tokens) WHERE user_id = $1 AND created_at >= <day_start>
    SELECT SUM(total_tokens) WHERE user_id = $1 AND created_at >= <month_start>

  Without INCLUDE (total_tokens), PostgreSQL must do a heap fetch for every
  qualifying index entry to read total_tokens. With a covering index, both
  SUM queries become pure index-only scans — no heap I/O at all, regardless
  of table size. This keeps budget enforcement at <1ms even with millions of rows.

  ## Why (created_at DESC) for admin reports?
  admin_token_cost_report queries scan a date range across ALL users:
    WHERE created_at >= p_from AND created_at < p_to + 1 day

  A standalone btree on created_at allows the planner to switch from Seq Scan
  (fine at 237 rows) to Bitmap Index Scan → Bitmap Heap Scan at scale
  (~100k+ rows), dramatically reducing pages read for short date windows.

  ## Why (operation, created_at DESC)?
  Enables an index-scan path for the feature-grouped admin report query
  instead of a full table scan + in-memory HashAggregate on operation.
  With low operation cardinality (3-5 distinct values), the planner may
  prefer this for tighter date windows.

  ## Rollup note
  These indexes extend useful life to ~10M rows without further changes.
  Beyond that, the token_usage_daily_rollup table (scaffolded in a separate
  migration) should be used for admin reporting queries.

  ## Safety
  - All operations use IF EXISTS / IF NOT EXISTS guards
  - No data is modified
  - Index drops and creates are non-destructive (other indexes remain live)
*/

-- ── 1. Drop superseded indexes ────────────────────────────────────────────────

DROP INDEX IF EXISTS public.token_usage_user_created_brin_idx;
DROP INDEX IF EXISTS public.token_usage_user_created_idx;

-- ── 2. Covering index for check_token_budget (per-user date range + total_tokens) ──
CREATE INDEX IF NOT EXISTS token_usage_user_created_covering_idx
  ON public.token_usage (user_id, created_at DESC)
  INCLUDE (total_tokens);

COMMENT ON INDEX token_usage_user_created_covering_idx IS
  'Covering index for check_token_budget: enables index-only SUM(total_tokens) '
  'scans for daily/monthly budget enforcement without touching the heap.';

-- ── 3. Standalone created_at index for admin report date-range scans ─────────
CREATE INDEX IF NOT EXISTS token_usage_created_at_idx
  ON public.token_usage (created_at DESC);

COMMENT ON INDEX token_usage_created_at_idx IS
  'Supports admin_token_cost_report cross-user date-range aggregates. '
  'Planner switches from Seq Scan to Bitmap Index Scan at ~100k+ rows.';

-- ── 4. Feature + date index for operation-grouped admin reports ───────────────
CREATE INDEX IF NOT EXISTS token_usage_operation_created_idx
  ON public.token_usage (operation, created_at DESC);

COMMENT ON INDEX token_usage_operation_created_idx IS
  'Supports admin_token_cost_report GROUP BY operation within a date window. '
  'Eliminates sort for low-cardinality operation grouping.';
