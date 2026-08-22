import type { BusMsg, DeskMessage, ScheduleItem } from './types';
import { uid } from './types';
import * as db from './db';
import {
  ACK_POOL,
  ADJUST_POOL,
  STREAM_POOL,
  ZONES,
  buildSeedMessages,
  buildSeedSchedules,
} from './seed';

export interface ServiceHandlers {
  onSchedules: (items: ScheduleItem[]) => void;
  onLiveMessage: (m: DeskMessage) => void;
  onHistory: (items: DeskMessage[], hasMore: boolean) => void;
  onPeers: (n: number) => void;
  onLeader: (isLeader: boolean) => void;
  onAdjustNotice: (text: string) => void;
  onNotifyCommand: (text: string) => void;
}

const CHANNEL = 'liuli-dispatch-bus-v1';
const PAGE_SIZE = 40;
const MSG_CAP = 400;
const PEERS_KEY = 'liuli-peers-v1';
const LEADER_KEY = 'liuli-leader-v1';

const fill = (text: string) =>
  text
    .replace('{zone}', ZONES[Math.floor(Math.random() * ZONES.length)])
    .replace('{n}', String(8 + Math.floor(Math.random() * 90)));

export class DispatchService {
  readonly tabId = uid();
  private handlers: ServiceHandlers;
  private bus: BroadcastChannel | null = null;
  private schedules: ScheduleItem[] = [];
  private timers: number[] = [];
  private isLeader = false;
  private streamIdx = Math.floor(Math.random() * STREAM_POOL.length);
  private adjustIdx = 0;
  private lastPeerCount = -1;
  private pingResolvers = new Map<string, () => void>();
  private disposed = false;

  constructor(handlers: ServiceHandlers) {
    this.handlers = handlers;
  }

  /* ================= 启动 ================= */

  async init(): Promise<void> {
    let items = await db.dbGetAllSchedules();
    if (items.length === 0) {
      const seeded = buildSeedSchedules();
      await db.dbPutSchedules(seeded);
      items = seeded;
    }
    this.schedules = [...items].sort((a, b) => a.order - b.order);
    this.handlers.onSchedules([...this.schedules]);

    const count = await db.dbCountMessages();
    if (count === 0) {
      for (const m of buildSeedMessages()) {
        await db.dbAddMessage({ kind: m.kind, author: m.author, text: m.text, ts: m.ts });
      }
    }
    await this.loadHistory();

    this.bus = new BroadcastChannel(CHANNEL);
    this.bus.onmessage = (e: MessageEvent<BusMsg>) => this.onBus(e.data);

    this.heartbeat();
    this.timers.push(window.setInterval(() => this.heartbeat(), 2000));
    this.scheduleStream();
    this.timers.push(window.setInterval(() => this.adjustTick(), 50_000));
  }

  dispose(): void {
    this.disposed = true;
    this.timers.forEach((t) => {
      window.clearTimeout(t);
      window.clearInterval(t);
    });
    try {
      const peers = this.readPeers();
      delete peers[this.tabId];
      localStorage.setItem(PEERS_KEY, JSON.stringify(peers));
    } catch {
      /* noop */
    }
    this.bus?.close();
    this.bus = null;
  }

  /* ================= 历史与分页 ================= */

  async loadHistory(): Promise<void> {
    const items = await db.dbGetMessages(PAGE_SIZE);
    const total = await db.dbCountMessages();
    this.handlers.onHistory(items, total > items.length);
  }

  async loadOlder(currentOldestId: number): Promise<{ items: DeskMessage[]; hasMore: boolean }> {
    const items = await db.dbGetMessages(PAGE_SIZE, currentOldestId);
    const older = items.length > 0 ? await db.dbGetMessages(1, items[0].id) : [];
    return { items, hasMore: older.length > 0 };
  }

  /* ================= 日程操作 ================= */

  getSchedules(): ScheduleItem[] {
    return [...this.schedules];
  }

  async upsertSchedule(item: ScheduleItem): Promise<void> {
    if (!this.schedules.some((s) => s.id === item.id)) {
      item = { ...item, order: this.schedules.length };
    }
    await db.dbPutSchedule(item);
    this.applyLocal({ kind: 'put', item });
    this.broadcast({ type: 'op', op: { kind: 'put', item } });
  }

  async removeSchedule(id: string): Promise<void> {
    await db.dbDeleteSchedule(id);
    this.applyLocal({ kind: 'del', id });
    this.broadcast({ type: 'op', op: { kind: 'del', id } });
  }

  async reorderSchedules(ids: string[]): Promise<void> {
    await db.dbSetOrders(ids);
    this.applyLocal({ kind: 'reorder', ids });
    this.broadcast({ type: 'op', op: { kind: 'reorder', ids } });
  }

  async markNotified(id: string): Promise<void> {
    const item = this.schedules.find((s) => s.id === id);
    if (!item) return;
    const next = { ...item, notified: true };
    await db.dbPutSchedule(next);
    this.applyLocal({ kind: 'put', item: next });
    this.broadcast({ type: 'op', op: { kind: 'put', item: next } });
  }

