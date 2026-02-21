export const LOCATION_STATUS_ICON_OPTIONS = [
  { value: 'fa-solid fa-location-dot', label: '位置点（默认）' },
  { value: 'fa-solid fa-map-pin', label: '图钉' },
  { value: 'fa-solid fa-compass', label: '指南针' },
  { value: 'fa-solid fa-map', label: '地图' },
  { value: 'fa-solid fa-route', label: '路线' },
  { value: 'fa-solid fa-signs-post', label: '路牌' },
  { value: 'fa-solid fa-location-crosshairs', label: '定位准星' },
  { value: 'fa-solid fa-earth-asia', label: '地球' },
  { value: 'fa-solid fa-city', label: '城市' },
  { value: 'fa-solid fa-building', label: '建筑' },
  { value: 'fa-solid fa-house', label: '房屋' },
  { value: 'fa-solid fa-landmark', label: '地标' },
  { value: 'fa-solid fa-road', label: '道路' },
  { value: 'fa-solid fa-mountain', label: '山地' },
  { value: 'fa-solid fa-tree', label: '森林' },
  { value: 'fa-solid fa-campground', label: '营地' },
  { value: 'fa-solid fa-plane', label: '机场' },
  { value: 'fa-solid fa-ship', label: '港口' },
  { value: 'fa-solid fa-train-subway', label: '车站' },
  { value: 'fa-solid fa-car-side', label: '道路交通' },
  { value: 'fa-solid fa-water', label: '水域' },
  { value: 'fa-solid fa-store', label: '店铺' },
  { value: 'fa-solid fa-school', label: '学校' },
  { value: 'fa-solid fa-hospital', label: '医院' },
];

export const TIME_STATUS_ICON_OPTIONS = [
  { value: 'fa-regular fa-clock', label: '时钟（默认）' },
  { value: 'fa-solid fa-clock', label: '实心时钟' },
  { value: 'fa-solid fa-hourglass-half', label: '沙漏' },
  { value: 'fa-solid fa-calendar-days', label: '日历' },
  { value: 'fa-solid fa-sun', label: '太阳' },
  { value: 'fa-solid fa-moon', label: '月亮' },
  { value: 'fa-solid fa-cloud-sun', label: '白天天气' },
  { value: 'fa-solid fa-cloud-moon', label: '夜间天气' },
  { value: 'fa-solid fa-stopwatch', label: '秒表' },
  { value: 'fa-solid fa-business-time', label: '事务时间' },
  { value: 'fa-solid fa-calendar-day', label: '当日' },
  { value: 'fa-solid fa-calendar-week', label: '周历' },
  { value: 'fa-solid fa-calendar-check', label: '日程' },
  { value: 'fa-solid fa-hourglass-start', label: '开始' },
  { value: 'fa-solid fa-hourglass-end', label: '结束' },
  { value: 'fa-solid fa-bell', label: '提醒' },
  { value: 'fa-solid fa-star', label: '特殊时刻' },
  { value: 'fa-solid fa-fire', label: '紧迫' },
  { value: 'fa-solid fa-snowflake', label: '寒冬' },
  { value: 'fa-solid fa-cloud-rain', label: '雨天' },
  { value: 'fa-solid fa-meteor', label: '事件' },
  { value: 'fa-solid fa-bolt', label: '瞬时' },
  { value: 'fa-solid fa-clock-rotate-left', label: '回溯' },
  { value: 'fa-solid fa-forward', label: '推进' },
];

const LOCATION_STATUS_ICON_VALUES = LOCATION_STATUS_ICON_OPTIONS.map(option => option.value);
const TIME_STATUS_ICON_VALUES = TIME_STATUS_ICON_OPTIONS.map(option => option.value);

export const DEFAULT_LOCATION_STATUS_ICON_CLASS = LOCATION_STATUS_ICON_VALUES[0];
export const DEFAULT_TIME_STATUS_ICON_CLASS = TIME_STATUS_ICON_VALUES[0];

const LOCATION_STATUS_ICON_SET = new Set(LOCATION_STATUS_ICON_VALUES);
const TIME_STATUS_ICON_SET = new Set(TIME_STATUS_ICON_VALUES);

function normalizeStatusIconClass(value, allowedSet, fallbackValue) {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return fallbackValue;
  if (!allowedSet.has(normalized)) return fallbackValue;
  return normalized;
}

export function normalizeLocationStatusIconClass(value) {
  return normalizeStatusIconClass(value, LOCATION_STATUS_ICON_SET, DEFAULT_LOCATION_STATUS_ICON_CLASS);
}

export function normalizeTimeStatusIconClass(value) {
  return normalizeStatusIconClass(value, TIME_STATUS_ICON_SET, DEFAULT_TIME_STATUS_ICON_CLASS);
}
