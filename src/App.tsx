import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { DeskMessage, ScheduleItem, TestResult, ToastItem } from './types';
import { dateCN, fmtClock, fmtTime, uid } from './types';
import { DispatchService } from './service';
import * as db from './db';
import { Timeline } from './components/Timeline';
import { MessageDock } from './components/MessageDock';
import { EditorModal } from './components/EditorModal';
import type { EditorPayload } from './components/EditorModal';
import { Diagnostics, runElementTests } from './components/Diagnostics';
import type { DiagCtx } from './components/Diagnostics';
import { Toasts } from './components/Toasts';
import {
  IconBell,
  IconBellOff,
  IconCalendar,
  IconClipboard,
  IconAlert,
  IconLayers,
  IconLogo,
  IconPlus,
  IconRadio,
  IconSpinner,
  IconWindow,
} from './icons';

const BG_URL =
  'https://image.qwenlm.ai/generated-images/bf0cdbaf-a99d-44d6-a4f5-3325f12281ad/_result.png';

type BootState = 'loading' | 'ready' | 'error';
type NotifPerm = 'unsupported' | 'default' | 'granted' | 'denied';
type EditorState = { mode: 'new' } | { mode: 'edit'; item: ScheduleItem } | null;

function Backdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#0d1b1a_0%,#122220_38%,#0a1413_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(1100px_520px_at_82%_-8%,rgba(245,168,60,0.18),transparent_62%),radial-gradient(900px_480px_at_-8%_108%,rgba(47,196,174,0.15),transparent_60%)]" />
      <img
        src={BG_URL}
        alt=""
        draggable={false}
        className="h-full w-full object-cover opacity-60"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-fog-950/80 via-fog-950/58 to-fog-950/88" />
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
    </div>
  );
}

function RailBtn({
  icon,
  label,
  onClick,
  badge,
  badgeCls,
  title,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  badge?: boolean;
  badgeCls?: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title ?? label}
      className="group relative flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-xl text-fog-400 transition hover:bg-white/[0.07] hover:text-fog-100 active:scale-90"
    >
      {icon}
      <span className="text-[9px] leading-none">{label}</span>
      {badge && (
        <span
          className={`absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full ${badgeCls ?? 'bg-ember-400'}`}
        />
      )}
    </button>
  );
}

