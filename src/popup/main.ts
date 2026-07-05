import {
  DEFAULT_SETTINGS,
  DEFAULT_TIMER_STATE,
  getTodaySessionCount,
  SESSION_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  TIMER_STORAGE_KEY,
  type SessionCountState,
  type SettingsState,
  type SoundId,
  type TimerMessage,
  type TimerState,
} from "../shared/types";

const timerEl = document.getElementById("timer")!;
const phaseEl = document.getElementById("phase")!;
const sessionCountEl = document.getElementById("sessionCount")!;
const workInput = document.getElementById("workMinutes") as HTMLInputElement;
const breakInput = document.getElementById("breakMinutes") as HTMLInputElement;
const primaryButton = document.getElementById("primaryButton") as HTMLButtonElement;
const resetButton = document.getElementById("resetButton") as HTMLButtonElement;
const soundSelect = document.getElementById("soundSelect") as HTMLSelectElement;
const volumeRange = document.getElementById("volumeRange") as HTMLInputElement;
const testSoundButton = document.getElementById("testSoundButton") as HTMLButtonElement;

type PrimaryAction = "start" | "pause" | "resume";
let primaryAction: PrimaryAction = "start";
let intervalId: number | undefined;

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateButtons(state: TimerState): void {
  if (state.phase === "idle") {
    primaryAction = "start";
    primaryButton.textContent = "開始";
    resetButton.hidden = true;
  } else if (state.isPaused) {
    primaryAction = "resume";
    primaryButton.textContent = "再開";
    resetButton.hidden = false;
  } else {
    primaryAction = "pause";
    primaryButton.textContent = "一時停止";
    resetButton.hidden = false;
  }
}

function render(state: TimerState): void {
  phaseEl.textContent = state.isPaused ? `${state.phase} (一時停止)` : state.phase;
  workInput.value = String(state.workMinutes);
  breakInput.value = String(state.breakMinutes);
  workInput.disabled = state.phase !== "idle";
  breakInput.disabled = state.phase !== "idle";

  if (intervalId !== undefined) {
    clearInterval(intervalId);
    intervalId = undefined;
  }

  if (state.phase === "idle") {
    timerEl.textContent = formatTime(state.workMinutes * 60 * 1000);
  } else if (state.isPaused) {
    timerEl.textContent = formatTime(state.remainingMsAtPause ?? 0);
  } else if (state.endTimestamp !== null) {
    const endTimestamp = state.endTimestamp;
    const tick = () => {
      timerEl.textContent = formatTime(endTimestamp - Date.now());
    };
    tick();
    intervalId = window.setInterval(tick, 1000);
  }

  updateButtons(state);
}

function renderSessionCount(stored: SessionCountState | undefined): void {
  sessionCountEl.textContent = `今日の完了セッション数: ${getTodaySessionCount(stored)}`;
}

function renderSettings(settings: SettingsState): void {
  soundSelect.value = settings.soundId;
  volumeRange.value = String(settings.volume);
}

async function loadState(): Promise<void> {
  const result = await chrome.storage.local.get([TIMER_STORAGE_KEY, SESSION_STORAGE_KEY, SETTINGS_STORAGE_KEY]);
  const state = (result[TIMER_STORAGE_KEY] as TimerState | undefined) ?? DEFAULT_TIMER_STATE;
  render(state);
  renderSessionCount(result[SESSION_STORAGE_KEY] as SessionCountState | undefined);
  renderSettings((result[SETTINGS_STORAGE_KEY] as SettingsState | undefined) ?? DEFAULT_SETTINGS);
}

async function saveSettings(): Promise<void> {
  const settings: SettingsState = {
    soundId: soundSelect.value as SoundId,
    volume: Number(volumeRange.value),
  };
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
}

primaryButton.addEventListener("click", async () => {
  const message: TimerMessage =
    primaryAction === "start"
      ? { type: "START", workMinutes: Number(workInput.value), breakMinutes: Number(breakInput.value) }
      : primaryAction === "pause"
        ? { type: "PAUSE" }
        : { type: "RESUME" };

  await chrome.runtime.sendMessage(message);
  await loadState();
});

resetButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "RESET" } satisfies TimerMessage);
  await loadState();
});

soundSelect.addEventListener("change", saveSettings);
volumeRange.addEventListener("change", saveSettings);

testSoundButton.addEventListener("click", async () => {
  await saveSettings();
  await chrome.runtime.sendMessage({ type: "TEST_SOUND" } satisfies TimerMessage);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[TIMER_STORAGE_KEY]) {
    render(changes[TIMER_STORAGE_KEY].newValue as TimerState);
  }
  if (changes[SESSION_STORAGE_KEY]) {
    renderSessionCount(changes[SESSION_STORAGE_KEY].newValue as SessionCountState);
  }
  if (changes[SETTINGS_STORAGE_KEY]) {
    renderSettings(changes[SETTINGS_STORAGE_KEY].newValue as SettingsState);
  }
});

loadState();
