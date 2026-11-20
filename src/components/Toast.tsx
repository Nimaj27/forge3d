import { create } from 'zustand';
import { Icon } from './Icon';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, kind?: ToastKind, durationMs?: number) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToasts = create<ToastState>()((set, get) => ({
  items: [],
  push: (message, kind = 'info', durationMs = 4500) => {
    const id = ++seq;
    set({ items: [...get().items.slice(-3), { id, kind, message }] });
    setTimeout(() => get().dismiss(id), durationMs);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

/** Raccourci utilisable hors composants React. */
export function toast(message: string, kind: ToastKind = 'info', durationMs?: number): void {
  useToasts.getState().push(message, kind, durationMs);
}

const ICONS = { info: 'info', success: 'check', warning: 'warning', error: 'error' } as const;
const COLORS = { info: 'var(--info)', success: 'var(--success)', warning: 'var(--warning)', error: 'var(--danger)' };

/** Zone d'affichage des messages (annoncée aux lecteurs d'écran). */
export function ToastZone() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="toast-zone" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: COLORS[t.kind], marginTop: 1 }}>
            <Icon name={ICONS[t.kind]} />
          </span>
          <span style={{ flex: '1 1 auto', lineHeight: 1.45 }}>{t.message}</span>
          <button type="button" className="icon-btn icon-btn--plain" style={{ width: 32, height: 32 }} aria-label="Fermer le message" onClick={() => dismiss(t.id)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
