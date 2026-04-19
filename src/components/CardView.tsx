import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, loadCards } from '../apkg';
import { Grade, Reviews, grade as applyGrade, isDue, previewLabel } from '../scheduler';

type Props = { apkgPath: string };

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatDelta(ms: number): string {
  if (ms <= 0) return 'now';
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  if (ms < HOUR) return `${Math.ceil(ms / MIN)}m`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`;
  return `${Math.round(ms / DAY)}d`;
}

export default function CardView({ apkgPath }: Props) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [reviews, setReviews] = useState<Reviews>({});
  const [queue, setQueue] = useState<number[]>([]); // card IDs in study order
  const [showBack, setShowBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setCards(null);
    try {
      const buf = await window.api.apkg.read(apkgPath);
      const [all, savedRaw] = await Promise.all([
        loadCards(buf),
        window.api.reviews.get(apkgPath),
      ]);
      const saved = (savedRaw ?? {}) as Reviews;
      setCards(all);
      setReviews(saved);
      const t = Date.now();
      const dueIds = all.filter((c) => isDue(saved[String(c.id)], t)).map((c) => c.id);
      setQueue(shuffle(dueIds));
      setShowBack(false);
      setNow(t);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [apkgPath]);

  useEffect(() => { load(); }, [load]);

  // Debounced persistence of the reviews map.
  const scheduleSave = useCallback((next: Reviews) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.api.reviews.save(apkgPath, next).catch(() => {});
    }, 250);
  }, [apkgPath]);

  const byId = useMemo(() => {
    const m = new Map<number, Card>();
    cards?.forEach((c) => m.set(c.id, c));
    return m;
  }, [cards]);

  const currentId = queue[0];
  const current = currentId != null ? byId.get(currentId) : undefined;
  const currentState = currentId != null ? reviews[String(currentId)] : undefined;

  const onGrade = (g: Grade) => {
    if (currentId == null) return;
    const t = Date.now();
    const nextState = applyGrade(currentState, g, t);
    const nextReviews: Reviews = { ...reviews, [String(currentId)]: nextState };
    setReviews(nextReviews);
    scheduleSave(nextReviews);

    // Re-insert into queue if it's still due within this session (short relearning).
    const rest = queue.slice(1);
    let nextQueue = rest;
    if (nextState.due <= t + 60 * 60 * 1000) {
      // Place a few cards later (soonest-due first at head keeps things fresh).
      const offset = Math.min(g === 'again' ? 2 : 6, rest.length);
      nextQueue = [...rest.slice(0, offset), currentId, ...rest.slice(offset)];
    }
    setQueue(nextQueue);
    setShowBack(false);
    setNow(t);
  };

  // Live-tick the "next due" countdown when the queue is empty.
  useEffect(() => {
    if (queue.length > 0) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [queue.length]);

  if (error) {
    return (
      <div className="card-area">
        <p className="error">{error}</p>
        <button onClick={load}>Retry</button>
      </div>
    );
  }
  if (!cards) return <div className="card-area"><p className="muted">Loading deck…</p></div>;
  if (cards.length === 0) return <div className="card-area"><p>Deck has no cards.</p></div>;

  if (!current) {
    // Nothing due. Show the soonest upcoming card.
    const upcoming = Object.values(reviews)
      .map((s) => s.due)
      .sort((a, b) => a - b)[0];
    return (
      <div className="card-area">
        <p>All caught up 🎉</p>
        {upcoming && <p className="muted">Next card due in {formatDelta(upcoming - now)}</p>}
        <button onClick={load}>Refresh</button>
      </div>
    );
  }

  return (
    <div className="card-area">
      <div
        className="card"
        onClick={() => setShowBack((v) => !v)}
        dangerouslySetInnerHTML={{ __html: showBack ? current.back : current.front }}
      />
      {showBack ? (
        <div className="grade-row">
          <button className="grade grade-again" onClick={() => onGrade('again')}>
            <span className="grade-label">Don't know</span>
            <span className="grade-preview">{previewLabel(currentState, 'again', now)}</span>
          </button>
          <button className="grade grade-hard" onClick={() => onGrade('hard')}>
            <span className="grade-label">Hard</span>
            <span className="grade-preview">{previewLabel(currentState, 'hard', now)}</span>
          </button>
          <button className="grade grade-easy" onClick={() => onGrade('easy')}>
            <span className="grade-label">Easy</span>
            <span className="grade-preview">{previewLabel(currentState, 'easy', now)}</span>
          </button>
        </div>
      ) : (
        <div className="card-footer">
          <span className="muted">{queue.length} due</span>
          <span className="muted">Click card to flip</span>
        </div>
      )}
    </div>
  );
}
