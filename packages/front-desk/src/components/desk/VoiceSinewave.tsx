import { useEffect, useRef } from 'react';

interface VoiceSinewaveProps {
  active: boolean;
  paused?: boolean;
  className?: string;
}

function captureStreamFromElement(el: HTMLAudioElement): MediaStream | null {
  const anyEl = el as HTMLAudioElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  if (typeof anyEl.captureStream === 'function') {
    return anyEl.captureStream();
  }
  if (typeof anyEl.mozCaptureStream === 'function') {
    return anyEl.mozCaptureStream();
  }
  return null;
}

export default function VoiceSinewave({ active, paused = false, className = '' }: VoiceSinewaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef(0);
  const levelRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const audioCtx = new AudioContext({ latencyHint: 'interactive' });
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.82;
    const timeData = new Uint8Array(analyser.fftSize);

    const connectedElements = new WeakSet<HTMLAudioElement>();
    const sources: MediaStreamAudioSourceNode[] = [];

    const connectRemoteAudio = () => {
      for (const el of document.querySelectorAll('audio')) {
        if (connectedElements.has(el)) continue;
        const stream = el.srcObject as MediaStream | null;
        if (!stream?.getAudioTracks().some((t) => t.readyState === 'live')) continue;

        const captured = captureStreamFromElement(el) ?? stream;
        try {
          const source = audioCtx.createMediaStreamSource(captured);
          source.connect(analyser);
          sources.push(source);
          connectedElements.add(el);
        } catch {
          // Element may already be wired to another graph.
        }
      }
    };

    connectRemoteAudio();
    const connectTimer = window.setInterval(connectRemoteAudio, 400);

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      let level = 0;
      if (!paused) {
        analyser.getByteTimeDomainData(timeData);
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const sample = (timeData[i] - 128) / 128;
          sum += sample * sample;
        }
        level = Math.min(1, Math.sqrt(sum / timeData.length) * 5.5);
      }

      levelRef.current += (level - levelRef.current) * 0.18;
      const smoothLevel = levelRef.current;
      phaseRef.current += paused ? 0.04 : 0.1 + smoothLevel * 0.14;

      ctx.clearRect(0, 0, w, h);

      const centerY = h / 2;
      const baseAmp = paused ? h * 0.06 : h * 0.1;
      const voiceAmp = paused ? 0 : h * 0.34 * smoothLevel;
      const amplitude = baseAmp + voiceAmp;

      const waves: { color: string; alpha: number; phase: number; freq: number }[] = paused
        ? [
            { color: '#f59e0b', alpha: 0.5, phase: 0, freq: 3 },
            { color: '#fcd34d', alpha: 0.35, phase: 1.2, freq: 2.2 },
          ]
        : [
            { color: '#6366f1', alpha: 0.9, phase: 0, freq: 4 },
            { color: '#10b981', alpha: 0.7, phase: 0.9, freq: 5.2 },
            { color: '#8b5cf6', alpha: 0.45, phase: 1.8, freq: 3.1 },
          ];

      for (const wave of waves) {
        ctx.beginPath();
        ctx.strokeStyle = wave.color;
        ctx.globalAlpha = wave.alpha;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        for (let x = 0; x <= w; x++) {
          const t = x / w;
          const envelope = 0.55 + 0.45 * Math.sin(t * Math.PI);
          const y =
            centerY +
            Math.sin(t * Math.PI * wave.freq + phaseRef.current + wave.phase) *
              amplitude *
              envelope;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    void audioCtx.resume().then(() => {
      rafRef.current = requestAnimationFrame(draw);
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(connectTimer);
      for (const source of sources) {
        source.disconnect();
      }
      void audioCtx.close();
      levelRef.current = 0;
      phaseRef.current = 0;
    };
  }, [active, paused]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-12 block ${className}`}
      aria-hidden
    />
  );
}
