import { Fragment, useRef, useState } from 'react';
import type { ScheduleItem } from '../types';
import { TAG_META, countdown, fmtTime } from '../types';
import {
  IconBell,
  IconCalendar,
  IconCheck,
  IconGrip,
  IconPencil,
  IconPin,
  IconPlus,
  IconTrash,
} from '../icons';

interface Props {
  schedules: ScheduleItem[];
  now: number;
  onToggleDone: (id: string) => void;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onCreate: () => void;
}

function NowLine({ now }: { now: number }) {
  return (
    <div className="anim-rise relative z-10 -mx-1 flex items-center gap-2.5 py-0.5">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ember-400" />
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-ember-400/70 via-ember-400/25 to-transparent" />
      <span className="shrink-0 rounded-full border border-ember-400/40 bg-ember-500/15 px-2.5 py-0.5 font-mono text-[11px] font-medium text-ember-300">
        现在 {fmtTime(now)}
      </span>
    </div>
  );
}

function DropLine() {
  return (
    <div className="relative my-1 h-[3px] rounded-full bg-ember-400 shadow-[0_0_14px_rgba(245,168,60,0.75)]">
      <span className="absolute -left-1 -top-[3px] h-[9px] w-[9px] rounded-full bg-ember-300" />
    </div>
  );
}

