// Lightweight SM-2 variant inspired by Anki. Per-card state persisted as JSON.
// States:
//   - No entry => card is "new" (never studied).
//   - entry with interval=0 => card is in "learning" (sub-day steps).
//   - entry with interval>=1 => "review" (measured in days).

export type Grade = 'again' | 'hard' | 'easy';

export type CardState = {
  ease: number;      // multiplier, 1.3..
  interval: number;  // days (0 means still in learning)
  due: number;       // unix ms timestamp when next due
  reps: number;      // successful reviews
  lapses: number;    // times Again was pressed on a review card
};

export type Reviews = Record<string, CardState>;

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;
const MIN = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

// Learning (sub-day) steps.
const LEARN_AGAIN_MIN = 1;
const LEARN_HARD_MIN = 5;
// Promote to review with this many days on first "Easy".
const GRAD_EASY_DAYS = 4;
const GRAD_HARD_DAYS = 1;

// Review-card intervals.
const LAPSE_RELEARN_MIN = 10;
const HARD_FACTOR = 1.2;
const EASY_BONUS = 1.3;

export function isDue(state: CardState | undefined, now: number): boolean {
  if (!state) return true; // new cards are always "due"
  return state.due <= now;
}

export function grade(prev: CardState | undefined, g: Grade, now = Date.now()): CardState {
  const base: CardState = prev ?? {
    ease: DEFAULT_EASE,
    interval: 0,
    due: now,
    reps: 0,
    lapses: 0,
  };

  // Learning phase (new or lapsed): sub-day steps in minutes.
  if (base.interval === 0) {
    if (g === 'again') {
      return { ...base, due: now + LEARN_AGAIN_MIN * MIN };
    }
    if (g === 'hard') {
      return {
        ...base,
        interval: GRAD_HARD_DAYS,
        due: now + GRAD_HARD_DAYS * DAY,
        reps: base.reps + 1,
      };
    }
    // easy → graduate
    return {
      ...base,
      interval: GRAD_EASY_DAYS,
      due: now + GRAD_EASY_DAYS * DAY,
      reps: base.reps + 1,
    };
  }

  // Review phase.
  if (g === 'again') {
    const ease = Math.max(MIN_EASE, base.ease - 0.2);
    return {
      ease,
      interval: 0, // back to learning
      due: now + LAPSE_RELEARN_MIN * MIN,
      reps: base.reps,
      lapses: base.lapses + 1,
    };
  }
  if (g === 'hard') {
    const ease = Math.max(MIN_EASE, base.ease - 0.15);
    const interval = Math.max(1, Math.round(base.interval * HARD_FACTOR));
    return {
      ease,
      interval,
      due: now + interval * DAY,
      reps: base.reps + 1,
      lapses: base.lapses,
    };
  }
  // easy
  const ease = base.ease + 0.15;
  const interval = Math.max(base.interval + 1, Math.round(base.interval * base.ease * EASY_BONUS));
  return {
    ease,
    interval,
    due: now + interval * DAY,
    reps: base.reps + 1,
    lapses: base.lapses,
  };
}

export function dueAndNewIds(cardIds: number[], reviews: Reviews, now = Date.now()): number[] {
  return cardIds.filter((id) => isDue(reviews[String(id)], now));
}

// Human-friendly preview for each grade button ("1m", "5m", "4d", ...).
export function previewLabel(prev: CardState | undefined, g: Grade, now = Date.now()): string {
  const next = grade(prev, g, now);
  const deltaMs = next.due - now;
  if (deltaMs < 60 * MIN) return `${Math.max(1, Math.round(deltaMs / MIN))}m`;
  if (deltaMs < DAY) return `${Math.round(deltaMs / (60 * MIN))}h`;
  return `${Math.round(deltaMs / DAY)}d`;
}
