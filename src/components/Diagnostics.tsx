import { useCallback, useEffect, useRef, useState } from 'react';
import type { TestResult } from '../types';
import * as db from '../db';
import type { DispatchService } from '../service';
import {
  IconAlert,
  IconBell,
  IconCheck,
  IconClipboard,
  IconInfo,
  IconSpinner,
  IconTarget,
  IconX,
} from '../icons';

export interface DiagCtx {
  service: DispatchService | null;
  schedulesCount: number;
  bgUrl: string;
  onTestNotification: () => Promise<'sent' | 'denied' | 'unsupported' | 'requested'>;
}

const timed = async (
  fn: () => Promise<{ status: TestResult['status']; detail: string }>
) => {
  const t0 = performance.now();
  const r = await fn();
  return { ...r, ms: Math.max(0, Math.round(performance.now() - t0)) };
};

/** 元素加载测试：可被启动自检与面板手动复用 */
export async function runElementTests(ctx: DiagCtx): Promise<TestResult[]> {
  const out: TestResult[] = [];

  try {
    const r = await timed(async () => {
      const [s, m] = await Promise.all([db.dbGetAllSchedules(), db.dbCountMessages()]);
      return s.length > 0
        ? { status: 'pass' as const, detail: `IndexedDB 已连接 · ${s.length} 项日程 / ${m} 条消息已入库` }
        : { status: 'warn' as const, detail: '数据库可连接，但日程表为空' };
    });
    out.push({ id: 'db', label: '数据库连接', ...r });
  } catch {
    out.push({ id: 'db', label: '数据库连接', status: 'fail', detail: 'IndexedDB 打开失败，请检查浏览器存储权限' });
  }

  if (ctx.service?.channelOpen()) {
    const r = await timed(async () => {
      const res = await ctx.service!.ping();
      return res === 'ok'
        ? { status: 'pass' as const, detail: '跨窗口心跳有响应，实时同步链路正常' }
        : { status: 'warn' as const, detail: '单窗口在线 · 通道就绪；再开一个窗口即可验证双向同步' };
    });
    out.push({ id: 'bus', label: '实时通信通道', ...r });
  } else {
    out.push({ id: 'bus', label: '实时通信通道', status: 'fail', detail: 'BroadcastChannel 未就绪' });
  }

  {
    const rendered = document.querySelectorAll('[data-tl-item]').length;
    const total = ctx.schedulesCount;
    out.push({
      id: 'tl',
      label: '日程元素加载',
      ms: 0,
      status:
        total === 0
          ? 'warn'
          : rendered === total
            ? 'pass'
            : 'fail',
      detail:
        total === 0
          ? '日程表为空，暂无可渲染卡片'
          : rendered === total
            ? `已渲染 ${rendered} 个日程卡片，与数据库一致`
            : `已渲染 ${rendered} 个 / 数据 ${total} 个，存在差异`,
    });
  }

  {
    const rendered = document.querySelectorAll('[data-msg-item]').length;
    out.push({
      id: 'msg',
      label: '消息列表加载',
      ms: 0,
      status: rendered > 0 ? 'pass' : 'fail',
      detail: rendered > 0 ? `消息流已渲染 ${rendered} 条可见消息` : '消息流未渲染出任何元素',
    });
  }

  try {
    const r = await timed(async () => {
      await document.fonts.ready;
      const serif = document.fonts.check('700 16px "Noto Serif SC"');
      const sans = document.fonts.check('16px "Noto Sans SC"');
      return serif && sans
        ? { status: 'pass' as const, detail: '展示字体（衬线）与正文字体均已加载' }
        : { status: 'warn' as const, detail: '部分网络字体未就绪，已启用系统回退字体' };
    });
    out.push({ id: 'font', label: '字体资源', ...r });
  } catch {
    out.push({ id: 'font', label: '字体资源', status: 'warn', detail: '字体检测接口不可用' });
  }

  {
    const r = await timed(
      () =>
        new Promise<{ status: TestResult['status']; detail: string }>((resolve) => {
          const img = new Image();
          const timer = window.setTimeout(() => {
            img.src = '';
            resolve({ status: 'warn', detail: '远程背景加载超时，已启用本地渐变兜底' });
          }, 3500);
          img.onload = () => {
            window.clearTimeout(timer);
            resolve({ status: 'pass', detail: `背景资源解码成功（${img.naturalWidth} × ${img.naturalHeight}）` });
          };
          img.onerror = () => {
            window.clearTimeout(timer);
            resolve({ status: 'warn', detail: '远程背景不可达，已启用本地渐变兜底' });
          };
          img.src = ctx.bgUrl;
        })
    );
    out.push({ id: 'bg', label: '背景资源', ...r });
  }

  {
    const supported = typeof window !== 'undefined' && 'Notification' in window;
    out.push({
      id: 'notif',
      label: '系统通知接口',
      status: supported ? 'pass' : 'warn',
      detail: supported
        ? `Web Notification 可用 · 当前权限：${Notification.permission === 'default' ? '未询问' : Notification.permission === 'granted' ? '已允许' : '已拒绝'}`
        : '当前环境不支持系统通知，将自动降级为应用内提醒',
    });
  }

  return out;
}

