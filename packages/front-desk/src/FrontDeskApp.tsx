import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { getApiBase } from '@hotel-voip/shared';
import FrontDesk from './components/FrontDesk';
import NotificationPermissionBanner from './components/NotificationPermissionBanner';
import BatteryOptimizationBanner from './components/BatteryOptimizationBanner';
import ServerSetup from './components/ServerSetup';
import { useFrontDeskPbx } from './hooks/useFrontDeskPbx';
import { useDeskNotifications } from './hooks/useDeskNotifications';
import { useNotificationPermission } from './hooks/useNotificationPermission';
import { startPresenceService } from './utils/callAudio';

function FrontDeskShell() {
  const pbx = useFrontDeskPbx();
  const notifPerm = useNotificationPermission();
  const [hideDeniedHint, setHideDeniedHint] = useState(false);
  const [showServerSetup, setShowServerSetup] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  useDeskNotifications({ currentCall: pbx.currentCall });

  // Keep a persistent foreground service alive so the console survives
  // screen-off / Doze and incoming calls always ring.
  useEffect(() => {
    startPresenceService();
  }, []);

  const handleRequestNotifications = async () => {
    const result = await notifPerm.requestPermission();
    if (result === 'denied') {
      setHideDeniedHint(false);
    }
  };

  if (showServerSetup) {
    return (
      <div className="h-[100dvh] w-screen overflow-hidden bg-desk-surface">
        <ServerSetup
          onSaved={() => {
            setShowServerSetup(false);
            window.location.reload();
          }}
          onCancel={isNative ? undefined : () => setShowServerSetup(false)}
        />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-desk-surface flex flex-col text-slate-950 font-sans antialiased overflow-hidden">
      <NotificationPermissionBanner
        permission={notifPerm.permission}
        onRequest={handleRequestNotifications}
        showDeniedHint={!hideDeniedHint}
        onDismissDeniedHint={() => setHideDeniedHint(true)}
      />

      <BatteryOptimizationBanner />

      <main className="flex-1 min-h-0 flex flex-col">
        <FrontDesk
          extensions={pbx.extensions}
          calls={pbx.calls}
          requests={pbx.requests}
          currentCall={pbx.currentCall}
          onInitiateCall={pbx.handleInitiateCall}
          onHangupCall={pbx.handleHangupCall}
          onAnswerCall={pbx.handleAnswerCall}
          onDeclineCall={pbx.handleDeclineCall}
          onUpdateRequestStatus={pbx.handleUpdateRequestStatus}
          isVoiceConnected={pbx.isVoiceConnected}
          voiceError={pbx.voiceError}
          isMicMuted={pbx.isMicMuted}
          isSpeakerMuted={pbx.isSpeakerMuted}
          isOnHold={pbx.isOnHold}
          onToggleMic={pbx.toggleMic}
          onToggleSpeaker={pbx.handleToggleSpeaker}
          onToggleHold={pbx.toggleHold}
          onApplyAudio={pbx.applyDeskAudio}
          notificationPermission={notifPerm.permission}
          onRequestNotifications={handleRequestNotifications}
          onServerSetup={isNative ? () => setShowServerSetup(true) : undefined}
          deskDnd={pbx.deskDnd}
          deskOnline={pbx.deskOnline}
          onSetDeskDnd={pbx.setDeskDnd}
          onSetDeskAvailability={pbx.setDeskAvailability}
        />
      </main>
    </div>
  );
}

export default function FrontDeskApp() {
  const isNative = Capacitor.isNativePlatform();
  const [serverReady, setServerReady] = useState(() => !isNative || Boolean(getApiBase()));

  if (isNative && !serverReady) {
    return (
      <div className="h-[100dvh] w-screen overflow-hidden bg-desk-surface">
        <ServerSetup onSaved={() => window.location.reload()} />
      </div>
    );
  }

  return <FrontDeskShell />;
}
