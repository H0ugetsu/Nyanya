export type Phase = "idle" | "work" | "break";

export interface TimerState {
  phase: Phase;
  workMinutes: number;
  breakMinutes: number;
  endTimestamp: number | null;
  isPaused: boolean;
  remainingMsAtPause: number | null;
}

export type TimerMessage =
  | {
      type: "START";
      workMinutes: number;
      breakMinutes: number;
    }
  | {
      type: "PAUSE";
    }
  | {
      type: "RESUME";
    }
  | {
      type: "RESET";
    }
  | {
      type: "PLAY_SOUND";
      soundId: SoundId;
      volume: number;
    }
  | {
      type: "TEST_SOUND";
      soundId: SoundId;
      volume: number;
    };

export const TIMER_STORAGE_KEY = "timerState";

export const DEFAULT_TIMER_STATE: TimerState = {
  phase: "idle",
  workMinutes: 25,
  breakMinutes: 5,
  endTimestamp: null,
  isPaused: false,
  remainingMsAtPause: null,
};

export interface SessionCountState {
  date: string;
  count: number;
}

export const SESSION_STORAGE_KEY = "sessionCount";

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodaySessionCount(stored: SessionCountState | undefined): number {
  if (!stored || stored.date !== getLocalDateString()) return 0;
  return stored.count;
}

export type SoundId = "bell" | "chime" | "pop";

export interface SettingsState {
  soundId: SoundId;
  volume: number;
}

export const SETTINGS_STORAGE_KEY = "settings";

export const DEFAULT_SETTINGS: SettingsState = {
  soundId: "bell",
  volume: 70,
};
