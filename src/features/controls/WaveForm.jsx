import React, { useEffect, useRef } from 'react';

export default function WaveForm({ buffer, currentTime, duration }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!buffer || !duration) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const drawWaveform = () => {
      ctx.clearRect(0, 0, width, height);
      const data = buffer.getChannelData(0);
      const step = Math.floor(data.length / width);
      const amp = height / 2;
      // console.log(currentTime)
      // Draw waveform
      ctx.fillStyle = '#666';
      for (let i = 0; i < width; i++) {
        const x = i;
        const isBeforeProgress = x < (currentTime / duration) * width;

        // let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          // const val = data[i * step + j];
          // if (val < min) min = val;
          // if (val > max) max = val;
          const val = data[i * step + j];
          if (val > max) max = val;
        }

        // const y = (1 + min) * amp;
        // const h = Math.max(1, (max - min) * amp);
        const h = max * height;   // Full height scale
        const y = height - h;  

        ctx.fillStyle = isBeforeProgress ? 'rgba(22, 22, 22, 0.92)' : '#c5c5c5';
        ctx.fillRect(x, y, 1, h);
      }

      // Draw progress
      // const progressX = (currentTime / duration) * width;
      // ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
      // ctx.fillRect(0, 0, progressX, height);
    };

    drawWaveform();
  }, [buffer, currentTime, duration]);

  return (
    <canvas
      ref={canvasRef}
      width={1600}
      height={200}
      style={{ width: '100vw', height: '25vh', background: 'transparent' }}
    />
  );
}
