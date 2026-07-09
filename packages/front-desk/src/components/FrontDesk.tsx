import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import type { SIPExtension, GuestRequest, CallRecord, CallMetadata } from '@hotel-voip/shared';
import DeskTopBar from './desk/DeskTopBar';
import DeskSidebar from './desk/DeskSidebar';
import DeskDialer from './desk/DeskDialer';
import DeskRecentsPanel from './desk/DeskRecentsPanel';
import DeskRoomsPanel from './desk/DeskRoomsPanel';
import DeskRequestsPanel from './desk/DeskRequestsPanel';
import DeskSettingsPanel from './desk/DeskSettingsPanel';
import DeskDashboardPanel from './desk/DeskDashboardPanel';
import ActiveCallOverlay from './desk/ActiveCallOverlay';
import IncomingCallModal from './desk/IncomingCallModal';
import OutgoingCallModal from './desk/OutgoingCallModal';
import InCallModal from './desk/InCallModal.tsx';
import type { DeskAudioSettings } from '../utils/deskAudioSettings';
import {
  type DeskNav,
  type OperatorStatus,
  getAutoAnswer,
  setAutoAnswer,
} from '../utils/deskHelpers';

const DESK_EXT = '000';
const AUTO_ANSWER_DELAY_MS = 2000;

interface FrontDeskProps {
  extensions: SIPExtension[];
  calls: CallRecord[];
  requests: GuestRequest[];
  currentCall: CallMetadata | null;
  onInitiateCall: (toExt: string) => void;
  onHangupCall: (callId: string) => void;
  onAnswerCall: (callId: string) => void;
  onDeclineCall: (callId: string) => void;
  onUpdateRequestStatus: (id: string, newStatus: GuestRequest['status']) => Promise<void>;
  isVoiceConnected?: boolean;
  voiceError?: string | null;
  isMicMuted?: boolean;
  isSpeakerMuted?: boolean;
  isOnHold?: boolean;
  onToggleMic?: () => void;
  onToggleSpeaker?: () => void;
  onToggleHold?: () => void;
  onApplyAudio?: (settings: DeskAudioSettings) => void;
  notificationPermission?: NotificationPermission | 'unsupported';
  onRequestNotifications?: () => void;
  onServerSetup?: () => void;
  deskDnd?: boolean;
  deskOnline?: boolean;
  onSetDeskDnd?: (enabled: boolean) => Promise<void>;
  onSetDeskAvailability?: (available: boolean) => Promise<void>;
}

