import type { TimerMessage } from "../shared/types";

function playBell(): void {
  const audioContext = new AudioContext();
  const now = audioContext.currentTime;
  const duration = 1.2;

  const master = audioContext.createGain();
  master.gain.setValueAtTime(0.3, now);
  master.connect(audioContext.destination);

  const fundamental = 880;
  const overtoneRatios = [1, 2.4, 3.8];

  for (const [index, ratio] of overtoneRatios.entries()) {
    const oscillator = audioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(fundamental * ratio, now);

    const gain = audioContext.createGain();
    const peak = 0.5 / (index + 1);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(master);

    oscillator.start(now);
    oscillator.stop(now + duration + 0.1);
  }

  setTimeout(() => {
    void audioContext.close();
  }, (duration + 0.3) * 1000);
}

chrome.runtime.onMessage.addListener((message: TimerMessage) => {
  if (message.type === "PLAY_SOUND") {
    playBell();
  }
});
