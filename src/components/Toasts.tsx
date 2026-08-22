import type { ToastItem } from '../types';
import { IconAlert, IconBell, IconCheck, IconInfo, IconX } from '../icons';

const KIND_META: Record<ToastItem['kind'], { icon: typeof IconInfo; cls: string }> = {
  info: { icon: IconInfo, cls: 'text-skyx-300 bg-skyx-500/15' },
  success: { icon: IconCheck, cls: 'text-jade-300 bg-jade-500/15' },
  warn: { icon: IconAlert, cls: 'text-coral-300 bg-coral-500/15' },
  ember: { icon: IconBell, cls: 'text-ember-300 bg-ember-500/15' },
};

export function Toasts({
  items,
  onClose,
}: {
  items: ToastItem[];
  onClose: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[330px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {items.map((t) => {
        const meta = KIND_META[t.kind];
        const Icon = meta.icon;
        return (
          <div
            key={t.id}
            className="anim-pop pointer-events-auto flex items-start gap-3 rounded-xl border border-white/12 px-3.5 py-3 glass-deep"
          >
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.cls}`}>
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-5 text-fog-50">{t.title}</p>
              {t.text && (
                <p className="mt-0.5 break-words text-xs leading-5 text-fog-300">{t.text}</p>
              )}
            </div>
            <button
              onClick={() => onClose(t.id)}
              className="rounded-md p-1 text-fog-400 transition hover:bg-white/10 hover:text-fog-100"
              aria-label="关闭提醒"
            >
              <IconX size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
