// AudioWorklet 处理器
// 采集麦克风音频（Float32），降采样到 16kHz，转为 Int16 PCM
// 通过 port.postMessage 发送 ArrayBuffer 到主线程

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // sampleRate 是 AudioWorkletGlobalScope 的全局变量
    this.targetRate = 16000;
    this.ratio = sampleRate / this.targetRate;
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const inputData = input[0]; // 单声道 Float32Array
      // 降采样到 16kHz（线性插值）
      const outputLength = Math.max(1, Math.floor(inputData.length / this.ratio));
      const int16 = new Int16Array(outputLength);
      for (let i = 0; i < outputLength; i++) {
        const srcIdx = i * this.ratio;
        const idx0 = Math.floor(srcIdx);
        const idx1 = Math.min(idx0 + 1, inputData.length - 1);
        const frac = srcIdx - idx0;
        const sample = inputData[idx0] * (1 - frac) + inputData[idx1] * frac;
        // 限幅 + 转 Int16
        const clamped = Math.max(-1, Math.min(1, sample));
        int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      }
      // transfer ArrayBuffer 避免拷贝
      this.port.postMessage(int16.buffer, [int16.buffer]);
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
