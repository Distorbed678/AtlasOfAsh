import { useToasts } from '../toasts';

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((tst) => (
        <button key={tst.id} className={`toast toast-${tst.kind}`} onClick={() => dismiss(tst.id)}>
          {tst.text}
        </button>
      ))}
    </div>
  );
}
