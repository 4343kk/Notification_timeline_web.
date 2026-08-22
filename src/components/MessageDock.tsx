import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { DeskMessage, MsgKind } from '../types';
import { fmtTime } from '../types';
import {
  IconAlert,
  IconArrowUp,
  IconDatabase,
  IconLayers,
  IconRadio,
  IconSend,
  IconSpinner,
  IconTerminal,
  IconZap,
} from '../icons';

type Filter = 'all' | 'field' | 'ops' | 'mine';

const KIND_META: Record<MsgKind, { icon: typeof IconRadio; cls: string }> = {
  in: { icon: IconRadio, cls: 'text-jade-300 bg-jade-500/14' },
  urgent: { icon: IconZap, cls: 'text-coral-300 bg-coral-500/14' },
  sys: { icon: IconDatabase, cls: 'text-skyx-300 bg-skyx-500/14' },
  ack: { icon: IconTerminal, cls: 'text-fog-200 bg-white/[0.08]' },
  err: { icon: IconAlert, cls: 'text-coral-300 bg-coral-500/14' },
  out: { icon: IconSend, cls: 'text-ember-300 bg-ember-500/14' },
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'field', label: '现场' },
  { key: 'ops', label: '系统' },
  { key: 'mine', label: '我发出' },
];

const match = (kind: MsgKind, f: Filter) =>
  f === 'all' ||
  (f === 'field' && (kind === 'in' || kind === 'urgent')) ||
  (f === 'ops' && (kind === 'sys' || kind === 'ack' || kind === 'err')) ||
  (f === 'mine' && kind === 'out');

interface Props {
  messages: DeskMessage[];
  hasMore: boolean;
  loadingMore: boolean;
  unread: number;
  peers: number;
  isLeader: boolean;
  channelReady: boolean;
  onSend: (text: string) => void;
  onMore: () => void;
  onSeen: () => void;
  inputRef: RefObject<HTMLInputElement>;
}

export function MessageDock({
  messages,
  hasMore,
  loadingMore,
  unread,
  peers,
  isLeader,
  channelReady,
  onSend,
  onMore,
  onSeen,
  inputRef,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [text, setText] = useState('');
  const [stick, setStick] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el && stick) el.scrollTop = el.scrollHeight;
  }, [messages, filter, stick]);

  const visible = messages.filter((m) => match(m.kind, filter));

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
    setStick(true);
    onSeen();
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl glass" onMouseEnter={onSeen}>
      <header className="border-b border-white/8 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute h-full w-full animate-ping rounded-full bg-jade-400 opacity-60" />
            <span className="relative h-2 w-2 rounded-full bg-jade-400" />
          </span>
          <h2 className="font-display text-base font-bold text-fog-50">实时调度频道</h2>
          {unread > 0 && (
            <span className="dot-ember anim-pop rounded-full bg-ember-500 px-1.5 py-px font-mono text-[10px] font-bold text-fog-950">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-fog-400">
            <IconLayers size={11} />
            {peers} 窗口在线
          </span>
          <span
            className={`rounded-full border px-2 py-px font-mono text-[10px] ${
              isLeader
                ? 'border-ember-400/35 bg-ember-500/12 text-ember-300'
                : 'border-white/12 bg-white/[0.05] text-fog-300'
            }`}
            title="主机窗口负责模拟后台推送，其余窗口实时同步"
          >
            {channelReady ? (isLeader ? '主机' : '同步端') : '连接中'}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          {FILTERS.map((f) => {
            const n = messages.filter((m) => match(m.kind, f.key)).length;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition active:scale-95 ${
                  active
                    ? 'border-ember-400/40 bg-ember-500/14 text-ember-300'
                    : 'border-white/10 bg-white/[0.04] text-fog-300 hover:border-white/25'
                }`}
              >
                {f.label}
                <span className={`font-mono text-[10px] ${active ? 'text-ember-400' : 'text-fog-500'}`}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 90);
          }}
          className="scroll-slim absolute inset-0 flex flex-col gap-2 overflow-y-auto px-3.5 py-3.5"
        >
          {hasMore && (
            <button
              onClick={onMore}
              disabled={loadingMore}
              className="mx-auto flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[11px] text-fog-300 transition hover:border-ember-400/40 hover:text-ember-300 active:scale-95 disabled:opacity-50"
            >
              {loadingMore ? <IconSpinner size={12} /> : <IconArrowUp size={12} />}
              加载更早记录
            </button>
          )}
          {visible.length === 0 && (
            <p className="mt-8 text-center text-xs text-fog-500">该筛选下暂无消息</p>
          )}
          {visible.map((m) => {
            const meta = KIND_META[m.kind];
            const Icon = meta.icon;
            return (
              <div
                key={m.id}
                data-msg-item
                className={`anim-slide-l flex gap-2.5 rounded-xl border p-2.5 ${
                  m.kind === 'urgent'
                    ? 'border-coral-400/30 bg-coral-500/[0.08]'
                    : m.kind === 'out'
                      ? 'ml-7 border-ember-400/20 bg-ember-500/[0.06]'
                      : m.kind === 'err'
                        ? 'border-coral-400/20 bg-coral-500/[0.05]'
                        : 'border-white/[0.07] bg-white/[0.04]'
                }`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.cls}`}>
                  <Icon size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        m.kind === 'urgent' ? 'text-coral-300' : 'text-fog-100'
                      }`}
                    >
                      {m.author}
                    </span>
                    {m.kind === 'urgent' && (
                      <span className="rounded-sm bg-coral-500/25 px-1 font-mono text-[9px] font-bold tracking-wider text-coral-300">
                        紧急
                      </span>
                    )}
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-fog-500">
                      {fmtTime(m.ts)}
                    </span>
                  </div>
                  <p className="mt-0.5 break-words text-[13px] leading-5 text-fog-200">{m.text}</p>
                </div>
              </div>
            );
          })}
        </div>

        {!stick && (
          <button
            onClick={() => {
              const el = listRef.current;
              if (el) el.scrollTop = el.scrollHeight;
              setStick(true);
              onSeen();
            }}
            className="anim-pop absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-ember-400/40 bg-fog-950/80 px-3.5 py-1.5 text-[11px] font-medium text-ember-300 backdrop-blur transition hover:bg-fog-950 active:scale-95"
          >
            回到最新消息
          </button>
        )}
      </div>

      <footer className="border-t border-white/8 p-3.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="发送消息或指令，例如 /add 18:30 夜场巡更"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-fog-950/55 px-3.5 py-2.5 text-[13px] text-fog-50 placeholder:text-fog-500 transition focus:border-ember-400/50"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-ember-400 to-ember-600 text-fog-950 shadow-[0_8px_18px_-8px_rgba(245,168,60,0.8)] transition hover:brightness-110 active:scale-90 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="发送"
          >
            <IconSend size={16} />
          </button>
        </form>
        <p className="mt-2 px-1 font-mono text-[10px] leading-4 text-fog-500">
          指令：/add 时:分 标题 · /del 关键词 · /delay 分钟 · /notify 内容 · /help
        </p>
      </footer>
    </section>
  );
}