export default function App() {
  /* ---------------- 状态 ---------------- */
  const [boot, setBoot] = useState<BootState>('loading');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [messages, setMessages] = useState<DeskMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [peers, setPeers] = useState(1);
  const [isLeader, setIsLeader] = useState(false);
  const [perm, setPerm] = useState<NotifPerm>('unsupported');
  const [notifyOn, setNotifyOn] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [unread, setUnread] = useState(0);
  const [editor, setEditor] = useState<EditorState>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const [lastTest, setLastTest] = useState<TestResult[] | null>(null);

  const serviceRef = useRef<DispatchService | null>(null);
  const initedRef = useRef(false);
  const schedulesRef = useRef<ScheduleItem[]>([]);
  const permRef = useRef<NotifPerm>('unsupported');
  const notifyOnRef = useRef(true);
  const isLeaderRef = useRef(true);
  const dockInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    notifyOnRef.current = notifyOn;
  }, [notifyOn]);

  useEffect(() => {
    isLeaderRef.current = isLeader;
  }, [isLeader]);

  /* ---------------- 通知 ---------------- */

  const pushToast = useCallback(
    (kind: ToastItem['kind'], title: string, text?: string) => {
      const id = uid();
      setToasts((p) => [...p.slice(-3), { id, kind, title, text }]);
      window.setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
    },
    []
  );

  /** allowRequest 仅允许在用户手势链路中开启（如点击测试按钮），后台自动事件不主动弹授权 */
  const fireWindowsNotification = useCallback(
    async (
      title: string,
      body: string,
      allowRequest = false
    ): Promise<'sent' | 'denied' | 'unsupported' | 'requested'> => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        pushToast('warn', '系统通知不可用', '当前环境不支持 Web Notification 接口');
        return 'unsupported';
      }
      const spawn = () => {
        try {
          const n = new Notification(title, { body, tag: uid() });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {
          /* 某些环境构造失败时静默降级 */
        }
      };
      if (Notification.permission === 'granted') {
        spawn();
        return 'sent';
      }
      if (Notification.permission === 'denied') {
        pushToast('warn', '通知权限被拒绝', '点击地址栏左侧站点设置，允许通知后即可接收');
        return 'denied';
      }
      if (!allowRequest) {
        pushToast('info', '系统通知未开启', '点击左栏「通知」按钮授权后，日程提醒将进入 Windows 通知中心');
        return 'denied';
      }
      const p = await Notification.requestPermission();
      setPerm(p as NotifPerm);
      permRef.current = p as NotifPerm;
      if (p === 'granted') {
        spawn();
        return 'requested';
      }
      pushToast('warn', '未获得通知权限', '已自动降级为应用内浮层提醒');
      return 'denied';
    },
    [pushToast]
  );

  /* ---------------- 服务初始化 ---------------- */

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    if (typeof window !== 'undefined' && 'Notification' in window) {
      const p = Notification.permission as NotifPerm;
      setPerm(p);
      permRef.current = p;
    }

    const svc = new DispatchService({
      onSchedules: (items) => {
        schedulesRef.current = items;
        setSchedules(items);
      },
      onLiveMessage: (m) => {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.kind === 'in' || m.kind === 'urgent') setUnread((u) => u + 1);
        if (m.kind === 'urgent') {
          pushToast('warn', `紧急调度 · ${m.author}`, m.text);
          /* 仅主机窗口触发系统通知，避免多窗口重复弹窗 */
          if (isLeaderRef.current) void fireWindowsNotification(`紧急调度 · ${m.author}`, m.text);
        }
      },
      onHistory: (items, more) => {
        setMessages(items);
        setHasMore(more);
      },
      onPeers: setPeers,
      onLeader: setIsLeader,
      onAdjustNotice: (text) => pushToast('ember', '后台实时调整日程', text),
      onNotifyCommand: (text) => {
        void fireWindowsNotification('琉光调度台 · 后台通知', text);
        pushToast('ember', '收到后台通知指令', text);
      },
    });
    serviceRef.current = svc;

    svc
      .init()
      .then(async () => {
        setBoot('ready');
        try {
          const saved = await db.dbGetMeta<boolean>('notifyOn');
          if (typeof saved === 'boolean') {
            setNotifyOn(saved);
            notifyOnRef.current = saved;
          }
        } catch {
          /* 使用默认值 */
        }
      })
      .catch((err) => {
        console.error('服务初始化失败', err);
        setBoot('error');
      });
  }, [pushToast, fireWindowsNotification]);

  /* ---------------- 时钟 ---------------- */

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  /* ---------------- 日程到点提醒 ---------------- */

  useEffect(() => {
    if (boot !== 'ready') return;
    const tick = () => {
      const nowMs = Date.now();
      for (const s of schedulesRef.current) {
        if (
          s.notify &&
          !s.done &&
          !s.notified &&
          s.time - nowMs <= 60_000 &&
          s.time - nowMs > -120_000
        ) {
          void serviceRef.current?.markNotified(s.id);
          pushToast('ember', `日程提醒 · ${s.title}`, `${fmtTime(s.time)} · ${s.location}`);
          if (notifyOnRef.current && isLeaderRef.current) {
            void fireWindowsNotification(`日程提醒 · ${s.title}`, `${fmtTime(s.time)} · ${s.location}`);
          }
        }
      }
    };
    tick();
    const t = window.setInterval(tick, 10_000);
    return () => window.clearInterval(t);
  }, [boot, pushToast, fireWindowsNotification]);

  /* ---------------- 启动自检（元素加载测试） ---------------- */

  useEffect(() => {
    if (boot !== 'ready') return;
    const t = window.setTimeout(() => {
      void runElementTests({
        service: serviceRef.current,
        schedulesCount: schedulesRef.current.length,
        bgUrl: BG_URL,
        onTestNotification: async () => 'sent',
      }).then(setLastTest);
    }, 1400);
    return () => window.clearTimeout(t);
  }, [boot]);

  /* ---------------- 日程操作 ---------------- */

  const toggleDone = (id: string) => {
    const item = schedulesRef.current.find((s) => s.id === id);
    if (!item) return;
    void serviceRef.current?.upsertSchedule({ ...item, done: !item.done });
  };

  const deleteItem = (id: string) => {
    const item = schedulesRef.current.find((s) => s.id === id);
    void serviceRef.current?.removeSchedule(id);
    if (item) pushToast('info', '日程已删除', item.title);
  };

  const reorder = (ids: string[]) => {
    void serviceRef.current?.reorderSchedules(ids);
  };

  const saveEditor = (p: EditorPayload) => {
    const svc = serviceRef.current;
    if (!svc) return;
    if (editor?.mode === 'edit') {
      void svc.upsertSchedule({ ...editor.item, ...p, notified: false });
      pushToast('success', '日程已更新', `${p.title} · ${fmtTime(p.time)} — 已同步至所有窗口`);
    } else {
      void svc.upsertSchedule({
        id: `usr-${uid()}`,
        order: schedulesRef.current.length,
        done: false,
        ...p,
      });
      pushToast('success', '日程已创建', `${p.title} · ${fmtTime(p.time)} — 已同步至所有窗口`);
    }
    setEditor(null);
  };

  /* ---------------- 消息操作 ---------------- */

  const loadOlder = async () => {
    const svc = serviceRef.current;
    const oldest = messages[0];
    if (!svc || !oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const { items, hasMore: more } = await svc.loadOlder(oldest.id);
      setMessages((prev) => [...items.filter((m) => !prev.some((x) => x.id === m.id)), ...prev]);
      setHasMore(more);
    } catch {
      pushToast('warn', '加载失败', '读取历史消息时出错，请重试');
    }
    setLoadingMore(false);
  };

  /* ---------------- 通知权限 ---------------- */

  const onBellClick = async () => {
    const p = permRef.current;
    if (p === 'unsupported') {
      pushToast('warn', '系统通知不可用', '当前环境不支持 Web Notification 接口');
      return;
    }
    if (p === 'granted') {
      void fireWindowsNotification('琉光调度台', '通知机制自检：Windows 通知通道畅通');
      return;
    }
    if (p === 'denied') {
      pushToast('warn', '通知权限被拒绝', '点击地址栏左侧站点设置，允许通知后刷新页面');
      return;
    }
    const r = await Notification.requestPermission();
    setPerm(r as NotifPerm);
    permRef.current = r as NotifPerm;
    if (r === 'granted') {
      pushToast('success', '通知权限已开启', '日程到点将推送 Windows 系统通知');
      void fireWindowsNotification('琉光调度台', '通知已开启，这是一条确认通知');
    } else {
      pushToast('warn', '未获得通知权限', '仍会使用应用内浮层提醒');
    }
  };

  const toggleNotifyOn = () => {
    const nv = !notifyOn;
    setNotifyOn(nv);
    notifyOnRef.current = nv;
    void db.dbSetMeta('notifyOn', nv).catch(() => undefined);
    pushToast('info', nv ? '到点提醒已开启' : '到点提醒已暂停', nv ? '日程到点将推送系统通知' : '仅保留应用内浮层提醒');
  };

  /* ---------------- 派生 ---------------- */

  const clock = fmtClock(now);
  const testFailed = lastTest?.some((r) => r.status === 'fail') ?? false;
  const testWarn = lastTest?.some((r) => r.status === 'warn') ?? false;
  const diagBadgeCls = testFailed ? 'bg-coral-400' : testWarn ? 'bg-ember-400' : 'bg-jade-400';

  const diagCtx: DiagCtx = {
    service: serviceRef.current,
    schedulesCount: schedules.length,
    bgUrl: BG_URL,
    onTestNotification: () =>
      fireWindowsNotification('琉光调度台', '这是一条 Windows 通知测试，来自调度台自检面板', true),
  };

  /* ---------------- 渲染 ---------------- */

  return (
    <div className="relative flex h-screen w-full overflow-hidden font-body text-fog-100">
      <Backdrop />

      <div className="relative z-10 flex h-full w-full">
        {/* 左侧导航栏 */}
        <aside className="hidden w-[74px] shrink-0 flex-col items-center gap-1.5 border-r border-white/8 bg-fog-950/45 py-4 backdrop-blur-xl sm:flex">
          <IconLogo size={36} />
          <div className="my-2 h-px w-8 bg-white/10" />
          <RailBtn
            icon={<IconCalendar size={18} />}
            label="日程"
            onClick={() =>
              document.getElementById('panel-timeline')?.scrollIntoView({ behavior: 'smooth' })
            }
          />
          <RailBtn
            icon={<IconRadio size={18} />}
            label="消息"
            badge={unread > 0}
            onClick={() => {
              document.getElementById('panel-dock')?.scrollIntoView({ behavior: 'smooth' });
              window.setTimeout(() => dockInputRef.current?.focus(), 350);
            }}
          />
          <RailBtn
            icon={<IconClipboard size={18} />}
            label="诊断"
            badge={lastTest !== null}
            badgeCls={diagBadgeCls}
            title="打开现场自检面板"
            onClick={() => setDiagOpen(true)}
          />
          <div className="flex-1" />
          <div
            className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2 text-fog-300"
            title="通过实时通道互联的窗口数量（含本窗口）"
          >
            <IconWindow size={16} />
            <span className="font-mono text-[11px] font-semibold text-fog-100">{peers}</span>
            <span className="text-[8px] tracking-wider text-fog-500">窗口</span>
          </div>
          <RailBtn
            icon={
              perm === 'granted' ? (
                <IconBell size={18} className="text-jade-300" />
              ) : perm === 'denied' ? (
                <IconBellOff size={18} className="text-coral-300" />
              ) : (
                <IconBell size={18} className="text-ember-300" />
              )
            }
            label="通知"
            badge={perm === 'default'}
            title={
              perm === 'granted'
                ? '通知已开启 · 点击发送测试通知'
                : perm === 'denied'
                  ? '通知被拒绝 · 点击查看指引'
                  : '点击开启 Windows 系统通知'
            }
            onClick={() => void onBellClick()}
          />
        </aside>

        {/* 主区域 */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="hairline-b flex shrink-0 items-center gap-4 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5 sm:hidden">
              <IconLogo size={28} />
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="flex items-baseline gap-2.5">
                <h1 className="font-display text-xl font-black tracking-wide text-fog-50">
                  琉光调度台
                </h1>
                <span className="hidden font-mono text-[9px] tracking-[0.35em] text-fog-500 lg:inline">
                  LIULI OPS DESK
                </span>
              </div>
              <p className="truncate text-[11px] text-fog-400">
                商场运营 · 日程编排与实时通知中心
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2.5 sm:gap-3">
              <div className="hidden text-right md:block">
                <div className="font-mono text-[22px] font-semibold leading-6 text-fog-50">
                  {clock.hm}
                  <span className="text-sm text-ember-400">:{clock.s}</span>
                </div>
                <div className="text-[10px] text-fog-400">{dateCN(now)}</div>
              </div>
              <div className="hidden h-9 w-px bg-white/10 md:block" />

              <span
                className="flex items-center gap-1.5 rounded-full border border-jade-400/25 bg-jade-500/10 px-2.5 py-1.5 font-mono text-[10px] text-jade-300"
                title="后台服务实时通道状态"
              >
                <span className="dot-live h-1.5 w-1.5 rounded-full bg-jade-400" />
                <IconLayers size={11} />
                <span className="hidden sm:inline">实时通道</span> {peers} 窗口
              </span>

              <button
                onClick={toggleNotifyOn}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-mono text-[10px] transition active:scale-95 ${
                  notifyOn
                    ? 'border-ember-400/40 bg-ember-500/12 text-ember-300'
                    : 'border-white/12 bg-white/[0.05] text-fog-400 hover:text-fog-200'
                }`}
                title="开关日程到点的系统通知"
              >
                {notifyOn ? <IconBell size={12} /> : <IconBellOff size={12} />}
                {notifyOn ? '提醒开' : '提醒关'}
              </button>

              <button
                onClick={() => setEditor({ mode: 'new' })}
                className="hidden items-center gap-1.5 rounded-xl bg-gradient-to-b from-ember-400 to-ember-600 px-3.5 py-2 text-xs font-semibold text-fog-950 shadow-[0_8px_18px_-8px_rgba(245,168,60,0.8)] transition hover:brightness-110 active:scale-95 sm:flex"
              >
                <IconPlus size={13} /> 新建日程
              </button>
            </div>
          </header>

          <main className="scroll-slim flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_398px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
            <div id="panel-timeline" className="flex h-[560px] shrink-0 flex-col lg:h-auto lg:min-h-0">
              <Timeline
                schedules={schedules}
                now={now}
                onToggleDone={toggleDone}
                onEdit={(item) => setEditor({ mode: 'edit', item })}
                onDelete={deleteItem}
                onReorder={reorder}
                onCreate={() => setEditor({ mode: 'new' })}
              />
            </div>
            <div id="panel-dock" className="flex h-[560px] shrink-0 flex-col lg:min-h-0">
              <MessageDock
                messages={messages}
                hasMore={hasMore}
                loadingMore={loadingMore}
                unread={unread}
                peers={peers}
                isLeader={isLeader}
                channelReady={serviceRef.current?.channelOpen() ?? false}
                onSend={(t) => void serviceRef.current?.sendMessage(t)}
                onMore={() => void loadOlder()}
                onSeen={() => setUnread(0)}
                inputRef={dockInputRef as RefObject<HTMLInputElement>}
              />
            </div>
          </main>
        </div>
      </div>

      {/* 启动 / 错误态 */}
      {boot === 'loading' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-fog-950/55 backdrop-blur-md">
          <div className="anim-pop flex items-center gap-3.5 rounded-2xl glass-deep px-6 py-4">
            <IconSpinner size={22} className="text-ember-400" />
            <div>
              <p className="text-sm font-semibold text-fog-50">正在连接后台服务</p>
              <p className="mt-0.5 text-xs text-fog-400">初始化本地数据库与实时通道…</p>
            </div>
          </div>
        </div>
      )}
      {boot === 'error' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-fog-950/70 backdrop-blur-md">
          <div className="anim-pop flex w-[320px] flex-col items-center gap-3 rounded-2xl glass-deep px-6 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-coral-500/15 text-coral-300">
              <IconAlert size={22} />
            </span>
            <div>
              <p className="text-sm font-semibold text-fog-50">后台服务连接失败</p>
              <p className="mt-1 text-xs leading-5 text-fog-400">
                数据库或实时通道初始化异常，请检查浏览器存储权限后重试。
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-gradient-to-b from-ember-400 to-ember-600 px-5 py-2 text-xs font-semibold text-fog-950 transition hover:brightness-110 active:scale-95"
            >
              重新连接
            </button>
          </div>
        </div>
      )}

      <Toasts items={toasts} onClose={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      {editor && (
        <EditorModal
          initial={editor.mode === 'edit' ? editor.item : null}
          onSave={saveEditor}
          onClose={() => setEditor(null)}
        />
      )}

      {diagOpen && (
        <Diagnostics ctx={diagCtx} onClose={() => setDiagOpen(false)} onTestDone={setLastTest} />
      )}
    </div>
  );
}