export default function FrontDesk({
  extensions,
  calls,
  requests,
  currentCall,
  onInitiateCall,
  onHangupCall,
  onAnswerCall,
  onDeclineCall,
  onUpdateRequestStatus,
  isVoiceConnected = false,
  voiceError = null,
  isMicMuted = false,
  isSpeakerMuted = false,
  isOnHold = false,
  onToggleMic = () => {},
  onToggleSpeaker = () => {},
  onToggleHold = () => {},
  onApplyAudio,
  notificationPermission = 'default',
  onRequestNotifications = () => {},
  onServerSetup,
  deskDnd = false,
  deskOnline = true,
  onSetDeskDnd,
  onSetDeskAvailability,
}: FrontDeskProps) {
  const [activeNav, setActiveNav] = useState<DeskNav>('dashboard');
  const [autoAnswer, setAutoAnswerState] = useState(() => getAutoAnswer());
  const [dialSeed, setDialSeed] = useState('');

  const operatorStatus: OperatorStatus = !deskOnline
    ? 'offline'
    : deskDnd
      ? 'dnd'
      : 'online';
  const effectiveDnd = deskDnd;
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;
  const isIncomingCall =
    Boolean(currentCall) &&
    currentCall!.toExt === DESK_EXT &&
    currentCall!.status === 'ringing';
  const isOutgoingRinging =
    Boolean(currentCall) &&
    currentCall!.fromExt === DESK_EXT &&
    currentCall!.status === 'ringing';
  const isConnectedCall = Boolean(currentCall) && currentCall!.status === 'connected';
  const showCallOverlay =
    Boolean(currentCall) && !isIncomingCall && !isOutgoingRinging && !isConnectedCall;

  const handleToggleAutoAnswer = useCallback(() => {
    const next = !autoAnswer;
    setAutoAnswerState(next);
    setAutoAnswer(next);
  }, [autoAnswer]);

  const handleToggleDnd = useCallback(() => {
    const next = !deskDnd;
    void onSetDeskDnd?.(next);
  }, [deskDnd, onSetDeskDnd]);

  const handleStatusChange = useCallback(
    (status: OperatorStatus) => {
      if (status === 'offline') {
        void onSetDeskAvailability?.(false);
      } else if (status === 'dnd') {
        void onSetDeskDnd?.(true);
      } else {
        void onSetDeskAvailability?.(true);
      }
    },
    [onSetDeskAvailability, onSetDeskDnd],
  );

  const handleDial = useCallback(
    (ext: string) => {
      if (effectiveDnd) return;
      setDialSeed(ext);
      onInitiateCall(ext);
    },
    [effectiveDnd, onInitiateCall],
  );

  useEffect(() => {
    if (!currentCall || !autoAnswer || effectiveDnd) return;
    if (currentCall.toExt !== DESK_EXT || currentCall.status !== 'ringing') return;
    if (Capacitor.isNativePlatform()) return;

    const timer = window.setTimeout(() => {
      onAnswerCall(currentCall.callId);
    }, AUTO_ANSWER_DELAY_MS);

    return () => clearTimeout(timer);
  }, [currentCall, autoAnswer, effectiveDnd, onAnswerCall]);

  const renderMainPanel = () => {
    switch (activeNav) {
      case 'dashboard':
        return (
          <DeskDashboardPanel
            extensions={extensions}
            calls={calls}
            requests={requests}
            currentCall={currentCall}
            isVoiceConnected={isVoiceConnected}
            voiceError={voiceError}
            onDial={handleDial}
            onNavChange={setActiveNav}
            dnd={effectiveDnd}
          />
        );
      case 'recents':
        return (
          <DeskRecentsPanel
            calls={calls}
            extensions={extensions}
            onDial={handleDial}
          />
        );
      case 'rooms':
        return (
          <DeskRoomsPanel
            extensions={extensions}
            currentCall={Boolean(currentCall)}
            onDial={handleDial}
            dnd={effectiveDnd}
          />
        );
      case 'requests':
        return (
          <DeskRequestsPanel
            requests={requests}
            onUpdateStatus={onUpdateRequestStatus}
          />
        );
      case 'settings':
        return (
          <DeskSettingsPanel
            notificationPermission={notificationPermission}
            onRequestNotifications={onRequestNotifications}
            isVoiceConnected={isVoiceConnected}
            voiceError={voiceError}
            onServerSetup={onServerSetup}
            onApplyAudio={onApplyAudio}
          />
        );
      case 'keypad':
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-desk-surface select-none overflow-hidden">
      <DeskTopBar
        autoAnswer={autoAnswer}
        dnd={effectiveDnd}
        onToggleAutoAnswer={handleToggleAutoAnswer}
        onToggleDnd={handleToggleDnd}
        operatorStatus={operatorStatus}
        onStatusChange={handleStatusChange}
        isRegistered={deskOnline}
      />

      {/* Desktop layout: sidebar + dialer (keypad only) + main */}
      <div className="hidden lg:flex flex-1 min-h-0">
        <DeskSidebar
          activeNav={activeNav}
          onNavChange={setActiveNav}
          pendingRequests={pendingRequests}
        />

        {activeNav === 'keypad' && (
          <div className="w-full min-w-[280px] max-w-[min(380px,35vw)] shrink-0 border-r border-slate-200 flex flex-col min-h-0 bg-white">
            <div className="flex-1 min-h-0">
              <DeskDialer
                key={dialSeed}
                onCall={handleDial}
                disabled={effectiveDnd}
                initialValue={dialSeed}
              />
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 p-5 overflow-y-auto flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            {activeNav === 'keypad' ? (
              <DeskRecentsPanel
                calls={calls}
                extensions={extensions}
                onDial={handleDial}
              />
            ) : (
              renderMainPanel()
            )}
          </div>
        </div>
      </div>

      {/* Tablet layout: sidebar + main */}
      <div className="hidden md:flex lg:hidden flex-1 min-h-0 flex-col">
        <div className="flex flex-1 min-h-0">
          <DeskSidebar
            activeNav={activeNav}
            onNavChange={setActiveNav}
            pendingRequests={pendingRequests}
          />
          <div className="flex-1 min-h-0 p-5 overflow-y-auto flex flex-col gap-5">
            {activeNav === 'keypad' ? (
              <div className="flex flex-1 min-h-0 gap-4 flex-row short-landscape:flex-col">
                <div className="w-full min-w-[260px] max-w-[min(340px,40vw)] shrink-0 bg-white rounded-2xl desk-shadow-card overflow-hidden short-landscape:max-w-none">
                  <DeskDialer onCall={handleDial} disabled={effectiveDnd} />
                </div>
                <div className="flex-1 min-h-0 min-w-0">
                  <DeskRecentsPanel calls={calls} extensions={extensions} onDial={handleDial} />
                </div>
              </div>
            ) : (
              renderMainPanel()
            )}
          </div>
        </div>
      </div>

      {/* Mobile layout: single panel + bottom nav (side nav in landscape) */}
      <div className="flex md:hidden flex-1 min-h-0 flex-col landscape:flex-row">
        <DeskSidebar
          activeNav={activeNav}
          onNavChange={setActiveNav}
          pendingRequests={pendingRequests}
          layout="side"
          className="hidden landscape:flex"
        />
        <div className="flex-1 min-h-0 p-4 landscape:p-3 overflow-y-auto flex flex-col safe-area-pb">
          {activeNav === 'keypad' && (
            <DeskDialer onCall={handleDial} disabled={effectiveDnd} />
          )}
          {activeNav !== 'keypad' && renderMainPanel()}
        </div>
        <DeskSidebar
          activeNav={activeNav}
          onNavChange={setActiveNav}
          pendingRequests={pendingRequests}
          layout="bottom"
          className="landscape:hidden"
        />
      </div>

      {isIncomingCall && currentCall && (
        <IncomingCallModal
          currentCall={currentCall}
          extensions={extensions}
          onAnswer={() => onAnswerCall(currentCall.callId)}
          onDecline={() => onDeclineCall(currentCall.callId)}
        />
      )}

      {isOutgoingRinging && currentCall && (
        <OutgoingCallModal
          currentCall={currentCall}
          extensions={extensions}
          onCancel={() => onHangupCall(currentCall.callId)}
        />
      )}

      {isConnectedCall && currentCall && (
        <InCallModal
          currentCall={currentCall}
          extensions={extensions}
          isMicMuted={isMicMuted}
          isSpeakerMuted={isSpeakerMuted}
          isOnHold={isOnHold}
          isVoiceConnected={isVoiceConnected}
          onToggleMic={onToggleMic}
          onToggleSpeaker={onToggleSpeaker}
          onToggleHold={onToggleHold}
          onHangup={() => onHangupCall(currentCall.callId)}
        />
      )}

      {showCallOverlay && currentCall && (
        <div className="md:hidden">
          <ActiveCallOverlay
            currentCall={currentCall}
            isMicMuted={isMicMuted}
            isSpeakerMuted={isSpeakerMuted}
            isOnHold={isOnHold}
            isVoiceConnected={isVoiceConnected}
            voiceError={voiceError}
            onToggleMic={onToggleMic}
            onToggleSpeaker={onToggleSpeaker}
            onToggleHold={onToggleHold}
            onHangup={() => onHangupCall(currentCall.callId)}
            onAnswer={() => onAnswerCall(currentCall.callId)}
            onDecline={() => onDeclineCall(currentCall.callId)}
            onShowKeypad={() => setActiveNav('keypad')}
          />
        </div>
      )}
    </div>
  );
}
