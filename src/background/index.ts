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
const BADGE_COLOR_PAUSED = "#6C757D";

async function getState(): Promise<TimerState> {
  const result = await chrome.storage.local.get(TIMER_STORAGE_KEY);
  return (result[TIMER_STORAGE_KEY] as TimerState | undefined) ?? DEFAULT_TIMER_STATE;
}

async function setState(state: TimerState): Promise<void> {
  await chrome.storage.local.set({ [TIMER_STORAGE_KEY]: state });
}

async function updateBadge(state: TimerState): Promise<void> {
  if (state.phase === "idle") {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  const remainingMs = state.isPaused
    ? (state.remainingMsAtPause ?? 0)
    : Math.max(0, (state.endTimestamp ?? Date.now()) - Date.now());
  const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));

  await chrome.action.setBadgeText({ text: String(remainingMinutes) });
  await chrome.action.setBadgeBackgroundColor({
    color: state.isPaused
      ? BADGE_COLOR_PAUSED
      : state.phase === "work"
        ? BADGE_COLOR_WORK
        : BADGE_COLOR_BREAK,
  });
}

async function ensureOffscreenDocument(): Promise<void> {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: "src/offscreen/index.html",
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: "Play a short notification sound when a Pomodoro phase ends",
  });
}

async function playNotificationSound(): Promise<void> {
  await ensureOffscreenDocument();
  await chrome.runtime.sendMessage({ type: "PLAY_SOUND" });
}

async function startWork(workMinutes: number, breakMinutes: number): Promise<void> {
  const endTimestamp = Date.now() + workMinutes * 60 * 1000;
  const state: TimerState = {
    phase: "work",
    workMinutes,
    breakMinutes,
    endTimestamp,
    isPaused: false,
    remainingMsAtPause: null,
  };
  await setState(state);
  chrome.alarms.create(PHASE_ALARM_NAME, { when: endTimestamp });
  chrome.alarms.create(BADGE_ALARM_NAME, { periodInMinutes: 1 });
  await updateBadge(state);
}

async function pauseTimer(): Promise<void> {
  const state = await getState();
  if (state.phase === "idle" || state.isPaused || state.endTimestamp === null) return;

  const remainingMsAtPause = Math.max(0, state.endTimestamp - Date.now());
  const nextState: TimerState = {
    ...state,
    isPaused: true,
    endTimestamp: null,
    remainingMsAtPause,
  };
  await setState(nextState);
  chrome.alarms.clear(PHASE_ALARM_NAME);
  await updateBadge(nextState);
}

async function resumeTimer(): Promise<void> {
  const state = await getState();
  if (state.phase === "idle" || !state.isPaused || state.remainingMsAtPause === null) return;

  const endTimestamp = Date.now() + state.remainingMsAtPause;
  const nextState: TimerState = {
    ...state,
    isPaused: false,
    endTimestamp,
    remainingMsAtPause: null,
  };
  await setState(nextState);
  chrome.alarms.create(PHASE_ALARM_NAME, { when: endTimestamp });
  chrome.alarms.create(BADGE_ALARM_NAME, { periodInMinutes: 1 });
  await updateBadge(nextState);
}

async function resetTimer(): Promise<void> {
  const state = await getState();
  const nextState: TimerState = {
    ...state,
    phase: "idle",
    endTimestamp: null,
    isPaused: false,
    remainingMsAtPause: null,
  };
  await setState(nextState);
  chrome.alarms.clear(PHASE_ALARM_NAME);
  chrome.alarms.clear(BADGE_ALARM_NAME);
  await updateBadge(nextState);
}

chrome.runtime.onMessage.addListener((message: TimerMessage, _sender, sendResponse) => {
  switch (message.type) {
    case "START":
      startWork(message.workMinutes, message.breakMinutes).then(() => sendResponse({ ok: true }));
      return true;
    case "PAUSE":
      pauseTimer().then(() => sendResponse({ ok: true }));
      return true;
    case "RESUME":
      resumeTimer().then(() => sendResponse({ ok: true }));
      return true;
    case "RESET":
      resetTimer().then(() => sendResponse({ ok: true }));
      return true;
    default:
      return false;
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === BADGE_ALARM_NAME) {
    await updateBadge(await getState());
    return;
  }

  if (alarm.name !== PHASE_ALARM_NAME) return;

  const state = await getState();
  if (state.isPaused) return;

  if (state.phase === "work") {
    const endTimestamp = Date.now() + state.breakMinutes * 60 * 1000;
    const nextState: TimerState = { ...state, phase: "break", endTimestamp };
    await setState(nextState);
    chrome.alarms.create(PHASE_ALARM_NAME, { when: endTimestamp });
    await updateBadge(nextState);
    await playNotificationSound();
    return;
  }

  if (state.phase === "break") {
    const nextState: TimerState = { ...state, phase: "idle", endTimestamp: null };
    await setState(nextState);
    chrome.alarms.clear(BADGE_ALARM_NAME);
    await updateBadge(nextState);
    await playNotificationSound();
  }
});

async function restoreBadgeOnWake(): Promise<void> {
  await updateBadge(await getState());
}

chrome.runtime.onStartup.addListener(restoreBadgeOnWake);
chrome.runtime.onInstalled.addListener(restoreBadgeOnWake);
