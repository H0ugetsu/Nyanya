import {
  DEFAULT_TIMER_STATE,
  TIMER_STORAGE_KEY,
  type TimerMessage,
  type TimerState,
} from "../shared/types";

const PHASE_ALARM_NAME = "nyanya-phase-end";
const BADGE_ALARM_NAME = "nyanya-badge-tick";

const BADGE_COLOR_WORK = "#E63946";
const BADGE_COLOR_BREAK = "#2A9D8F";

async function getState(): Promise<TimerState> {
  const result = await chrome.storage.local.get(TIMER_STORAGE_KEY);
  return (result[TIMER_STORAGE_KEY] as TimerState | undefined) ?? DEFAULT_TIMER_STATE;
}

async function setState(state: TimerState): Promise<void> {
  await chrome.storage.local.set({ [TIMER_STORAGE_KEY]: state });
}

async function updateBadge(state: TimerState): Promise<void> {
  if (state.phase === "idle" || state.endTimestamp === null) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  const remainingMinutes = Math.max(0, Math.ceil((state.endTimestamp - Date.now()) / 60000));
  await chrome.action.setBadgeText({ text: String(remainingMinutes) });
  await chrome.action.setBadgeBackgroundColor({
    color: state.phase === "work" ? BADGE_COLOR_WORK : BADGE_COLOR_BREAK,
  });
}

async function startWork(workMinutes: number, breakMinutes: number): Promise<void> {
  const endTimestamp = Date.now() + workMinutes * 60 * 1000;
  const state: TimerState = { phase: "work", workMinutes, breakMinutes, endTimestamp };
  await setState(state);
  chrome.alarms.create(PHASE_ALARM_NAME, { when: endTimestamp });
  chrome.alarms.create(BADGE_ALARM_NAME, { periodInMinutes: 1 });
  await updateBadge(state);
}

chrome.runtime.onMessage.addListener((message: TimerMessage, _sender, sendResponse) => {
  if (message.type === "START") {
    startWork(message.workMinutes, message.breakMinutes).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === BADGE_ALARM_NAME) {
    await updateBadge(await getState());
    return;
  }

  if (alarm.name !== PHASE_ALARM_NAME) return;

  const state = await getState();

  if (state.phase === "work") {
    const endTimestamp = Date.now() + state.breakMinutes * 60 * 1000;
    const nextState: TimerState = { ...state, phase: "break", endTimestamp };
    await setState(nextState);
    chrome.alarms.create(PHASE_ALARM_NAME, { when: endTimestamp });
    await updateBadge(nextState);
    return;
  }

  if (state.phase === "break") {
    const nextState: TimerState = { ...state, phase: "idle", endTimestamp: null };
    await setState(nextState);
    chrome.alarms.clear(BADGE_ALARM_NAME);
    await updateBadge(nextState);
  }
});

async function restoreBadgeOnWake(): Promise<void> {
  await updateBadge(await getState());
}

chrome.runtime.onStartup.addListener(restoreBadgeOnWake);
chrome.runtime.onInstalled.addListener(restoreBadgeOnWake);