  /* ================= 消息与指令 ================= */

  private async push(m: Omit<DeskMessage, 'id'>): Promise<DeskMessage> {
    const stored = await db.dbAddMessage({ ...m, ts: m.ts || Date.now() });
    this.handlers.onLiveMessage(stored);
    this.broadcast({ type: 'msg', msg: stored });
    if (this.isLeader) {
      db.dbPruneMessages(MSG_CAP).catch(() => undefined);
    }
    return stored;
  }

  async sendMessage(raw: string): Promise<void> {
    const text = raw.trim();
    if (!text) return;
    await this.push({ kind: 'out', author: '值班台', text, ts: Date.now() });
    window.setTimeout(() => this.route(text), 420 + Math.random() * 380);
  }

  private async route(raw: string): Promise<void> {
    if (!raw.startsWith('/')) {
      await this.push({
        kind: 'ack',
        author: '后台服务',
        text: ACK_POOL[Math.floor(Math.random() * ACK_POOL.length)],
        ts: Date.now(),
      });
      return;
    }
    const parts = raw.slice(1).trim().split(/\s+/);
    const cmd = (parts[0] ?? '').toLowerCase();
    const rest = parts.slice(1);

    if (cmd === 'help') {
      await this.push({
        kind: 'ack',
        author: '后台服务',
        text: '可用指令：/add 时:分 标题（新增日程） · /del 关键词（删除日程） · /delay 分钟数（顺延未完成日程） · /notify 内容（发送系统通知）',
        ts: Date.now(),
      });
      return;
    }

    if (cmd === 'add') {
      const m = /^(\d{1,2}):(\d{2})$/.exec(rest[0] ?? '');
      const title = rest.slice(1).join(' ');
      if (!m || !title) {
        await this.push({ kind: 'err', author: '后台服务', text: '格式有误，示例：/add 18:30 夜场巡更', ts: Date.now() });
        return;
      }
      const d = new Date();
      d.setHours(Number(m[1]), Number(m[2]), 0, 0);
      const item: ScheduleItem = {
        id: `cmd-${uid()}`,
        title,
        time: d.getTime(),
        tag: 'service',
        location: '值班台指派',
        notify: true,
        done: false,
        order: this.schedules.length,
      };
      await this.upsertSchedule(item);
      await this.push({ kind: 'ack', author: '后台服务', text: `已新增日程「${title}」（${m[1].padStart(2, '0')}:${m[2]}），并已同步至全部窗口。`, ts: Date.now() });
      return;
    }

    if (cmd === 'del') {
      const kw = rest.join(' ');
      const target = this.schedules.find((s) => !s.done && s.title.includes(kw));
      if (!kw || !target) {
        await this.push({ kind: 'err', author: '后台服务', text: `未找到与「${kw || '空关键词'}」匹配的未完成日程。`, ts: Date.now() });
        return;
      }
      await this.removeSchedule(target.id);
      await this.push({ kind: 'ack', author: '后台服务', text: `已删除日程「${target.title}」，变更已实时同步。`, ts: Date.now() });
      return;
    }

    if (cmd === 'delay') {
      const n = Number(rest[0]);
      if (!Number.isFinite(n) || n <= 0) {
        await this.push({ kind: 'err', author: '后台服务', text: '格式有误，示例：/delay 15（顺延 15 分钟）', ts: Date.now() });
        return;
      }
      const nowMs = Date.now();
      const pending = this.schedules.filter((s) => !s.done && s.time >= nowMs);
      for (const s of pending) {
        await this.upsertSchedule({ ...s, time: s.time + n * 60_000, notified: false });
      }
      await this.push({ kind: 'ack', author: '后台服务', text: `已将 ${pending.length} 项未完成日程顺延 ${n} 分钟。`, ts: Date.now() });
      return;
    }

    if (cmd === 'notify') {
      const text = rest.join(' ') || '后台服务发起的测试通知';
      this.handlers.onNotifyCommand(text);
      await this.push({ kind: 'ack', author: '后台服务', text: '通知指令已下发，系统通知已触发。', ts: Date.now() });
      return;
    }

    await this.push({ kind: 'err', author: '后台服务', text: `未识别指令「/${cmd}」，输入 /help 查看支持的指令。`, ts: Date.now() });
  }

  /* ================= 模拟后台推送 ================= */

  private scheduleStream(): void {
    const delay = 9_000 + Math.random() * 6_500;
    this.timers.push(
      window.setTimeout(() => {
        this.streamTick();
        if (!this.disposed) this.scheduleStream();
      }, delay)
    );
  }

  private streamTick(): void {
    if (!this.isLeader || this.disposed) return;
    const row = STREAM_POOL[this.streamIdx % STREAM_POOL.length];
    this.streamIdx += 1;
    void this.push({ kind: row.kind, author: row.author, text: fill(row.text), ts: Date.now() });
  }

