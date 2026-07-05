import type { SoundId, TimerMessage } from "../shared/types";

interface SoundPreset {
  fundamental: number;
  overtoneRatios: number[];
  duration: number;
  waveform: OscillatorType;
}

const SOUND_PRESETS: Record<SoundId, SoundPreset> = {
  bell: { fundamental: 880, overtoneRatios: [1, 2.4, 3.8], duration: 1.2, waveform: "sine" },
  chime: { fundamental: 587, overtoneRatios: [1, 2, 3], duration: 1.6, waveform: "sine" },
  pop: { fundamental: 660, overtoneRatios: [1], duration: 0.15, waveform: "triangle" },
};

function playSound(soundId: SoundId, volume: number): void {
  const preset = SOUND_PRESETS[soundId];
  const audioContext = new AudioContext();
  const now = audioContext.currentTime;
  const volumeScale = Math.max(0, Math.min(100, volume)) / 100;

  const master = audioContext.createGain();
  master.gain.setValueAtTime(0.3 * volumeScale, now);
  master.connect(audioContext.destination);

  for (const [index, ratio] of preset.overtoneRatios.entries()) {
    const oscillator = audioContext.createOscillator();
    oscillator.type = preset.waveform;
    oscillator.frequency.setValueAtTime(preset.fundamental * ratio, now);

    const gain = audioContext.createGain();
    const peak = 0.5 / (index + 1);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration);

    oscillator.connect(gain);
    gain.connect(master);

    oscillator.start(now);
    oscillator.stop(now + preset.duration + 0.1);
  }

  setTimeout(() => {
    void audioContext.close();
  }, (preset.duration + 0.3) * 1000);
}

chrome.runtime.onMessage.addListener((message: TimerMessage) => {
  if (message.type === "PLAY_SOUND") {
    playSound(message.soundId, message.volume);
  }
});
