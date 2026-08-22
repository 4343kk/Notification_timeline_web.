import { useEffect, useState } from 'react';
import type { ScheduleItem, Tag } from '../types';
import { TAG_LIST, TAG_META } from '../types';
import { IconChevronDown, IconChevronUp, IconClock, IconPin, IconX } from '../icons';

export interface EditorPayload {
  title: string;
  time: number;
  tag: Tag;
  location: string;
  notify: boolean;
}

interface Props {
  initial: ScheduleItem | null;
  onSave: (p: EditorPayload) => void;
  onClose: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function EditorModal({ initial, onSave, onClose }: Props) {
  const base = initial ? new Date(initial.time) : new Date(Date.now() + 45 * 60_000);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [tag, setTag] = useState<Tag>(initial?.tag ?? 'patrol');
  const [notify, setNotify] = useState(initial?.notify ?? true);
  const [hour, setHour] = useState(base.getHours());
  const [minute, setMinute] = useState(Math.round(base.getMinutes() / 5) * 5 >= 60 ? 55 : Math.round(base.getMinutes() / 5) * 5);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const bump = (set: (n: number) => void, cur: number, delta: number, max: number) =>
    set((cur + delta + max) % max);

  const save = () => {
    const t = title.trim();
    if (!t) return;
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    onSave({ title: t, time: d.getTime(), tag, location: location.trim() || '全场', notify });
  };

  const stepper = (
    label: string,
    value: number,
    set: (n: number) => void,
    step: number,
    max: number
  ) => (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => bump(set, value, step, max)}
        className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-fog-300 transition hover:border-ember-400/40 hover:text-ember-300 active:scale-95"
        aria-label={`增加${label}`}
      >
        <IconChevronUp size={15} />
      </button>
      <div className="w-[64px] rounded-lg border border-white/10 bg-fog-950/60 py-2 text-center font-mono text-2xl font-semibold text-fog-50">
        {pad(value)}
      </div>
      <button
        type="button"
        onClick={() => bump(set, value, -step, max)}
        className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-fog-300 transition hover:border-ember-400/40 hover:text-ember-300 active:scale-95"
        aria-label={`减少${label}`}
      >
        <IconChevronDown size={15} />
      </button>
      <span className="text-[10px] tracking-widest text-fog-400">{label}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-fog-950/65 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="anim-pop w-full max-w-[440px] rounded-2xl glass-deep">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h3 className="font-display text-lg font-bold text-fog-50">
            {initial ? '编辑日程' : '新建日程'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-fog-400 transition hover:bg-white/10 hover:text-fog-100"
            aria-label="关闭"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium tracking-widest text-fog-400">
              日程标题
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：夜场灯光秀联调"
              className="w-full rounded-xl border border-white/10 bg-fog-950/50 px-3.5 py-2.5 text-sm text-fog-50 placeholder:text-fog-500 transition focus:border-ember-400/50 focus:bg-fog-950/70"
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-widest text-fog-400">
                <IconPin size={12} /> 位置
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例如：1F 中庭"
                className="w-full rounded-xl border border-white/10 bg-fog-950/50 px-3.5 py-2.5 text-sm text-fog-50 placeholder:text-fog-500 transition focus:border-ember-400/50"
              />
              <label className="mb-1.5 mt-4 block text-[11px] font-medium tracking-widest text-fog-400">
                分类标签
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TAG_LIST.map((t) => {
                  const meta = TAG_META[t];
                  const active = tag === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTag(t)}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition active:scale-95 ${
                        active
                          ? `${meta.pill} shadow-[0_0_14px_-4px_rgba(255,255,255,0.25)]`
                          : 'border-white/10 bg-white/[0.04] text-fog-300 hover:border-white/25'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-center gap-1.5 text-[11px] font-medium tracking-widest text-fog-400">
                <IconClock size={12} /> 时间
              </label>
              <div className="flex items-start gap-2">
                {stepper('时', hour, setHour, 1, 24)}
                <span className="mt-[46px] font-mono text-xl text-ember-400">:</span>
                {stepper('分', minute, setMinute, 5, 60)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setNotify(!notify)}
            className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 transition ${
              notify
                ? 'border-ember-400/40 bg-ember-500/10'
                : 'border-white/10 bg-white/[0.04] hover:border-white/20'
            }`}
          >
            <span className="text-sm text-fog-100">到点推送 Windows 系统通知</span>
            <span
              className={`relative h-5 w-9 rounded-full transition ${notify ? 'bg-ember-500' : 'bg-white/15'}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  notify ? 'left-[18px]' : 'left-0.5'
                }`}
              />
            </span>
          </button>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/12 px-4 py-2 text-sm text-fog-200 transition hover:bg-white/8 active:scale-95"
          >
            取消
          </button>
          <button
            onClick={save}
            disabled={!title.trim()}
            className="rounded-xl bg-gradient-to-b from-ember-400 to-ember-600 px-5 py-2 text-sm font-semibold text-fog-950 shadow-[0_8px_20px_-8px_rgba(245,168,60,0.7)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            保存日程
          </button>
        </div>
      </div>
    </div>
  );
}
