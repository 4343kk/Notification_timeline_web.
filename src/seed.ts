import type { DeskMessage, MsgKind, ScheduleItem, Tag } from './types';

const at = (mins: number) => Date.now() + mins * 60_000;

/** 今日日程种子：相对当前时间分布，保证任何时刻打开都有"进行中"的现场感 */
export function buildSeedSchedules(): ScheduleItem[] {
  const rows: [number, string, Tag, string, boolean][] = [
    [-165, '开店联合巡检 · 消防卷帘测试', 'security', '1F 中庭', false],
    [-100, '中庭美陈灯光复检', 'engineer', '1F-3F 中庭', false],
    [-35, '早高峰客流巡场', 'patrol', '全场动线', false],
    [25, '会员积分兑礼活动上线', 'marketing', 'B1 阳光广场', true],
    [85, '2 号扶梯例行维保', 'engineer', 'B 区 2F-3F', true],
    [150, '餐饮层燃气安全抽查', 'patrol', '4F 餐饮区', true],
    [230, '晚班交接例会', 'service', '3F 会议室', false],
    [330, '夜间灯光秀联调预检', 'engineer', '外立面灯控', true],
    [430, '闭店清场 · 安保布岗', 'security', '全场', false],
  ];
  return rows.map(([offset, title, tag, location, notify], i) => ({
    id: `seed-s${i + 1}`,
    title,
    time: at(offset),
    tag,
    location,
    notify,
    done: offset < 0,
    notified: offset < 0,
    order: i,
  }));
}

interface SeedRow {
  kind: MsgKind;
  author: string;
  text: string;
}

const SEED_ROWS: SeedRow[] = [
  { kind: 'sys', author: '后台服务', text: '调度通道已建立，今日排班表载入完成（9 项日程）。' },
  { kind: 'in', author: '安保 · 班一组', text: '1F 消防卷帘测试完成，3 处卷帘升降正常，记录已归档。' },
  { kind: 'in', author: '工程 · 老周', text: '中庭美陈灯带第 2 回路有轻微频闪，已更换驱动电源。' },
  { kind: 'urgent', author: '消控室', text: 'B2 车库 CO 浓度瞬时偏高，已启动排风机组，请巡防确认现场。' },
  { kind: 'in', author: '巡防 · 阿凯', text: 'B2 排风现场确认正常，浓度回落，建议列入今晚复查项。' },
  { kind: 'ack', author: '后台服务', text: '已将"B2 车库空气复查"加入待办建议队列。' },
  { kind: 'in', author: '客服前台', text: '9:30 开门后母婴室使用登记 4 次，耗材余量充足。' },
  { kind: 'in', author: '营销 · 策划组', text: '积分兑礼物料已到仓，11:00 前完成 B1 点位布置。' },
  { kind: 'sys', author: '后台服务', text: '日程提醒已开启：会员积分兑礼活动上线（到点推送系统通知）。' },
  { kind: 'in', author: '保洁 · 三号岗', text: '3F 卫生间高峰保洁完成，香氛机已补充。' },
  { kind: 'in', author: '工程 · 电梯班', text: '2 号扶梯维保工单已接单，预计 14:00 开始围挡作业。' },
  { kind: 'urgent', author: '物业经理', text: '接供电局通知：15:00-15:10 双回路切换演练，请各岗位留意照明瞬时切换。' },
  { kind: 'ack', author: '后台服务', text: '已向全部在线窗口广播演练提醒，日程表无需调整。' },
  { kind: 'in', author: '巡防 · 小宋', text: '4F 餐饮区午市排队较长，已临时开放备用等候区。' },
  { kind: 'in', author: '安保 · 门岗二', text: '外卖骑手通道核验 37 单，无异常。' },
  { kind: 'sys', author: '后台服务', text: '消息通道心跳正常，当前延迟 12ms。' },
  { kind: 'in', author: '客服前台', text: '拾获黑色雨伞一把，已登记至失物招领柜 C-03。' },
  { kind: 'in', author: '营销 · 策划组', text: '会员日活动主视觉已上刊，中庭大屏 10 分钟轮播。' },
  { kind: 'in', author: '工程 · 老周', text: '屋面排水沟巡检完成，无堵塞。' },
  { kind: 'err', author: '值班台', text: '指令 /move 未被识别，可用指令请输入 /help 查询。' },
  { kind: 'in', author: '巡防 · 阿凯', text: '2F 连廊玻璃幕墙清洁作业已设警戒带，预计 16:30 撤场。' },
  { kind: 'ack', author: '后台服务', text: '收到，已记录至调度日志。' },
  { kind: 'in', author: '消控室', text: '消防主机日检完成，0 报警 0 故障。' },
  { kind: 'in', author: '保洁 · 外围组', text: '外广场地面冲洗完成，积水已清理。' },
  { kind: 'sys', author: '后台服务', text: '历史消息已写入本地数据库，支持分页加载与容量裁剪。' },
];

