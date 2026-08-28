let audioContext = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

function noiseBurst(context, start, duration, frequency, gainValue) {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    const envelope = 1 - index / frameCount;
    samples[index] = (Math.random() * 2 - 1) * envelope;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 0.7;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(start);
  source.stop(start + duration);
}

export async function playTableSound(kind) {
  const context = getAudioContext();
  if (!context) return false;
  try {
    if (context.state === "suspended") await context.resume();
    const now = context.currentTime + 0.015;
    if (kind === "shuffle") {
      noiseBurst(context, now, 0.22, 1100, 0.055);
      noiseBurst(context, now + 0.13, 0.2, 1450, 0.045);
    } else if (kind === "deal") {
      for (let index = 0; index < 6; index += 1) {
        noiseBurst(context, now + index * 0.075, 0.045, 1850, 0.05);
      }
    } else if (kind === "card") {
      noiseBurst(context, now, 0.075, 920, 0.075);
      noiseBurst(context, now + 0.018, 0.05, 2100, 0.04);
    }
    return true;
  } catch {
    return false;
  }
}
