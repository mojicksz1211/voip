import type { LucideIcon } from 'lucide-react';
import { Bell, Headphones, Mic, Server } from 'lucide-react';
import { getApiBase } from '@hotel-voip/shared';
import type { DeskAudioSettings } from '../../utils/deskAudioSettings';
import DeskAudioTuningPanel from './DeskAudioTuningPanel';

interface DeskSettingsPanelProps {
  notificationPermission: NotificationPermission | 'unsupported';
  onRequestNotifications: () => void;
  isVoiceConnected?: boolean;
  voiceError?: string | null;
  onServerSetup?: () => void;
  onApplyAudio?: (settings: DeskAudioSettings) => void;
}

function SettingsCard({
  title,
  icon: Icon,
  description,
  children,
  variant = 'default',
}: {
  title: string;
  icon: LucideIcon;
  description?: string;
  children: React.ReactNode;
  variant?: 'default' | 'tip';
}) {
  const isTip = variant === 'tip';

  return (
    <div
      className={`rounded-2xl desk-shadow-card overflow-hidden border shrink-0 ${
        isTip ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'
      }`}
    >
      <div className="px-5 py-4 sm:py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isTip ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-desk-primary'
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className={`text-base sm:text-lg font-bold leading-tight ${
                  isTip ? 'text-amber-900' : 'text-slate-800'
                }`}
              >
                {title}
              </h3>
              {description && (
                <p
                  className={`text-sm mt-1.5 leading-relaxed ${
                    isTip ? 'text-amber-800' : 'text-slate-500'
                  }`}
                >
                  {description}
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function DeskSettingsPanel({
  notificationPermission,
  onRequestNotifications,
  isVoiceConnected = false,
  voiceError = null,
  onServerSetup,
  onApplyAudio,
}: DeskSettingsPanelProps) {
  const serverUrl = getApiBase();

  return (
    <div className="flex flex-col h-full max-w-4xl w-full gap-4 overflow-y-auto min-h-0 pr-1">
      <h2 className="text-xl sm:text-2xl font-bold text-slate-800 px-0.5 shrink-0">Settings</h2>

      {onServerSetup && (
        <SettingsCard
          title="PBX Server"
          icon={Server}
          description={
            serverUrl
              ? `Connected to ${serverUrl}`
              : 'Set the PC address where npm run dev is running.'
          }
        >
          <button
            type="button"
            onClick={onServerSetup}
            className="px-4 py-2.5 text-sm font-semibold bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors active:scale-95"
          >
            Change
          </button>
        </SettingsCard>
      )}

      <SettingsCard
        title="Browser Notifications"
        icon={Bell}
        description="Get alerted when a guest calls even if this tab is in the background."
      >
        {notificationPermission === 'unsupported' ? (
          <span className="text-xs text-slate-400 font-medium">N/A</span>
        ) : notificationPermission === 'granted' ? (
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Enabled
          </span>
        ) : (
          <button
            type="button"
            onClick={onRequestNotifications}
            className="px-4 py-2.5 text-sm font-semibold bg-desk-primary text-white rounded-xl hover:bg-desk-primary-dark transition-colors active:scale-95"
          >
            Enable
          </button>
        )}
      </SettingsCard>

      <SettingsCard
        title="Live Audio"
        icon={Mic}
        description={
          voiceError
            ? voiceError
            : isVoiceConnected
              ? 'Connected — speak directly to the guest.'
              : 'Idle when no call is active. Connects automatically on answer.'
        }
      >
        <span
          className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl border ${
            isVoiceConnected
              ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
              : voiceError
                ? 'text-rose-600 bg-rose-50 border-rose-100'
                : 'text-amber-600 bg-amber-50 border-amber-100'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isVoiceConnected
                ? 'bg-emerald-500 animate-pulse'
                : voiceError
                  ? 'bg-rose-500'
                  : 'bg-amber-500'
            }`}
          />
          {isVoiceConnected ? 'Live' : voiceError ? 'Error' : 'Idle'}
        </span>
      </SettingsCard>

      {onApplyAudio && <DeskAudioTuningPanel onApply={onApplyAudio} />}

      <SettingsCard
        title="Audio Tip"
        icon={Headphones}
        variant="tip"
        description="If echo is loud during calls, lower the music hardware slider in Audio Tuning, or use a headset."
      >
        <Headphones className="w-6 h-6 text-amber-600 opacity-40" />
      </SettingsCard>
    </div>
  );
}