export function Timeline({
  schedules,
  now,
  onToggleDone,
  onEdit,
  onDelete,
  onReorder,
  onCreate,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmTimer = useRef<number | null>(null);

  const commit = () => {
    if (dragId && insertAt !== null) {
      const ids = schedules.map((s) => s.id);
      const from = ids.indexOf(dragId);
      if (from !== -1) {
        ids.splice(from, 1);
        const to = from < insertAt ? insertAt - 1 : insertAt;
        ids.splice(to, 0, dragId);
        if (ids.join('|') !== schedules.map((s) => s.id).join('|')) {
          onReorder(ids);
        }
      }
    }
    setDragId(null);
    setInsertAt(null);
  };

  const askDelete = (id: string) => {
    if (confirmId === id) {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      setConfirmId(null);
      onDelete(id);
      return;
    }
    setConfirmId(id);
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => setConfirmId(null), 2600);
  };

  const doneCount = schedules.filter((s) => s.done).length;
  const next = schedules.find((s) => !s.done && s.time > now);
  const nowIdx = schedules.filter((s) => s.time <= now).length;

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl glass">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/8 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember-500/15 text-ember-300">
            <IconCalendar size={17} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold leading-6 text-fog-50">今日日程</h2>
            <p className="text-[11px] text-fog-400">拖动卡片编排顺序 · 改动即时同步各窗口</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 font-mono text-[11px] text-fog-300">
            共 {schedules.length} 项
          </span>
          <span className="rounded-full border border-jade-400/25 bg-jade-500/10 px-2.5 py-1 font-mono text-[11px] text-jade-300">
            已完成 {doneCount}
          </span>
          {next && (
            <span className="hidden rounded-full border border-ember-400/30 bg-ember-500/10 px-2.5 py-1 font-mono text-[11px] text-ember-300 sm:inline">
              下一项 {fmtTime(next.time)} · {countdown(next.time, now)}
            </span>
          )}
          <button
            onClick={onCreate}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-ember-400 to-ember-600 px-3.5 py-2 text-xs font-semibold text-fog-950 shadow-[0_8px_18px_-8px_rgba(245,168,60,0.8)] transition hover:brightness-110 active:scale-95"
          >
            <IconPlus size={13} /> 新建日程
          </button>
        </div>
      </header>

      <div
        className="scroll-slim flex-1 space-y-2 overflow-y-auto px-4 py-4"
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          setInsertAt(schedules.length);
        }}
        onDrop={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        {schedules.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-white/20 text-fog-400">
              <IconCalendar size={24} />
            </span>
            <p className="text-sm text-fog-300">日程表为空</p>
            <button
              onClick={onCreate}
              className="rounded-xl border border-ember-400/40 bg-ember-500/12 px-4 py-2 text-sm text-ember-300 transition hover:bg-ember-500/20 active:scale-95"
            >
              创建第一项日程
            </button>
          </div>
        )}

        {schedules.map((s, i) => {
          const meta = TAG_META[s.tag];
          const diff = s.time - now;
          const mins = Math.round(diff / 60_000);
          const soon = !s.done && diff > 0 && mins < 60;
          const status = s.done
            ? '已完成'
            : diff <= 0
              ? '已过时'
              : mins < 60
                ? `${mins} 分钟后`
                : countdown(s.time, now);
          const statusCls = s.done
            ? 'text-jade-400'
            : diff <= 0
              ? 'text-fog-500'
              : soon
                ? 'text-ember-300'
                : 'text-fog-400';

          return (
            <Fragment key={s.id}>
              {insertAt === i && dragId && <DropLine />}
              {i === nowIdx && <NowLine now={now} />}
              <article
                data-tl-item
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', s.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDragId(s.id);
                  document.body.classList.add('grabbing');
                }}
                onDragEnd={() => {
                  document.body.classList.remove('grabbing');
                  setDragId(null);
                  setInsertAt(null);
                }}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const before = e.clientY < rect.top + rect.height / 2;
                  setInsertAt(before ? i : i + 1);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  commit();
                }}
                className={`anim-rise group relative flex cursor-grab items-center gap-3 rounded-xl border p-3 transition-all duration-200 active:cursor-grabbing ${
                  s.done
                    ? 'border-white/[0.05] bg-white/[0.025] opacity-55'
                    : 'border-white/[0.09] bg-white/[0.055] hover:-translate-y-px hover:border-white/[0.18] hover:bg-white/[0.09] hover:shadow-[0_14px_30px_-16px_rgba(0,0,0,0.7)]'
                } ${dragId === s.id ? 'scale-[0.985] opacity-30' : ''} ${
                  soon ? 'border-ember-400/30' : ''
                }`}
                style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
              >
                <span className="shrink-0 text-fog-500 transition group-hover:text-fog-300">
                  <IconGrip size={15} />
                </span>
                <button
                  onClick={() => onToggleDone(s.id)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
                    s.done
                      ? 'border-jade-400 bg-jade-500/25 text-jade-300'
                      : 'border-white/25 text-transparent hover:border-jade-400 hover:text-jade-400/60'
                  }`}
                  aria-label="切换完成状态"
                >
                  <IconCheck size={11} />
                </button>

                <div className="w-[64px] shrink-0">
                  <div
                    className={`font-mono text-lg font-semibold leading-6 ${
                      s.done ? 'text-fog-400' : 'text-fog-50'
                    }`}
                  >
                    {fmtTime(s.time)}
                  </div>
                  <div className={`text-[10px] leading-4 ${statusCls}`}>{status}</div>
                </div>

                <span
                  className={`h-9 w-[3px] shrink-0 rounded-full ${meta.dot} ${s.done ? 'opacity-30' : 'opacity-90'}`}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`truncate text-[15px] font-medium leading-6 ${
                        s.done ? 'text-fog-400 line-through' : 'text-fog-50'
                      }`}
                    >
                      {s.title}
                    </h4>
                    {s.notify && !s.done && (
                      <span className="shrink-0 text-ember-400" title="到点推送系统通知">
                        <IconBell size={12} />
                      </span>
                    )}
                    <span
                      className={`ml-auto shrink-0 rounded-full border px-2 py-px text-[10px] ${meta.pill}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fog-400">
                    <IconPin size={12} />
                    <span className="truncate">{s.location}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={() => onEdit(s)}
                    className="rounded-lg p-2 text-fog-300 transition hover:bg-white/10 hover:text-fog-50 active:scale-90"
                    aria-label="编辑日程"
                  >
                    <IconPencil size={14} />
                  </button>
                  {confirmId === s.id ? (
                    <button
                      onClick={() => askDelete(s.id)}
                      className="anim-pop rounded-lg bg-coral-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-coral-300 transition hover:bg-coral-500/35 active:scale-95"
                    >
                      确认删除
                    </button>
                  ) : (
                    <button
                      onClick={() => askDelete(s.id)}
                      className="rounded-lg p-2 text-fog-300 transition hover:bg-coral-500/15 hover:text-coral-300 active:scale-90"
                      aria-label="删除日程"
                    >
                      <IconTrash size={14} />
                    </button>
                  )}
                </div>
              </article>
            </Fragment>
          );
        })}
        {insertAt === schedules.length && dragId && <DropLine />}
      </div>

      <footer className="flex items-center gap-2 border-t border-white/8 px-5 py-3 text-[11px] text-fog-400">
        <span className="dot-live h-1.5 w-1.5 shrink-0 rounded-full bg-jade-400" />
        后台服务已接入 · 日程表可被远程实时调整 · 全部改动写入本地数据库并广播
      </footer>
    </section>
  );
}