export function buildSeedMessages(): DeskMessage[] {
  const now = Date.now();
  const total = SEED_ROWS.length;
  return SEED_ROWS.map((row, i) => ({
    id: undefined as unknown as number,
    kind: row.kind,
    author: row.author,
    text: row.text,
    ts: now - (total - i) * 4.6 * 60_000 - ((i * 37) % 40) * 1000,
  }));
}

export const ZONES = ['A 区', 'B 区', 'C 区', 'D 区', 'B1 层', '4F 餐饮区', '屋顶停车场', '外广场'];

export interface StreamRow {
  kind: MsgKind;
  author: string;
  text: string;
}

/** 后台服务持续推送的实时消息池（{zone} 会被随机替换） */
export const STREAM_POOL: StreamRow[] = [
  { kind: 'in', author: '巡防 · 阿凯', text: '{zone}巡更打点完成，通道畅通无异常。' },
  { kind: 'in', author: '工程 · 老周', text: '{zone}照明回路抽检正常，照度达标。' },
  { kind: 'urgent', author: '消控室', text: '{zone}烟感自检触发一次误报，已复位，请就近岗位确认现场。' },
  { kind: 'in', author: '客服前台', text: '服务台受理咨询 6 起，含会员积分查询 3 起。' },
  { kind: 'in', author: '安保 · 班二组', text: '{zone}非机动车停放区已整理，释放车位 12 个。' },
  { kind: 'ack', author: '后台服务', text: '本时段客流数据已同步：进场 {n} 人次，环比 +8%。' },
  { kind: 'in', author: '保洁 · 机动组', text: '{zone}地面循环保洁完成，垃圾桶清运 2 车。' },
  { kind: 'in', author: '营销 · 策划组', text: '整点抽奖参与 {n} 人，核销率 63%，物料余量充足。' },
  { kind: 'in', author: '工程 · 电梯班', text: '{zone}直梯困人演练完成，救援响应 4 分 20 秒。' },
  { kind: 'urgent', author: '物业经理', text: '{zone}发现儿童走失求助，请各门岗留意广播并回复确认。' },
  { kind: 'ack', author: '后台服务', text: '走失协查已广播至 {n} 个在线终端，等待回执。' },
  { kind: 'in', author: '巡防 · 小宋', text: '走失儿童已在服务台与家人会合，协查解除。' },
  { kind: 'in', author: '安保 · 监控岗', text: '{zone}监控画面轮巡完成，存储状态良好。' },
  { kind: 'sys', author: '后台服务', text: '数据库容量自检：消息表 {n} 条，索引健康。' },
  { kind: 'in', author: '客服前台', text: '商户报修 1 单：{zone}卷帘门遥控器失灵，已派工程。' },
  { kind: 'in', author: '工程 · 老周', text: '遥控器已更换电池并重新对码，商户确认恢复。' },
  { kind: 'in', author: '营销 · 策划组', text: '晚间灯光秀脚本 v3 已提交，待运营确认后下发灯控。' },
  { kind: 'in', author: '巡防 · 阿凯', text: '{zone}安全出口指示灯全部点亮，应急照明正常。' },
];

/** 后台服务实时新增/调整的日程池 */
export const ADJUST_POOL: { title: string; tag: Tag; location: string; notify: boolean }[] = [
  { title: '临时接驳车调度协调', tag: 'service', location: '北广场落客区', notify: true },
  { title: '冷链仓温度复核', tag: 'engineer', location: 'B2 冷链仓', notify: true },
  { title: '媒体探店接待动线确认', tag: 'marketing', location: '1F 东门', notify: false },
  { title: '夜巡布岗点位复核', tag: 'security', location: '全场周界', notify: true },
  { title: '客诉回访专项（3 单）', tag: 'service', location: '客服后台', notify: false },
  { title: '屋面广告牌紧固检查', tag: 'engineer', location: '屋面东侧', notify: false },
];

export const ACK_POOL = [
  '收到，已记录至调度日志。',
  '收到，值班长已知悉，无需调整排班。',
  '收到，已同步至巡防与安保终端。',
  '收到，相关信息已归档，可在消息库中检索。',
];