  /** 后台服务实时调整日程表：新增 / 顺延 */
  private adjustTick(): void {
    if (!this.isLeader || this.disposed) return;
    const pending = this.schedules.filter((s) => !s.done && s.time > Date.now());

    if (this.schedules.length < 13) {
      const row = ADJUST_POOL[this.adjustIdx % ADJUST_POOL.length];
      this.adjustIdx += 1;
      const item: ScheduleItem = {
        id: `svr-${uid()}`,
        title: row.title,
        time: Date.now() + (40 + Math.floor(Math.random() * 70)) * 60_000,
        tag: row.tag,
        location: row.location,
        notify: row.notify,
        done: false,
        order: this.schedules.length,
      };
      void this.upsertSchedule(item);
      const text = `后台服务新增日程「${item.title}」，已同步至日程表。`;
      void this.push({ kind: 'sys', author: '后台服务', text, ts: Date.now() });
      this.handlers.onAdjustNotice(text);
      return;
    }

    if (pending.length === 0) return;
    const target = [...pending].sort((a, b) => a.time - b.time)[0];
    const next = { ...target, time: target.time + 15 * 60_000, notified: false };
    void this.upsertSchedule(next);
    const text = `后台服务将「${target.title}」顺延 15 分钟，日程表已实时更新。`;
    void this.push({ kind: 'sys', author: '后台服务', text, ts: Date.now() });
    this.handlers.onAdjustNotice(text);
  }

  /* ================= 实时通道（多窗口） ================= */

  private broadcast(msg: BusMsg): void {
    try {
      this.bus?.postMessage(msg);
    } catch {
      /* channel closed */
    }
  }

  private onBus(data: BusMsg): void {
    if (!data || this.disposed) return;
    if (data.type === 'op') {
      this.applyLocal(data.op);
      return;
    }
    if (data.type === 'msg') {
      this.handlers.onLiveMessage(data.msg);
      return;
    }
    if (data.type === 'ping') {
      this.broadcast({ type: 'pong', to: data.from });
      return;
    }
    if (data.type === 'pong') {
      const resolve = this.pingResolvers.get(data.to);
      if (resolve) {
        resolve();
        this.pingResolvers.delete(data.to);
      }
    }
  }

  private applyLocal(
    op:
      | { kind: 'put'; item: ScheduleItem }
      | { kind: 'del'; id: string }
      | { kind: 'reorder'; ids: string[] }
  ): void {
    if (op.kind === 'put') {
      const exists = this.schedules.some((s) => s.id === op.item.id);
      this.schedules = exists
        ? this.schedules.map((s) => (s.id === op.item.id ? op.item : s))
        : [...this.schedules, op.item];
    } else if (op.kind === 'del') {
      this.schedules = this.schedules.filter((s) => s.id !== op.id);
    } else {
      const orderMap = new Map(op.ids.map((id, i) => [id, i]));
      this.schedules = this.schedules.map((s) =>
        orderMap.has(s.id) ? { ...s, order: orderMap.get(s.id) as number } : s
      );
    }
    this.schedules.sort((a, b) => a.order - b.order);
    this.handlers.onSchedules([...this.schedules]);
  }

  /** 向其他窗口发送心跳包并等待回执 */
  ping(timeout = 1400): Promise<'ok' | 'solo'> {
    return new Promise((resolve) => {
      const id = uid();
      const timer = window.setTimeout(() => {
        this.pingResolvers.delete(id);
        resolve('solo');
      }, timeout);
      this.pingResolvers.set(id, () => {
        window.clearTimeout(timer);
        resolve('ok');
      });
      this.broadcast({ type: 'ping', from: id });
    });
  }

  channelOpen(): boolean {
    return this.bus !== null && !this.disposed;
  }

  leader(): boolean {
    return this.isLeader;
  }

  /* ================= 心跳 / 领导者选举 ================= */

  private readPeers(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(PEERS_KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  private heartbeat(): void {
    const now = Date.now();
    try {
      const peers = this.readPeers();
      peers[this.tabId] = now;
      for (const k of Object.keys(peers)) {
        if (now - peers[k] > 7_000) delete peers[k];
      }
      localStorage.setItem(PEERS_KEY, JSON.stringify(peers));
      const n = Object.keys(peers).length;
      if (n !== this.lastPeerCount) {
        this.lastPeerCount = n;
        this.handlers.onPeers(n);
      }
    } catch {
      /* storage unavailable */
    }

    try {
      const raw = localStorage.getItem(LEADER_KEY);
      const cur = raw ? (JSON.parse(raw) as { id: string; ts: number }) : null;
      const stale = !cur || now - cur.ts > 6_000 || cur.id === this.tabId;
      if (stale) {
        localStorage.setItem(LEADER_KEY, JSON.stringify({ id: this.tabId, ts: now }));
      }
      const next = localStorage.getItem(LEADER_KEY);
      const leaderId = next ? (JSON.parse(next) as { id: string }).id : this.tabId;
      const isLeader = leaderId === this.tabId;
      if (isLeader !== this.isLeader) {
        this.isLeader = isLeader;
        this.handlers.onLeader(isLeader);
      }
    } catch {
      this.isLeader = true;
    }
  }
}
