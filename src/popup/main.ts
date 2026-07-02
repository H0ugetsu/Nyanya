import { DEFAULT_TIMER_STATE, TIMER_STORAGE_KEY, type TimerMessage, type TimerState } from "../shared/types";

const timerEl = document.getElementById("timer")!;
const phaseEl = document.getElementById("phase")!;
const workInput = document.getElementById("workMinutes") as HTMLInputElement;
const breakInput = document.getElementById("breakMinutes") as HTMLInputElement;
const startButton = document.getElementById("startButton") as HTMLButtonElement;

let intervalId: number | undefined;

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function render(state: TimerState): void {
  phaseEl.textContent = state.phase;
  workInput.value = String(state.workMinutes);
  breakInput.value = String(state.breakMinutes);

  if (intervalId !== undefined) {
    clearInterval(intervalId);
    intervalId = undefined;
  }

  if (state.phase === "idle" || state.endTimestamp === null) {
    timerEl.textContent = formatTime(state.workMinutes * 60 * 1000);
    return;
  }

  const endTimestamp = state.endTimestamp;
  const tick = () => {
    timerEl.textContent = formatTime(endTimestamp - Date.now());
  };
  tick();
  intervalId = window.setInterval(tick, 1000);
}

async function loadState(): Promise<void> {
  const result = await chrome.storage.local.get(TIMER_STORAGE_KEY);
  const state = (result[TIMER_STORAGE_KEY] as TimerState | undefined) ?? DEFAULT_TIMER_STATE;
  render(state);
}

startButton.addEventListener("click", async () => {
  const message: TimerMessage = {
    type: "START",
    workMinutes: Number(workInput.value),
    breakMinutes: Number(breakInput.value),
  };
  await chrome.runtime.sendMessage(message);
  await loadState();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[TIMER_STORAGE_KEY]) {
    render(changes[TIMER_STORAGE_KEY].newValue as TimerState);
  }
});

loadState();
