import {
  DEFAULT_TIMER_STATE,
  TIMER_STORAGE_KEY,
  type TimerMessage,
  type TimerState,
} from "../shared/types";

const ALARM_NAME = "nyanya-phase-end";

async function getState(): Promise<TimerState> {
  const result = await chrome.storage.local.get(TIMER_STORAGE_KEY);
  return (result[TIMER_STORAGE_KEY] as TimerState | undefined) ?? DEFAULT_TIMER_STATE;
}

async function setState(state: TimerState): Promise<void> {
  await chrome.storage.local.set({ [TIMER_STORAGE_KEY]: state });
}

async function startWork(workMinutes: number, breakMinutes: number): Promise<void> {
  const endTimestamp = Date.now() + workMinutes * 60 * 1000;
  await setState({ phase: "work", workMinutes, breakMinutes, endTimestamp });
  chrome.alarms.create(ALARM_NAME, { when: endTimestamp });
}

chrome.runtime.onMessage.addListener((message: TimerMessage, _sender, sendResponse) => {
  if (message.type === "START") {
    startWork(message.workMinutes, message.breakMinutes).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  const state = await getState();

  if (state.phase === "work") {
    const endTimestamp = Date.now() + state.breakMinutes * 60 * 1000;
    await setState({ ...state, phase: "break", endTimestamp });
    chrome.alarms.create(ALARM_NAME, { when: endTimestamp });
    return;
  }

  if (state.phase === "break") {
    await setState({ ...state, phase: "idle", endTimestamp: null });
  }
});
