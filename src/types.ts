export type Tag = 'patrol' | 'engineer' | 'marketing' | 'service' | 'security';

export interface ScheduleItem {
  id: string;
  title: string;
  /** epoch ms */
  time: number;
  tag: Tag;
  location: string;
  notify: boolean;
  done: boolean;
  notified?: boolean;
  order: number;
}

export type MsgKind = 'in' | 'out' | 'sys' | 'urgent' | 'ack' | 'err';

export interface DeskMessage {
  id: number;
  kind: MsgKind;
  author: string;
  text: string;
  ts: number;
}

export type BusMsg =
  | {
      type: 'op';
      op:
        | { kind: 'put'; item: ScheduleItem }
        | { kind: 'del'; id: string }
        | { kind: 'reorder'; ids: string[] };
    }
  | { type: 'msg'; msg: DeskMessage }
  | { type: 'ping'; from: string }
  | { type: 'pong'; to: string };

export interface ToastItem {
  id: string;
  kind: 'info' | 'success' | 'warn' | 'ember';
  title: string;
  text?: string;
}

export interface TestResult {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
  ms?: number;
}

export const TAG_LIST: Tag[] = ['patrol', 'engineer', 'marketing', 'service', 'security'];

export const TAG_META: Record<Tag, { label: string; pill: string; dot: string }> = {
  patrol: {
    label: '巡防',
    pill: 'text-jade-300 bg-jade-500/12 border-jade-400/30',
    dot: 'bg-jade-400',
  },
  engineer: {
    label: '工程',
    pill: 'text-skyx-300 bg-skyx-500/12 border-skyx-400/30',
    dot: 'bg-skyx-400',
  },
  marketing: {
    label: '营销',
    pill: 'text-ember-300 bg-ember-500/12 border-ember-400/30',
    dot: 'bg-ember-400',
  },
  service: {
    label: '客服',
    pill: 'text-lime-300 bg-lime-400/12 border-lime-400/30',
    dot: 'bg-lime-400',
  },
  security: {
    label: '安保',
    pill: 'text-coral-300 bg-coral-500/12 border-coral-400/30',
    dot: 'bg-coral-400',
  },
};

export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const pad = (n: number) => String(n).padStart(2, '0');

export const fmtTime = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fmtClock = (ms: number) => {
  const d = new Date(ms);
  return { hm: `${pad(d.getHours())}:${pad(d.getMinutes())}`, s: pad(d.getSeconds()) };
};

export const dateCN = (ms: number) => {
  const d = new Date(ms);
  const weeks = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 · 周${weeks[d.getDay()]}`;
};

export const fmtAgo = (ts: number) => {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  const d = new Date(ts);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const countdown = (target: number, now: number) => {
  const diff = target - now;
  if (diff <= 0) return '已过时';
  const m = Math.round(diff / 60_000);
  if (m < 60) return `${m} 分钟后`;
  return `${Math.floor(m / 60)} 小时 ${pad(m % 60)} 分后`;
};
