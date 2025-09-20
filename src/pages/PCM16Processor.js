class PCM16Processor extends AudioWorkletProcessor {
  constructor() {
    super()
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]

    if (input.length > 0) {
      const inputChannel = input[0]
      const bufferLength = inputChannel.length
      const outputBuffer = new Int16Array(bufferLength)

      for (let i = 0; i < bufferLength; i++) {
        // Clamp the sample value to the range [-1, 1]
        const sample = Math.max(-1, Math.min(1, inputChannel[i]))

        // Scale to 16-bit signed integer range and convert
        outputBuffer[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
      }

      this.port.postMessage(outputBuffer)
    }

    return true
  }
}

registerProcessor("PCM16Processor", PCM16Processor)
