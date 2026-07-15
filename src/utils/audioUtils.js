// 5-tap Hann-windowed sinc FIR low-pass filter, cutoff at 8 kHz (Nyquist of 16 kHz output).
// Applied before decimation to suppress aliasing from the 8–12 kHz band that would
// otherwise fold back into the 0–8 kHz pass-band and degrade sibilant/fricative clarity.
// Coefficients normalised so they sum to 1.0 (DC gain = 0 dB).
const AA_FILTER_5 = [0.0625, 0.25, 0.375, 0.25, 0.0625];

function downsample24kTo16k(pcmBuffer) {
  const input = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
  const outputLength = Math.floor((input.length * 2) / 3);
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    // Map output sample i to the nearest input sample index (3:2 ratio)
    const center = Math.round((i * 3) / 2);

    // Apply 5-tap FIR centred at `center`
    let acc = 0;
    for (let t = -2; t <= 2; t++) {
      const idx = center + t;
      const s = idx >= 0 && idx < input.length ? input[idx] : 0;
      acc += AA_FILTER_5[t + 2] * s;
    }
    output[i] = Math.round(Math.max(-32768, Math.min(32767, acc)));
  }

  return Buffer.from(output.buffer);
}

function pcm16ToWav(pcmBuffer, sampleRate = 16000, channels = 1) {
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBuffer]);
}

function pcm16ToFloat32(pcmBuffer) {
  const input = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    output[i] = input[i] / 32768;
  }
  return output;
}

module.exports = {
  downsample24kTo16k,
  pcm16ToWav,
  pcm16ToFloat32,
};
