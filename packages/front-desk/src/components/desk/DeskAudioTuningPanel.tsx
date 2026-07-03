import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  type DeskAudioSettings,
  DEFAULT_DESK_AUDIO,
  formatPercent,
  getDeskAudioSettings,
  getEchoRiskLevel,
  resetDeskAudioSettings,
  setDeskAudioSettings,
  subscribeDeskAudioSettings,
} from '../../utils/deskAudioSettings';
import { isAndroidNative } from '../../utils/callAudio';
import {
  getRetroHandsetMode,
  setRetroHandsetMode,
  subscribeRetroHandsetMode,
} from '@hotel-voip/shared';

interface DeskAudioTuningPanelProps {
  onApply: (settings: DeskAudioSettings) => void;
}

function AudioSlider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{hint}</p>
        </div>
        <span className="text-sm font-bold tabular-nums text-desk-primary shrink-0">
          {formatPercent(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none bg-slate-200 accent-desk-primary cursor-pointer"
        aria-label={label}
      />
    </div>
  );
}

function EchoRiskBadge({ level }: { level: ReturnType<typeof getEchoRiskLevel> }) {
  const styles = {
    low: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    medium: 'text-amber-700 bg-amber-50 border-amber-200',
    high: 'text-rose-700 bg-rose-50 border-rose-200',
  } as const;

  const labels = {
    low: 'Low echo risk',
    medium: 'Medium echo risk',
    high: 'High echo risk',
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border ${styles[level]}`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          level === 'low' ? 'bg-emerald-500' : level === 'medium' ? 'bg-amber-500' : 'bg-rose-500'
        }`}
      />
      {labels[level]}
    </span>
  );
}

export default function DeskAudioTuningPanel({ onApply }: DeskAudioTuningPanelProps) {
  const [settings, setSettings] = useState<DeskAudioSettings>(() => getDeskAudioSettings());
  const [retroHandset, setRetroHandset] = useState(() => getRetroHandsetMode());

  useEffect(() => subscribeDeskAudioSettings(setSettings), []);
  useEffect(() => subscribeRetroHandsetMode(setRetroHandset), []);

  const update = useCallback(
    (partial: Partial<DeskAudioSettings>) => {
      const next = setDeskAudioSettings(partial);
      setSettings(next);
      onApply(next);
    },
    [onApply],
  );

  const handleReset = useCallback(() => {
    const next = resetDeskAudioSettings();
    setSettings(next);
    onApply(next);
  }, [onApply]);

  const echoRisk = getEchoRiskLevel(settings);

  return (
    <div className="rounded-2xl desk-shadow-card overflow-hidden border bg-white border-slate-100 shrink-0">
      <div className="px-5 py-4 sm:py-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-violet-50 text-violet-600">
              <SlidersHorizontal className="w-6 h-6" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                Audio Tuning
              </h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                Adjust voice level and echo while on a call. Breathing and room noise are
                filtered automatically; lower guest voice if breath sounds are still loud.
              </p>
            </div>
          </div>
          <EchoRiskBadge level={echoRisk} />
        </div>
      </div>

      <div className="px-5 py-5 space-y-6">
        {isAndroidNative && (
          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 accent-desk-primary"
              checked={retroHandset}
              onChange={(e) => setRetroHandsetMode(e.target.checked)}
            />
            <span className="min-w-0">
              <span className="text-sm font-semibold text-slate-800 block">Retro phone handset</span>
              <span className="text-xs text-slate-500 leading-relaxed">
                Enable for 3.5mm retro receiver handsets (mic and earpiece in one piece). Reduces
                hearing your own voice. Hook button answers incoming calls or hangs up. Takes effect on the next call.
              </span>
            </span>
          </label>
        )}

        <AudioSlider
          label="Guest voice (digital)"
          hint="Guest voice level in the app. Raise if too quiet; lower if you hear echo."
          value={settings.remotePlayback}
          min={0.35}
          max={1}
          step={0.01}
          onChange={(remotePlayback) => update({ remotePlayback })}
        />

        {isAndroidNative && (
          <>
            <AudioSlider
              label="Speaker hardware — music"
              hint="Most effective for echo control. Lower if you hear your own voice feeding back."
              value={settings.speakerMusic}
              min={0.25}
              max={1}
              step={0.01}
              onChange={(speakerMusic) => update({ speakerMusic })}
            />

            <AudioSlider
              label="Speaker hardware — voice call"
              hint="System voice-call volume. Usually kept lower than digital gain."
              value={settings.speakerVoice}
              min={0.25}
              max={1}
              step={0.01}
              onChange={(speakerVoice) => update({ speakerVoice })}
            />
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-400 leading-relaxed">
            Default: digital {formatPercent(DEFAULT_DESK_AUDIO.remotePlayback)}
            {isAndroidNative &&
              ` · music ${formatPercent(DEFAULT_DESK_AUDIO.speakerMusic)} · voice ${formatPercent(DEFAULT_DESK_AUDIO.speakerVoice)}`}
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors active:scale-95 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
