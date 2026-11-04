export function wav(name: string, frequency = 220, seconds = 8) {
  const rate = 8000;
  const count = rate * seconds;
  const buffer = Buffer.alloc(44 + count * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i += 1) {
    buffer.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * frequency * i) / rate) * 800),
      44 + i * 2
    );
  }
  return { buffer, mimeType: "audio/wav", name: `${name}.wav` };
}

export function segmentedWav(name: string) {
  const file = wav(name, 220, 8);
  const rate = 8000;
  for (let sample = 0; sample < rate * 8; sample += 1) {
    let amplitude = 0;
    if (sample >= rate * 2 && sample < rate * 4) {
      amplitude = 2000;
    }
    if (sample >= rate * 4 && sample < rate * 6) {
      amplitude = 16_000;
    }
    file.buffer.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 220 * sample) / rate) * amplitude),
      44 + sample * 2
    );
  }
  return file;
}
