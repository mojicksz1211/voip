import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { getApiBase } from "@hotel-voip/shared";
import GuestTablet from "./components/GuestTablet";
import ServerSetup from "./components/ServerSetup";
import GuestAlertDialog from "./components/GuestAlertDialog";
import { useGuestPbx } from "./hooks/useGuestPbx";
import { enableKioskMode } from "./utils/nativeTablet";
import { isKioskPinned } from "./utils/guestStorage";

function GuestAppContent() {
  const isNative = Capacitor.isNativePlatform();
  const [showAdminServerSetup, setShowAdminServerSetup] = useState(false);
  const pbx = useGuestPbx();

  useEffect(() => {
    if (isNative && isKioskPinned()) {
      void enableKioskMode();
    }
  }, [isNative]);

  const tablet = (
    <GuestTablet
      allExtensions={pbx.extensions}
      currentCall={pbx.currentCall}
      onInitiateCall={pbx.handleInitiateCall}
      onHangupCall={pbx.handleHangupCall}
      onAnswerCall={pbx.handleAnswerCall}
      onDeclineCall={pbx.handleDeclineCall}
      onSendRequest={pbx.handleSendRoomRequest}
      requests={pbx.requests}
      roomNum={pbx.roomNum}
      setRoomNum={pbx.setRoomNum}
      isRegistered={pbx.isRegistered}
      isAutoRegistering={pbx.isAutoRegistering}
      connectionStatus={pbx.connectionStatus}
      serverUrl={getApiBase()}
      onRegister={pbx.handleRegisterDevice}
      onUnregister={pbx.handleUnregisterDevice}
      onAdminServerSetup={() => setShowAdminServerSetup(true)}
      isVoiceConnected={pbx.isVoiceConnected}
      voiceError={pbx.voiceError}
      isMicMuted={pbx.isMicMuted}
      isSpeakerMuted={pbx.isSpeakerMuted}
      onToggleMic={pbx.toggleMic}
      onToggleSpeaker={pbx.handleToggleSpeaker}
    />
  );

  if (showAdminServerSetup) {
    return (
      <div className="h-[100dvh] w-screen overflow-hidden bg-slate-900">
        <ServerSetup
          onSaved={() => setShowAdminServerSetup(false)}
          onCancel={() => setShowAdminServerSetup(false)}
        />
      </div>
    );
  }

  const content = isNative ? (
    <div className="h-[100dvh] w-screen overflow-hidden bg-slate-900">{tablet}</div>
  ) : (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl h-[calc(100vh-2rem)] max-h-[90dvh]">{tablet}</div>
    </div>
  );

  return (
    <>
      {content}
      <GuestAlertDialog
        open={Boolean(pbx.appAlert)}
        title="Error"
        message={pbx.appAlert ?? ""}
        onDismiss={pbx.dismissAppAlert}
      />
    </>
  );
}

export default function GuestApp() {
  const isNative = Capacitor.isNativePlatform();
  const [serverReady, setServerReady] = useState(() => !isNative || Boolean(getApiBase()));

  if (isNative && !serverReady) {
    return (
      <div className="h-[100dvh] w-screen overflow-hidden bg-slate-900">
        <ServerSetup onSaved={() => setServerReady(true)} />
      </div>
    );
  }

  return <GuestAppContent />;
}
