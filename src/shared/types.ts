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
