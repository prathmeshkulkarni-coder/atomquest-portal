/**
 * BRD §2.3 — Quarterly windows (recurring each calendar year).
 * Months are 1–12. Admin / CYCLE_DEMO_MODE may bypass enforcement.
 */

export const WINDOWS = {
  GOAL_SETTING: {
    id: 'GOAL_SETTING',
    label: 'Goal Setting & Approval',
    description: 'Create, submit, and approve goal sheets',
    start: { month: 5, day: 1 },
    end: { month: 6, day: 30 },
  },
  Q1: {
    id: 'Q1',
    label: 'Q1 Check-in',
    description: 'July progress update — planned vs actual',
    quarter: 'Q1',
    start: { month: 7, day: 1 },
    end: { month: 7, day: 31 },
  },
  Q2: {
    id: 'Q2',
    label: 'Q2 Check-in',
    description: 'October progress update',
    quarter: 'Q2',
    start: { month: 10, day: 1 },
    end: { month: 10, day: 31 },
  },
  Q3: {
    id: 'Q3',
    label: 'Q3 Check-in',
    description: 'January progress update',
    quarter: 'Q3',
    start: { month: 1, day: 1 },
    end: { month: 1, day: 31 },
  },
  Q4: {
    id: 'Q4',
    label: 'Q4 / Annual Check-in',
    description: 'March–April final achievement capture',
    quarters: ['Q4', 'Annual'],
    start: { month: 3, day: 1 },
    end: { month: 4, day: 30 },
  },
};

const toDayOfYear = (month, day) => {
  const daysBefore = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return daysBefore[month - 1] + day;
};

const isInRange = (month, day, start, end) => {
  const current = toDayOfYear(month, day);
  const s = toDayOfYear(start.month, start.day);
  const e = toDayOfYear(end.month, end.day);
  if (s <= e) return current >= s && current <= e;
  return current >= s || current <= e;
};

export const isGoalSettingOpen = (date = new Date()) =>
  isInRange(date.getMonth() + 1, date.getDate(), WINDOWS.GOAL_SETTING.start, WINDOWS.GOAL_SETTING.end);

export const isQuarterCheckinOpen = (quarter, date = new Date()) => {
  const q = quarter === 'Annual' ? 'Q4' : quarter;
  const win = WINDOWS[q];
  if (!win) return false;
  return isInRange(date.getMonth() + 1, date.getDate(), win.start, win.end);
};

export const getWindowForQuarter = (quarter) => {
  if (quarter === 'Annual') return WINDOWS.Q4;
  return WINDOWS[quarter] || null;
};

export const buildCycleStatus = (date = new Date(), options = {}) => {
  const { enforcementEnabled = true, demoMode = false, bypass = false } = options;
  const effectiveBypass = bypass || demoMode || process.env.CYCLE_DEMO_MODE === 'true';

  const windows = Object.values(WINDOWS).map((w) => {
    let isOpen;
    if (w.id === 'GOAL_SETTING') isOpen = isGoalSettingOpen(date);
    else isOpen = isInRange(date.getMonth() + 1, date.getDate(), w.start, w.end);

    return {
      id: w.id,
      label: w.label,
      description: w.description,
      quarter: w.quarter || null,
      quarters: w.quarters || (w.quarter ? [w.quarter] : null),
      isOpen: effectiveBypass ? true : isOpen,
      period: formatPeriod(w),
    };
  });

  const openWindow = windows.find((w) => w.isOpen);

  return {
    enforcementEnabled,
    demoMode: demoMode || process.env.CYCLE_DEMO_MODE === 'true',
    bypass: effectiveBypass,
    currentDate: date.toISOString().split('T')[0],
    windows,
    activePhase: openWindow?.id || null,
    activeLabel: openWindow?.label || 'Outside scheduled windows',
  };
};

export const formatPeriod = (w) => {
  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const start = `${monthNames[w.start.month]} ${w.start.day}`;
  const end = `${monthNames[w.end.month]} ${w.end.day}`;
  return `${start} – ${end}`;
};

export const assertGoalSettingWindow = (date, options) => {
  if (options?.bypass) return { allowed: true };
  if (!options?.enforcementEnabled) return { allowed: true };
  if (isGoalSettingOpen(date)) return { allowed: true };
  return {
    allowed: false,
    message: `Goal sheet changes are only allowed during the Goal Setting window (${formatPeriod(WINDOWS.GOAL_SETTING)}).`,
  };
};

export const assertCheckinWindow = (quarter, date, options) => {
  if (options?.bypass) return { allowed: true };
  if (!options?.enforcementEnabled) return { allowed: true };
  if (isQuarterCheckinOpen(quarter, date)) return { allowed: true };
  const win = getWindowForQuarter(quarter);
  return {
    allowed: false,
    message: `${quarter} check-ins are only allowed during ${win?.label || quarter} (${win ? formatPeriod(win) : 'scheduled window'}).`,
  };
};