const StatusIcon = ({ s }: { s: TestResult['status'] }) =>
  s === 'pass' ? (
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-jade-500/15 text-jade-300">
      <IconCheck size={13} />
    </span>
  ) : s === 'fail' ? (
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-coral-500/15 text-coral-300">
      <IconX size={13} />
    </span>
  ) : (
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ember-500/15 text-ember-300">
      <IconInfo size={13} />
    </span>
  );

const NOTIF_TEXT: Record<'sent' | 'denied' | 'unsupported' | 'requested', string> = {
  sent: '已发送 Windows 系统通知，请查看屏幕右下角通知中心',
  requested: '权限已授予，测试通知已发送',
  denied: '权限被拒绝：点击地址栏左侧图标，允许本站通知后重试',
  unsupported: '当前环境不支持系统通知，已降级为应用内浮层提醒',
};

export function Diagnostics({
  ctx,
  onClose,
  onTestDone,
}: {
  ctx: DiagCtx;
  onClose: () => void;
  onTestDone: (r: TestResult[]) => void;
}) {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const [results, setResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [clicks, setClicks] = useState<number[]>([]);
  const [notifResult, setNotifResult] = useState<string | null>(null);
  const [notifBusy, setNotifBusy] = useState(false);
  const t0 = useRef(0);

  const run = useCallback(async () => {
    setRunning(true);
    const res = await runElementTests(ctxRef.current);
    setResults(res);
    onTestDone(res);
    setRunning(false);
  }, [onTestDone]);

  useEffect(() => {
    void run();
  }, [run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const failCount = results?.filter((r) => r.status === 'fail').length ?? 0;
  const warnCount = results?.filter((r) => r.status === 'warn').length ?? 0;
  const overall = !results
    ? null
    : failCount > 0
      ? { label: '存在异常', cls: 'border-coral-400/40 bg-coral-500/12 text-coral-300' }
      : warnCount > 0
        ? { label: '基本正常', cls: 'border-ember-400/40 bg-ember-500/12 text-ember-300' }
        : { label: '全部通过', cls: 'border-jade-400/40 bg-jade-500/12 text-jade-300' };

  const avg = clicks.length ? clicks.reduce((a, b) => a + b, 0) / clicks.length : 0;
  const clickVerdict =
    clicks.length < 5
      ? null
      : avg < 25
        ? { label: '响应极佳', cls: 'text-jade-300' }
        : avg < 70
          ? { label: '响应良好', cls: 'text-ember-300' }
          : { label: '响应偏慢', cls: 'text-coral-300' };

  const permLabel =
    'Notification' in window
      ? Notification.permission === 'default'
        ? '未询问'
        : Notification.permission === 'granted'
          ? '已允许'
          : '已拒绝'
      : '不支持';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-fog-950/65 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="anim-pop flex max-h-[88vh] w-full max-w-[600px] flex-col rounded-2xl glass-deep">
        <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-skyx-500/15 text-skyx-300">
            <IconClipboard size={17} />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold text-fog-50">现场自检面板</h3>
            <p className="text-[11px] text-fog-400">商场环境验收 · 元素加载 / 点击功能 / 通知机制</p>
          </div>
          {overall && (
            <span className={`ml-auto rounded-full border px-3 py-1 text-xs font-semibold ${overall.cls}`}>
              {overall.label}
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-fog-400 transition hover:bg-white/10 hover:text-fog-100"
            aria-label="关闭"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="scroll-slim min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* 元素加载测试 */}
          <section>
            <div className="mb-2.5 flex items-center gap-2">
              <h4 className="text-[13px] font-bold tracking-wide text-fog-100">元素加载测试</h4>
              <button
                onClick={() => void run()}
                disabled={running}
                className="ml-auto flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[11px] text-fog-300 transition hover:border-ember-400/40 hover:text-ember-300 active:scale-95 disabled:opacity-50"
              >
                {running ? <IconSpinner size={11} /> : null}
                {running ? '检测中' : '重新检测'}
              </button>
            </div>
            <div className="space-y-1.5">
              {(results ?? []).map((r) => (
                <div
                  key={r.id}
                  className="anim-rise flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5"
                >
                  <StatusIcon s={r.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-fog-100">{r.label}</p>
                    <p className="truncate text-xs text-fog-400">{r.detail}</p>
                  </div>
                  {typeof r.ms === 'number' && r.ms > 0 && (
                    <span className="shrink-0 font-mono text-[10px] text-fog-500">{r.ms}ms</span>
                  )}
                </div>
              ))}
              {!results && (
                <div className="flex items-center justify-center gap-2 py-6 text-fog-400">
                  <IconSpinner size={15} />
                  <span className="text-xs">正在逐项检测…</span>
                </div>
              )}
            </div>
          </section>

          {/* 点击功能测试 */}
          <section>
            <h4 className="mb-2.5 text-[13px] font-bold tracking-wide text-fog-100">点击功能测试</h4>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4">
              <p className="mb-3 text-xs leading-5 text-fog-400">
                连续点击目标按钮 5 次，测量「按下 → 界面响应」的往返耗时，验证触控/鼠标链路。
              </p>
              <div className="flex items-center gap-4">
                <button
                  onPointerDown={() => (t0.current = performance.now())}
                  onClick={() => {
                    const dt = performance.now() - t0.current;
                    setClicks((prev) => (prev.length >= 5 ? [dt] : [...prev, dt]));
                  }}
                  className="group relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-ember-400/40 bg-gradient-to-b from-ember-400/25 to-ember-600/20 text-ember-300 transition hover:border-ember-400/70 hover:from-ember-400/35 active:scale-90"
                  aria-label="点击测试目标"
                >
                  <IconTarget size={30} />
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-fog-950 px-1.5 font-mono text-[9px] text-ember-300">
                    {clicks.length}/5
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={`rounded-md border px-2 py-1 font-mono text-[10px] ${
                          clicks[i] !== undefined
                            ? 'border-jade-400/30 bg-jade-500/10 text-jade-300'
                            : 'border-white/10 bg-white/[0.03] text-fog-500'
                        }`}
                      >
                        {clicks[i] !== undefined ? `${clicks[i].toFixed(1)}ms` : '—'}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 text-xs">
                    {clickVerdict ? (
                      <>
                        <span className="text-fog-400">
                          平均 <span className="font-mono text-fog-100">{avg.toFixed(1)}ms</span>
                        </span>
                        <span className={`font-semibold ${clickVerdict.cls}`}>{clickVerdict.label}</span>
                      </>
                    ) : (
                      <span className="text-fog-500">
                        {clicks.length > 0 ? `已采样 ${clicks.length} 次，继续点击…` : '等待首次点击采样'}
                      </span>
                    )}
                    {clicks.length > 0 && (
                      <button
                        onClick={() => setClicks([])}
                        className="ml-auto rounded-full border border-white/12 px-2.5 py-0.5 text-[10px] text-fog-400 transition hover:text-fog-100"
                      >
                        重置
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 通知机制测试 */}
          <section>
            <h4 className="mb-2.5 text-[13px] font-bold tracking-wide text-fog-100">
              Windows 通知机制测试
            </h4>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] text-fog-300">
                  <IconBell size={12} />
                  通知权限：{permLabel}
                </span>
                <button
                  onClick={async () => {
                    setNotifBusy(true);
                    const r = await ctxRef.current.onTestNotification();
                    setNotifResult(NOTIF_TEXT[r]);
                    setNotifBusy(false);
                  }}
                  disabled={notifBusy}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-ember-400 to-ember-600 px-4 py-2 text-xs font-semibold text-fog-950 shadow-[0_8px_18px_-8px_rgba(245,168,60,0.8)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {notifBusy ? <IconSpinner size={12} /> : <IconBell size={12} />}
                  发送测试通知
                </button>
              </div>
              {notifResult && (
                <p className="anim-pop mt-3 flex items-start gap-2 rounded-lg border border-ember-400/25 bg-ember-500/10 px-3 py-2 text-xs leading-5 text-ember-200">
                  <IconAlert size={13} className="mt-0.5 shrink-0" />
                  {notifResult}
                </p>
              )}
              <p className="mt-3 text-[11px] leading-5 text-fog-500">
                在 Windows 上，通知将进入系统「通知中心」（屏幕右下角弹窗）；日程到点提醒与紧急调度均走该通道。
              </p>
            </div>
          </section>
        </div>

        <div className="border-t border-white/8 px-5 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/12 px-4 py-2 text-sm text-fog-200 transition hover:bg-white/8 active:scale-95"
          >
            完成验收
          </button>
        </div>
      </div>
    </div>
  );
}
