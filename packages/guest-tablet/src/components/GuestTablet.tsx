import React, { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { 
  Phone, PhoneOff, PhoneCall, 
  HelpCircle, Coffee, ShowerHead, Sparkles, Wrench, AlertTriangle, 
  Clock, Check, Layers, History, MessageSquare, Hand
} from "lucide-react";
import {
  telephonyAudio,
  useCallTelephonySounds,
  SIPExtension,
  GuestRequest,
  CallMetadata,
  getRetroHandsetMode,
  setRetroHandsetMode,
  subscribeRetroHandsetMode,
  getRoomGreeting,
} from "@hotel-voip/shared";
import { useGuestConfirm } from "../hooks/useGuestConfirm";
import { isKioskPinned, setKioskPinned } from "../utils/guestStorage";
import {
  enableKioskMode,
  disableKioskMode,
  openSecuritySettings,
  getKioskStatus,
} from "../utils/nativeTablet";
import KioskHelpDialog from "./KioskHelpDialog";
import ConnectionBanner from "./ConnectionBanner";
import AdminMenuDialog from "./AdminMenuDialog";
import BatteryOptimizationBanner from "./BatteryOptimizationBanner";
import IncomingCallScreen from "./IncomingCallScreen";
import OutgoingCallScreen from "./OutgoingCallScreen";
import InCallScreen from "./InCallScreen";
import type { GuestConnectionStatus } from "../hooks/useGuestPbx";
import { isAndroidNative, playHangupSound } from "../utils/callAudio";

interface GuestTabletProps {
  allExtensions: SIPExtension[];
  currentCall: CallMetadata | null;
  onInitiateCall: (toExt: string) => void;
  onHangupCall: (callId: string) => void;
  onAnswerCall: (callId: string) => void;
  onDeclineCall: (callId: string) => void;
  onSendRequest: (type: GuestRequest['requestType'], customText?: string) => Promise<void>;
  requests: GuestRequest[];
  roomNum: string;
  setRoomNum: (room: string) => void;
  isRegistered: boolean;
  isAutoRegistering?: boolean;
  connectionStatus?: GuestConnectionStatus;
  serverUrl?: string;
  onRegister: (room: string) => void;
  onUnregister: () => void;
  onAdminServerSetup?: () => void;
  isVoiceConnected?: boolean;
  voiceError?: string | null;
  isMicMuted?: boolean;
  isSpeakerMuted?: boolean;
  onToggleMic?: () => void;
  onToggleSpeaker?: () => void;
}

export default function GuestTablet({
  allExtensions,
  currentCall,
  onInitiateCall,
  onHangupCall,
  onAnswerCall,
  onDeclineCall,
  onSendRequest,
  requests,
  roomNum,
  setRoomNum,
  isRegistered,
  isAutoRegistering = false,
  connectionStatus = "connecting",
  serverUrl = "",
  onRegister,
  onUnregister,
  onAdminServerSetup,
  isVoiceConnected = false,
  voiceError = null,
  isMicMuted = false,
  isSpeakerMuted = false,
  onToggleMic = () => {},
  onToggleSpeaker = () => {},
}: GuestTabletProps) {
  const isNative = Capacitor.isNativePlatform();
  const { confirm, dismissPending, dialog } = useGuestConfirm();
  const [activeTab, setActiveTab] = useState<"intercom" | "requests">("intercom");
  
  // Custom quick response items
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestNotes, setRequestNotes] = useState("");
  const [selectedReqType, setSelectedReqType] = useState<GuestRequest['requestType']>("towels");

  const [clockTime, setClockTime] = useState("");
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [retroHandset, setRetroHandset] = useState(() => getRetroHandsetMode());
  const [kioskPinned, setKioskPinnedState] = useState(() => isNative && isKioskPinned());
  const [kioskLockActive, setKioskLockActive] = useState(false);
  const [screenPinningEnabled, setScreenPinningEnabled] = useState<boolean | undefined>(undefined);
  const [deviceOwner, setDeviceOwner] = useState(false);
  const [showKioskHelp, setShowKioskHelp] = useState(false);
  const longPressTimerRef = React.useRef<number | null>(null);

  const serverHost = (() => {
    if (!serverUrl) return "Not configured";
    try {
      return new URL(serverUrl).host;
    } catch {
      return serverUrl;
    }
  })();

  // Clock ticking
  useEffect(() => subscribeRetroHandsetMode(setRetroHandset), []);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isNative || !kioskPinned) return;
    void getKioskStatus().then((status) => {
      setKioskLockActive(status.lockTaskActive);
      setScreenPinningEnabled(status.screenPinningEnabled);
    });
  }, [isNative, kioskPinned]);

  const applyKioskStatus = (status: Awaited<ReturnType<typeof enableKioskMode>>) => {
    setKioskLockActive(status.lockTaskActive);
    setScreenPinningEnabled(status.screenPinningEnabled);
    setDeviceOwner(Boolean(status.deviceOwner));
  };

  const handleRetryKioskPin = async () => {
    const status = await enableKioskMode();
    applyKioskStatus(status);
    if (status.lockTaskActive) {
      setShowKioskHelp(false);
    }
  };

  const handleAdminRetryPin = async () => {
    setShowAdminMenu(false);
    await handleRetryKioskPin();
    setShowKioskHelp(true);
  };

  const requestCatalog = [
    { type: "towels" as const, label: "Extra Towels", icon: ShowerHead, bg: "bg-amber-100 text-amber-800 border-amber-200" },
    { type: "water" as const, label: "Bottled Water", icon: Coffee, bg: "bg-sky-100 text-sky-800 border-sky-200" },
    { type: "cleanup" as const, label: "Room Cleanup", icon: Sparkles, bg: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    { type: "laundry" as const, label: "Laundry Service", icon: Layers, bg: "bg-purple-100 text-purple-800 border-purple-200" },
    { type: "wakeup" as const, label: "Wake-up Call", icon: Clock, bg: "bg-blue-100 text-blue-800 border-blue-200" },
    { type: "other" as const, label: "Other Requests", icon: HelpCircle, bg: "bg-slate-100 text-slate-800 border-slate-200" },
  ];

  const handleCall = (toExtension: string) => {
    if (!toExtension) return;
    onInitiateCall(toExtension);
  };

  const frontDeskExt = allExtensions.find((ex) => ex.extension === "000");
  const frontDeskUnavailable =
    frontDeskExt?.status === "offline" || Boolean(frontDeskExt?.dnd);
  const frontDeskUnavailableLabel = frontDeskExt?.dnd
    ? "Do Not Disturb"
    : frontDeskExt?.status === "offline"
      ? "Offline"
      : null;

  const handleEmergencyCall = async () => {
    const ok = await confirm({
      title: "Call Emergency?",
      message: "This will immediately dial Ext 911 (Emergency). Continue?",
      confirmLabel: "Yes, Call 911",
      cancelLabel: "No",
      variant: "danger",
    });
    if (ok) handleCall("911");
  };

  // Ending or declining a call is a single tap — no confirmation dialog.
  const handleDecline = (callId: string) => {
    onDeclineCall(callId);
  };

  const handleHangup = (callId: string) => {
    onHangupCall(callId);
  };

  const isCallActive =
    currentCall?.status === "ringing" || currentCall?.status === "connected";

  useEffect(() => {
    if (isCallActive) {
      dismissPending();
    }
  }, [isCallActive, currentCall?.callId, dismissPending]);

  const handleUnlinkWithConfirm = async () => {
    const ok = await confirm({
      title: "Unlink this tablet?",
      message: `Unregister Room ${roomNum} from the hotel VoIP system? You will need to enter the room number again.`,
      confirmLabel: "Yes, Unlink",
      cancelLabel: "No",
      variant: "danger",
    });
    if (ok) onUnregister();
  };

  const handleAdminAccess = () => {
    setShowAdminMenu(true);
  };

  const handleAdminUnlink = () => {
    setShowAdminMenu(false);
    void handleUnlinkWithConfirm();
  };

  const handleToggleRetroHandset = () => {
    setRetroHandsetMode(!retroHandset);
  };

  const handleAdminServerSetup = () => {
    setShowAdminMenu(false);
    onAdminServerSetup?.();
  };

  const handleToggleKioskPin = async () => {
    setShowAdminMenu(false);

    if (kioskPinned) {
      const ok = await confirm({
        title: "Unpin this app?",
        message:
          "Guests cannot permanently leave while pinned — the app returns automatically.",
        confirmLabel: "Yes, Unpin",
        cancelLabel: "No",
        variant: "danger",
      });
      if (!ok) return;
      disableKioskMode();
      setKioskPinned(false);
      setKioskPinnedState(false);
      setKioskLockActive(false);
    } else {
      const ok = await confirm({
        title: "Pin this app?",
        message:
          "Locks the tablet in kiosk mode. If guests use Back+Overview, the app will return and re-pin automatically.",
        confirmLabel: "Yes, Pin App",
        cancelLabel: "No",
      });
      if (!ok) return;
      const status = await enableKioskMode();
      setKioskPinned(true);
      setKioskPinnedState(true);
      applyKioskStatus(status);
      setShowKioskHelp(true);
    }
  };

  const startAdminLongPress = () => {
    if (!isNative || !onAdminServerSetup) return;
    longPressTimerRef.current = window.setTimeout(() => {
      void handleAdminAccess();
    }, 2000);
  };

  const cancelAdminLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleQuickRequestBtn = async (type: GuestRequest['requestType']) => {
    setSelectedReqType(type);
    setRequestNotes("");
    setActiveTab("requests");
  };

  const handlePublishRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const label =
      requestCatalog.find((r) => r.type === selectedReqType)?.label ?? selectedReqType;
    const ok = await confirm({
      title: "Submit this request?",
      message: `Send "${label}" request to the front desk for Room ${roomNum}?`,
      confirmLabel: "Yes, Submit",
      cancelLabel: "No",
    });
    if (!ok) return;
    setIsSubmittingRequest(true);
    await onSendRequest(selectedReqType, requestNotes);
    setIsSubmittingRequest(false);
    setRequestNotes("");
    telephonyAudio.playMessageReceipt();
  };

  useCallTelephonySounds(currentCall, roomNum, {
    delegateRingToNative: isAndroidNative,
    playHangup: playHangupSound,
  });

  // If not registered yet, display login lobby
  if (!isRegistered) {
    if (isAutoRegistering) {
      return (
        <div
          className={`bg-white h-full flex flex-col relative overflow-hidden select-none ${
            isNative ? "rounded-none border-0" : "rounded-3xl border border-slate-200/80 shadow-sm"
          }`}
        >
          <ConnectionBanner status={connectionStatus} />
          <div className="flex-1 p-8 flex flex-col items-center justify-center">
            <div className="mb-4 bg-indigo-50 text-indigo-600 p-4 rounded-full border border-indigo-100 shadow-sm animate-pulse">
              <Layers className="w-10 h-10" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">{getRoomGreeting(roomNum)}</h1>
            <p className="text-slate-500 text-sm sm:text-base mt-3 text-center">Registering with hotel VoIP server…</p>
          </div>
        </div>
      );
    }

    return (
      <div
        id="guest-sub-lobby"
        className={`bg-white h-full p-6 landscape:p-4 flex flex-col items-center justify-center relative overflow-hidden select-none ${
          isNative ? "rounded-none border-0" : "rounded-3xl border border-slate-200/80 shadow-sm"
        }`}
      >
        {/* Visual elements */}
        <div className="absolute top-0 inset-x-0 h-2 bg-indigo-650 bg-indigo-600" />
        <div className="mb-4 bg-indigo-50 text-indigo-600 p-4 rounded-full border border-indigo-100 shadow-sm">
          <Layers className="w-10 h-10" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 text-center font-sans tracking-tight">VIRTUAL GUEST TABLET</h1>
        <p className="text-slate-500 text-xs max-w-sm text-center font-sans mt-2 mb-6 leading-relaxed">
          Please enter your room number to register the VoIP SIP extension.
        </p>

        <div className="bg-slate-50 p-5 landscape:p-4 rounded-2xl border border-slate-200/60 shadow-sm w-full max-w-md mx-auto landscape:max-w-lg">
          <label className="block text-[11px] font-sans font-bold text-slate-500 mb-2 uppercase tracking-wider text-center">
            ROOM NUMBER (GUEST ROOM NO.)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="number"
              placeholder="Example: 304, 502"
              value={roomNum}
              onChange={(e) => setRoomNum(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full sm:flex-1 min-w-0 px-4 py-2.5 text-lg text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-center font-sans font-semibold shadow-sm"
            />
            <button
              onClick={() => onRegister(roomNum)}
              disabled={!roomNum}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-sans text-sm font-semibold rounded-xl hover:shadow-md transition-all active:scale-95"
            >
              Start
            </button>
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-3 text-center">
            SIP Protocol port 5060 TCP/UDP • Local Intranet
          </p>
        </div>
        {dialog}
      </div>
    );
  }

  return (
    <div
      id="guest-sub-lobby-active"
      className={`bg-slate-50 text-slate-900 overflow-hidden flex flex-col h-full relative font-sans ${
        isNative ? "rounded-none border-0 shadow-none" : "rounded-3xl border border-slate-200 shadow-lg"
      }`}
    >
      <ConnectionBanner status={connectionStatus} />
      <BatteryOptimizationBanner isRegistered={isRegistered} />

      {currentCall &&
        currentCall.toExt === roomNum &&
        currentCall.status === "ringing" && (
          <IncomingCallScreen
            peerName={currentCall.fromName}
            peerExt={currentCall.fromExt}
            onAnswer={() => onAnswerCall(currentCall.callId)}
            onDecline={() => void handleDecline(currentCall.callId)}
          />
        )}

      {currentCall &&
        currentCall.fromExt === roomNum &&
        currentCall.status === "ringing" && (
          <OutgoingCallScreen
            peerName={currentCall.toName}
            peerExt={currentCall.toExt}
            onCancel={() => void handleHangup(currentCall.callId)}
          />
        )}

      {currentCall && currentCall.status === "connected" && (
        <InCallScreen
          peerName={
            currentCall.fromExt === roomNum ? currentCall.toName : currentCall.fromName
          }
          peerExt={
            currentCall.fromExt === roomNum ? currentCall.toExt : currentCall.fromExt
          }
          isMicMuted={isMicMuted}
          isSpeakerMuted={isSpeakerMuted}
          isVoiceConnected={isVoiceConnected}
          onToggleMic={onToggleMic}
          onToggleSpeaker={onToggleSpeaker}
          onHangup={() => void handleHangup(currentCall.callId)}
        />
      )}

      {/* Unified header: room info + tabs + clock */}
      <div className="bg-white px-4 sm:px-5 py-3 landscape:py-2 short:py-1.5 border-b border-slate-100 shrink-0 select-none safe-area-pt">
        <div className="flex items-center gap-3 sm:gap-4 landscape:gap-2 flex-wrap landscape:flex-nowrap">
          <div
            className="flex items-center gap-3 min-w-0 w-full sm:w-auto sm:flex-1 landscape:flex-1 order-1"
            onTouchStart={startAdminLongPress}
            onTouchEnd={cancelAdminLongPress}
            onTouchCancel={cancelAdminLongPress}
            onMouseDown={startAdminLongPress}
            onMouseUp={cancelAdminLongPress}
            onMouseLeave={cancelAdminLongPress}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                connectionStatus === "connected"
                  ? "bg-emerald-500 animate-pulse"
                  : connectionStatus === "connecting"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-rose-500"
              }`}
            />
            <div className="min-w-0">
              <h4 className="font-bold text-lg sm:text-xl text-slate-900 truncate leading-tight">
                Room {roomNum}
              </h4>
              <p className="text-xs sm:text-sm text-slate-400 truncate mt-0.5">
                Ext {roomNum} · {serverHost}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5 order-3 sm:order-2 landscape:order-2 landscape:flex-none w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab("intercom")}
              className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 border flex-1 sm:flex-none ${
                activeTab === "intercom"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Phone className="w-4 h-4" />
              <span>Intercom</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 border flex-1 sm:flex-none ${
                activeTab === "requests"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Requests</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0 order-2 sm:order-3">
            <span className="bg-slate-100 font-bold text-base sm:text-lg px-3 py-2 rounded-xl text-slate-700 tabular-nums shadow-sm">
              {clockTime}
            </span>
            {isNative ? (
              <button
                type="button"
                onClick={handleAdminAccess}
                className="text-xs sm:text-sm font-bold uppercase px-3 py-2 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-colors"
              >
                Settings
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleUnlinkWithConfirm()}
                className="text-xs sm:text-sm font-bold uppercase px-3 py-2 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-colors"
              >
                Unlink
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Container screen content split */}
      <div className="flex-1 flex flex-col portrait:lg:flex-row md:landscape:flex-row min-h-0 bg-white">
        
        {/* Left Side Content (Services / Action area) */}
        <div className="flex-1 p-4 flex flex-col min-h-0 overflow-y-auto">
          {/* INTERCOM VIEW TAB */}
          {activeTab === "intercom" && (
            <div className="flex-1 flex flex-col justify-between gap-4">
              
              {/* GREETING + SPEED DIAL GRID */}
              <div>
                <div className="text-center mb-5 px-2">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 leading-tight tracking-tight">
                    {getRoomGreeting(roomNum)}
                  </h2>
                  <p className="text-sm sm:text-base text-slate-400 mt-2 font-medium">
                    Ext {roomNum} · {serverHost}
                  </p>
                </div>

                <h5 className="text-sm sm:text-base font-sans font-bold text-slate-500 mb-4 uppercase tracking-widest text-center">
                  Speed Dial — Reception & Services
                </h5>
                
                <div className="grid grid-cols-2 md:grid-cols-3 landscape:grid-cols-3 gap-4 landscape:gap-2 [&>button]:landscape:p-3">
                  {/* Front Desk Button */}
                  <button
                    onClick={() => handleCall("000")}
                    disabled={frontDeskUnavailable}
                    className={`p-5 rounded-2xl shadow-sm border flex flex-col items-center justify-center gap-2.5 transition-all group active:scale-95 ${
                      frontDeskUnavailable
                        ? "bg-slate-200 text-slate-500 border-slate-200 cursor-not-allowed opacity-80"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700"
                    }`}
                  >
                    <div className={`p-3 rounded-xl transition-transform flex items-center justify-center ${
                      frontDeskUnavailable ? "bg-white/40" : "bg-white/10 group-hover:scale-105"
                    }`}>
                      <PhoneCall className={`w-6 h-6 ${frontDeskUnavailable ? "text-slate-500" : "text-white"}`} />
                    </div>
                    <span className="text-sm sm:text-base font-bold tracking-tight">FRONT DESK</span>
                    <span className={`text-xs sm:text-sm font-medium ${
                      frontDeskUnavailable ? "text-slate-500" : "text-indigo-200"
                    }`}>
                      {frontDeskUnavailableLabel ?? "Ext 000 (Reception)"}
                    </span>
                  </button>

                  {/* Housekeeping */}
                  <button
                    onClick={() => handleCall("101")}
                    className="p-5 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:shadow-md transition-shadow active:scale-95"
                  >
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600">
                      <ShowerHead className="w-6 h-6" />
                    </div>
                    <span className="text-sm sm:text-base font-bold tracking-tight">HOUSEKEEPING</span>
                    <span className="text-xs sm:text-sm text-slate-400 font-bold uppercase">Ext 101</span>
                  </button>

                  {/* Room Service / Food */}
                  <button
                    onClick={() => handleCall("102")}
                    className="p-5 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:shadow-md transition-shadow active:scale-95"
                  >
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600">
                      <Coffee className="w-6 h-6" />
                    </div>
                    <span className="text-sm sm:text-base font-bold tracking-tight">ROOM SERVICE</span>
                    <span className="text-xs sm:text-sm text-slate-400 font-bold uppercase">Ext 102</span>
                  </button>

                  {/* Laundry */}
                  <button
                    onClick={() => handleCall("103")}
                    className="p-5 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:shadow-md transition-shadow active:scale-95"
                  >
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600">
                      <Layers className="w-6 h-6" />
                    </div>
                    <span className="text-sm sm:text-base font-bold tracking-tight">LAUNDRY</span>
                    <span className="text-xs sm:text-sm text-slate-400 font-bold uppercase">Ext 103</span>
                  </button>

                  {/* Maintenance */}
                  <button
                    onClick={() => handleCall("104")}
                    className="p-5 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:shadow-md transition-shadow active:scale-95"
                  >
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600">
                      <Wrench className="w-6 h-6" />
                    </div>
                    <span className="text-sm sm:text-base font-bold tracking-tight">MAINTENANCE</span>
                    <span className="text-xs sm:text-sm text-slate-400 font-bold uppercase">Ext 104</span>
                  </button>

                  {/* Emergency Trigger */}
                  <button
                    onClick={() => void handleEmergencyCall()}
                    className="p-5 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-2xl border border-rose-100/80 shadow-sm flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-12 h-12 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-sm shadow-rose-200">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <span className="text-sm sm:text-base font-bold tracking-tight text-rose-700">EMERGENCY</span>
                    <span className="text-xs sm:text-sm text-rose-500 font-bold uppercase">Ext 911</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* CUSTOM ROOM REQUESTS TAB */}
          {activeTab === "requests" && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="border border-indigo-100 bg-indigo-50/40 rounded-2xl p-5 text-slate-700">
                <p className="font-bold flex items-center gap-2 text-indigo-900 text-base sm:text-lg">
                  <Hand className="w-5 h-5" />
                  <span>Need Service or Supplies?</span>
                </p>
                <p className="text-sm sm:text-base text-slate-500 mt-1.5 leading-relaxed">
                  Select what you need below. Our local server will send it directly to the Front Desk and log it as a SIP MESSAGE packet.
                </p>
              </div>

              {/* QUICK REQ TYPE PICKER */}
              <div>
                <h5 className="text-sm sm:text-base font-sans font-bold text-slate-500 mb-4 uppercase tracking-widest text-center">
                  Choose a Request
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-3 landscape:grid-cols-3 gap-4 landscape:gap-2 [&>button]:landscape:p-3">
                  {requestCatalog.map((catalog) => {
                    const IconComp = catalog.icon;
                    const isSelected = selectedReqType === catalog.type;
                    return (
                      <button
                        key={catalog.type}
                        type="button"
                        onClick={() => setSelectedReqType(catalog.type as any)}
                        className={`p-5 border rounded-2xl shadow-sm flex flex-col items-center justify-center gap-2.5 select-none transition-all active:scale-95 ${
                          isSelected
                            ? "ring-2 ring-indigo-500 bg-indigo-50 text-indigo-900 border-indigo-300"
                            : "bg-white hover:bg-slate-50 border-slate-100 text-slate-900 hover:shadow-md"
                        }`}
                      >
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            isSelected ? "bg-indigo-100 text-indigo-700" : "bg-slate-50 text-slate-600"
                          }`}
                        >
                          <IconComp className="w-6 h-6" />
                        </div>
                        <span className="text-sm sm:text-base font-bold tracking-tight text-center leading-tight">
                          {catalog.type === "towels" ? "Towels" :
                           catalog.type === "water" ? "Bottled Water" :
                           catalog.type === "cleanup" ? "Room Cleanup" :
                           catalog.type === "laundry" ? "Laundry" :
                           catalog.type === "wakeup" ? "Wake-up Call" : "Other"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* REQUEST SUBMISSION FORM */}
              <form onSubmit={handlePublishRequest} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-sans uppercase font-bold text-slate-400 mb-2 tracking-wider">
                    Additional details or instructions (Optional Note)
                  </label>
                  <input
                    type="text"
                    placeholder="E.g. Two towels, or wake me up at 6 AM."
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    className="w-full px-4 py-3 text-sm sm:text-base text-slate-800 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingRequest}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-300 text-sm sm:text-base font-bold rounded-xl transition-all flex items-center gap-2 active:scale-95"
                  >
                    {isSubmittingRequest ? (
                      <span>Sending...</span>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Submit Request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Side Content (Call Status / Requests Backlog tracker Sidebar) */}
        <div className="w-full portrait:lg:w-72 md:landscape:w-64 bg-slate-50 border-t portrait:lg:border-t-0 md:landscape:border-t-0 portrait:lg:border-l md:landscape:border-l border-slate-200 p-4 landscape:p-3 flex flex-col min-h-0 shrink-0 select-none">
          <div className="flex-1 flex flex-col min-h-0">
            {/* Request Status Monitor */}
            <div className="flex-1 flex flex-col min-h-0">
              <h6 className="text-[10px] font-mono font-bold text-slate-400 mb-2 uppercase tracking-widest flex items-center gap-1 shrink-0">
                <History className="w-3.5 h-3.5" />
                <span>Current Requests</span>
              </h6>

              <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
                {requests.filter(r => r.roomNumber === roomNum).length === 0 ? (
                  <div className="p-3 border border-dashed rounded-lg bg-white border-slate-200 text-center text-[10px] font-mono text-slate-400">
                    No active requests for this room.
                  </div>
                ) : (
                  requests.filter(r => r.roomNumber === roomNum).map((req) => {
                    let statusText = "Pending";
                    let statusColor = "bg-amber-500 text-white";
                    if (req.status === "processing") {
                      statusText = "Processing";
                      statusColor = "bg-blue-650 text-white";
                    } else if (req.status === "done") {
                      statusText = "Done!";
                      statusColor = "bg-emerald-600 text-white";
                    }

                    return (
                      <div key={req.id} className="p-2 border bg-white rounded-lg border-slate-200 text-[11px] font-sans flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-slate-700 uppercase">
                            {req.requestType === "towels" ? "Towels" :
                             req.requestType === "water" ? "Bottled Water" :
                             req.requestType === "cleanup" ? "Room Cleanup" :
                             req.requestType === "laundry" ? "Laundry" :
                             req.requestType === "wakeup" ? "Wake-up Call" : "Request"}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded-[4px] text-[8px] font-mono font-bold leading-none ${statusColor}`}>
                            {statusText}
                          </span>
                        </div>
                        {req.customText && (
                          <p className="text-slate-500 italic text-[10px] leading-tight">
                            "{req.customText}"
                          </p>
                        )}
                        <div className="text-[8px] font-mono text-slate-400 text-right">
                          {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Offline VoIP instruction notice block */}
            <div className="mt-3 landscape:mt-2 pt-3 landscape:pt-2 border-t border-slate-200 text-[10px] text-slate-400 font-mono space-y-1 shrink-0">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold uppercase tracking-wider">SIP REGISTER INFO</span>
              </div>
              <p className="leading-normal">
                The IP-PBX ringer signal runs on the local network. No Internet connection required.
              </p>
            </div>
          </div>
        </div>
      </div>
      {!isCallActive && dialog}
      <AdminMenuDialog
        open={showAdminMenu}
        kioskPinned={kioskPinned}
        kioskLockActive={kioskLockActive}
        retroHandset={retroHandset}
        onToggleRetroHandset={handleToggleRetroHandset}
        onServerSetup={handleAdminServerSetup}
        onToggleKioskPin={() => void handleToggleKioskPin()}
        onRetryKioskPin={() => void handleAdminRetryPin()}
        onUnlink={handleAdminUnlink}
        onCancel={() => setShowAdminMenu(false)}
      />
      <KioskHelpDialog
        open={showKioskHelp}
        lockTaskActive={kioskLockActive}
        deviceOwner={deviceOwner}
        screenPinningEnabled={screenPinningEnabled}
        onOpenSettings={() => {
          openSecuritySettings();
          setShowKioskHelp(false);
        }}
        onRetryPin={handleRetryKioskPin}
        onDismiss={() => setShowKioskHelp(false)}
      />
    </div>
  );
}
