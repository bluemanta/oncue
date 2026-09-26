"use client";

/**
 * 把浏览器录到的音频转成腾讯云口语评测要的格式：16kHz、单声道、16 位 WAV。
 *
 * 浏览器 MediaRecorder 录出来的是 webm/opus（Chrome）或 mp4/aac（Safari），
 * 评测服务都不收。在浏览器里转好再传，服务器就不用装 ffmpeg。
 *
 * decodeAudioData 能认浏览器自己录的所有格式，OfflineAudioContext 顺便做重采样。
 */

const TARGET_RATE = 16000;

export async function toWav16kMono(blob: Blob): Promise<Blob> {
  const bytes = await blob.arrayBuffer();

  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(bytes);
  } finally {
    void ctx.close();
  }

  // 重采样到 16k 并混成单声道
  const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  return encodeWav(rendered.getChannelData(0), TARGET_RATE);
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  const dataBytes = samples.length * bytesPerSample;
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);          // fmt 块长度
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // 单声道
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // 每秒字节数
  view.setUint16(32, bytesPerSample, true);              // 每帧字节数
  view.setUint16(34, 16, true);          // 位深
  writeText(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
