import React, { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { 
  Phone, PhoneOff, PhoneCall, Volume2, VolumeX, Mic, MicOff, 
  HelpCircle, Coffee, ShowerHead, Sparkles, Wrench, AlertTriangle, 
  Clock, Check, Layers, History, ChevronRight, MessageSquare, Hand
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
} from "@hotel-voip/shared";
import { useGuestConfirm } from "../hooks/useGuestConfirm";
import { useAdminPin } from "../hooks/useAdminPin";
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
  const { confirm, dialog } = useGuestConfirm();
  const { requirePin, pinDialog } = useAdminPin();
  const [dialNumber, setDialNumber] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"intercom" | "requests">("intercom");
  
  // Custom quick response items
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestNotes, setRequestNotes] = useState("");
  const [selectedReqType, setSelectedReqType] = useState<GuestRequest['requestType']>("towels");
  
  const [showDialer, setShowDialer] = useState(false);

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

  // Dial pad buttons click handler
  const handleDialClick = (char: string) => {
    if (dialNumber.length < 5) {
      setDialNumber((prev) => prev + char);
      telephonyAudio.playDTMF(char);
    }
  };

  const handleDialBackspace = () => {
    setDialNumber((prev) => prev.slice(0, -1));
    telephonyAudio.playDTMF("*");
  };

  const handleCall = (toExtension: string) => {
    if (!toExtension) return;
    onInitiateCall(toExtension);
    setDialNumber("");
    setShowDialer(false);
  };

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

  // Ending or declining a call is a single tap — no confirmation dialog, so it
  // works even while the full-screen call screen is on top.
  const handleDeclineWithConfirm = (callId: string) => {
    onDeclineCall(callId);
  };

  const handleHangupWithConfirm = (callId: string) => {
    onHangupCall(callId);
  };

  const handleUnlinkWithConfirm = async (skipPin = false) => {
    if (isNative && !skipPin) {
      const pinOk = await requirePin();
      if (!pinOk) return;
    }
    const ok = await confirm({
      title: "Unlink this tablet?",
      message: `Unregister Room ${roomNum} from the hotel VoIP system? You will need to enter the room number again.`,
      confirmLabel: "Yes, Unlink",
      cancelLabel: "No",
      variant: "danger",
    });
    if (ok) onUnregister();
  };

  const handleAdminAccess = async () => {
    const pinOk = await requirePin();
    if (pinOk) setShowAdminMenu(true);
  };

  const handleAdminUnlink = () => {
    setShowAdminMenu(false);
    void handleUnlinkWithConfirm(true);
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
      const pinOk = await requirePin();
      if (!pinOk) return;
      const ok = await confirm({
        title: "Unpin this app?",
        message:
          "Only staff can unpin. Guests cannot permanently leave while pinned — the app returns automatically.",
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
          "Locks the tablet in kiosk mode. If guests use Back+Overview, the app will return and re-pin automatically. Only staff PIN can unpin.",
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
            <h1 className="text-xl font-bold text-slate-900 text-center">Connecting Room {roomNum}</h1>
            <p className="text-slate-500 text-xs mt-2 text-center">Registering with hotel VoIP server…</p>
          </div>
        </div>
      );
    }

    return (
      <div
        id="guest-sub-lobby"
        className={`bg-white h-full p-8 flex flex-col items-center justify-center relative overflow-hidden select-none ${
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

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 shadow-sm w-full max-w-sm">
          <label className="block text-[11px] font-sans font-bold text-slate-500 mb-2 uppercase tracking-wider text-center">
            ROOM NUMBER (GUEST ROOM NO.)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Example: 304, 502"
              value={roomNum}
              onChange={(e) => setRoomNum(e.target.value.replace(/[^0-9]/g, ""))}
              className="flex-1 px-4 py-2.5 text-lg text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-center font-sans font-semibold shadow-sm"
            />
            <button
              onClick={() => onRegister(roomNum)}
              disabled={!roomNum}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-sans text-sm font-semibold rounded-xl hover:shadow-md transition-all active:scale-95"
            >
              Start
            </button>
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-3 text-center">
            SIP Protocol port 5060 TCP/UDP • Local Intranet
          </p>
        </div>
        {dialog}
        {pinDialog}
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
            onDecline={() => void handleDeclineWithConfirm(currentCall.callId)}
          />
        )}

      {currentCall &&
        currentCall.fromExt === roomNum &&
        currentCall.status === "ringing" && (
          <OutgoingCallScreen
            peerName={currentCall.toName}
            peerExt={currentCall.toExt}
            onCancel={() => void handleHangupWithConfirm(currentCall.callId)}
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
          onHangup={() => void handleHangupWithConfirm(currentCall.callId)}
        />
      )}

      {/* Unified header: room info + tabs + clock */}
      <div className="bg-white px-4 sm:px-5 py-3 border-b border-slate-100 shrink-0 select-none">
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className="flex items-center gap-3 min-w-0 flex-1"
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

          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("intercom")}
              className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 border ${
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
              className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 border ${
                activeTab === "requests"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Requests</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="bg-slate-100 font-bold text-base sm:text-lg px-3 py-2 rounded-xl text-slate-700 tabular-nums shadow-sm">
              {clockTime}
            </span>
            {isNative ? (
              <button
                type="button"
                onClick={() => void handleAdminAccess()}
                className="text-xs sm:text-sm font-bold uppercase px-3 py-2 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-colors"
              >
                Admin
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
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 bg-white">
        
        {/* Left Side Content (Services / Action area) */}
        <div className="flex-1 p-4 flex flex-col min-h-0 overflow-y-auto">
          {/* INTERCOM VIEW TAB */}
          {activeTab === "intercom" && (
            <div className="flex-1 flex flex-col justify-between gap-4">
              
              {/* SPEED DIAL GRID */}
              <div>
                <h5 className="text-[10px] font-sans font-bold text-slate-400 mb-3.5 uppercase tracking-widest text-center">
                  Speed Dial — Reception & Services
                </h5>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Front Desk Button */}
                  <button
                    onClick={() => handleCall("000")}
                    className="p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-sm border border-indigo-700 flex flex-col items-center justify-center gap-2 transition-all group active:scale-95"
                  >
                    <div className="bg-white/10 p-2.5 rounded-xl group-hover:scale-105 transition-transform flex items-center justify-center">
                      <PhoneCall className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-bold tracking-tight">FRONT DESK</span>
                    <span className="text-[10px] text-indigo-200 font-medium">Ext 000 (Reception)</span>
                  </button>

                  {/* Housekeeping */}
                  <button
                    onClick={() => handleCall("101")}
                    className="p-4 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 cursor-pointer hover:shadow-md transition-shadow active:scale-95"
                  >
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600">
                      <ShowerHead className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold tracking-tight">HOUSEKEEPING</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Ext 101</span>
                  </button>

                  {/* Room Service / Food */}
                  <button
                    onClick={() => handleCall("102")}
                    className="p-4 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 cursor-pointer hover:shadow-md transition-shadow active:scale-95"
                  >
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600">
                      <Coffee className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold tracking-tight">ROOM SERVICE</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Ext 102</span>
                  </button>

                  {/* Laundry */}
                  <button
                    onClick={() => handleCall("103")}
                    className="p-4 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 cursor-pointer hover:shadow-md transition-shadow active:scale-95"
                  >
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600">
                      <Layers className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold tracking-tight">LAUNDRY</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Ext 103</span>
                  </button>

                  {/* Maintenance */}
                  <button
                    onClick={() => handleCall("104")}
                    className="p-4 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 cursor-pointer hover:shadow-md transition-shadow active:scale-95"
                  >
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold tracking-tight">MAINTENANCE</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Ext 104</span>
                  </button>

                  {/* Emergency Trigger */}
                  <button
                    onClick={() => void handleEmergencyCall()}
                    className="p-4 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-2xl border border-rose-100/80 shadow-sm flex flex-col items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-sm shadow-rose-200">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold tracking-tight text-rose-700">EMERGENCY</span>
                    <span className="text-[10px] text-rose-500 font-bold uppercase">Ext 911</span>
                  </button>
                </div>
              </div>

              {/* DIALPAD DRAWER TOGGLER */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                {!showDialer ? (
                  <button
                    onClick={() => setShowDialer(true)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <span>Enter Extension Number (Keyboard Dialer)</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center max-w-xs mx-auto animate-fadeIn gap-3">
                    <div className="w-full flex items-center justify-between border-b pb-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                        Intercom Dialpad
                      </span>
                      <button
                        onClick={() => setShowDialer(false)}
                        className="text-xs text-rose-500 font-bold hover:underline"
                      >
                        Close
                      </button>
                    </div>

                    {/* Dialer Screen */}
                    <div className="w-full bg-white border border-slate-200 shadow-inner px-3 py-2 text-right rounded-lg min-h-[46px] flex items-center justify-end">
                      <span className="text-xl font-mono font-bold text-slate-800 tracking-widest leading-none">
                        {dialNumber || <span className="text-slate-300 text-sm font-mono tracking-normal capitalize font-normal">Dial Extension</span>}
                      </span>
                    </div>

                    {/* Numeric Grid */}
                    <div className="grid grid-cols-3 gap-2 w-full">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleDialClick(num)}
                          className="py-2 hover:bg-sky-50 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-700 hover:border-sky-200 active:scale-95 transition-all shadow-sm"
                        >
                          {num}
                        </button>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2 w-full mt-1.5">
                      <button
                        type="button"
                        onClick={handleDialBackspace}
                        disabled={!dialNumber}
                        className="py-2 text-[11px] font-bold bg-slate-100 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                      >
                        Backspace
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCall(dialNumber)}
                        disabled={!dialNumber}
                        className="py-2 text-[11px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed hover:shadow transition-all flex items-center justify-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CUSTOM ROOM REQUESTS TAB */}
          {activeTab === "requests" && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-3.5 text-slate-700 text-xs">
                <p className="font-bold flex items-center gap-1.5 text-indigo-900">
                  <Hand className="w-4 h-4" />
                  <span>Need Service or Supplies?</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Select what you need below. Our local server will send it directly to the Front Desk and log it as a SIP MESSAGE packet.
                </p>
              </div>

              {/* QUICK REQ TYPE PICKER */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {requestCatalog.map((catalog) => {
                  const IconComp = catalog.icon;
                  return (
                    <button
                      key={catalog.type}
                      type="button"
                      onClick={() => setSelectedReqType(catalog.type as any)}
                      className={`p-2 border rounded-xl flex items-center gap-2 select-none text-left transition-all ${
                        selectedReqType === catalog.type
                          ? "ring-2 ring-indigo-500 bg-indigo-50 text-indigo-900 border-indigo-300 font-bold"
                          : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      <span className={`p-1.5 rounded-lg border ${selectedReqType === catalog.type ? "bg-indigo-100/50" : "bg-slate-50"}`}>
                        <IconComp className="w-4 h-4 text-indigo-600" />
                      </span>
                      <span className="text-[11px] leading-tight font-medium truncate sm:whitespace-normal">
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

              {/* REQUEST SUBMISSION FORM */}
              <form onSubmit={handlePublishRequest} className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 space-y-3">
                <div>
                  <label className="block text-[11px] font-sans uppercase font-bold text-slate-400 mb-1 tracking-wider">
                    Additional details or instructions (Optional Note)
                  </label>
                  <input
                    type="text"
                    placeholder="E.g. Two towels, or wake me up at 6 AM."
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingRequest}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-300 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                  >
                    {isSubmittingRequest ? (
                      <span>Sending...</span>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
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
        <div className="w-full lg:w-72 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 p-4 flex flex-col justify-between shrink-0 min-h-[300px] lg:min-h-0 select-none">
          
          {/* ACTIVE CALL PANEL SCREEN Overlay */}
          {currentCall ? (
            <div className="flex-1 bg-slate-900 text-white rounded-xl p-4 flex flex-col justify-between overflow-hidden shadow-lg border border-slate-800 transition-all">
              
              {/* Call Status Title */}
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-1 text-[10px] font-mono uppercase font-extrabold text-[#fda4af] leading-none tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span>
                    {currentCall.status === "ringing" ? "SIP INVITING / RINGING" : "CONNECTED / ACTIVE CALL"}
                  </span>
                </div>
                
                <h6 className="text-[17px] font-bold text-slate-100 truncate max-w-full">
                  {currentCall.fromExt === roomNum ? currentCall.toName : currentCall.fromName}
                </h6>
                <p className="text-[11px] font-mono text-slate-400">
                  Room Extension: {currentCall.fromExt === roomNum ? currentCall.toExt : currentCall.fromExt}
                </p>
              </div>

              {/* CSS Pulse Waves Visualizer */}
              <div className="my-5 flex justify-center items-center h-16">
                {currentCall.status === "connected" ? (
                  <div className="flex items-end justify-center gap-1 h-12 w-full px-4">
                    <span className="w-1.5 bg-indigo-500 rounded-full animate-audio-bar-1 h-4" />
                    <span className="w-1.5 bg-violet-500 rounded-full animate-audio-bar-2 h-8" />
                    <span className="w-1.5 bg-emerald-550 bg-emerald-500 rounded-full animate-audio-bar-3 h-12" />
                    <span className="w-1.5 bg-indigo-505 bg-indigo-500 rounded-full animate-audio-bar-4 h-6" />
                    <span className="w-1.5 bg-indigo-500 rounded-full animate-audio-bar-2 h-9" />
                    <span className="w-1.5 bg-violet-400 rounded-full animate-audio-bar-3 h-11" />
                    <span className="w-1.5 bg-emerald-500 rounded-full animate-audio-bar-1 h-5" />
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center">
                    <div className="w-14 h-14 bg-indigo-550/20 bg-indigo-500/20 border border-indigo-500/40 rounded-full animate-ripple absolute" />
                    <div className="w-10 h-10 bg-indigo-500/40 rounded-full flex items-center justify-center">
                      <PhoneCall className="w-5 h-5 text-white animate-bounce" />
                    </div>
                  </div>
                )}
              </div>

              {/* Call timing duration / Answer screen if ringing-receiver */}
              <div className="space-y-4">
                {currentCall.status === "connected" && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-slate-500 uppercase">Live VoIP Audio (LiveKit)</span>
                      <span className={`w-2 h-2 rounded-full ${isVoiceConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
                    </div>
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Mic className={`w-4 h-4 ${isVoiceConnected ? "text-emerald-400" : "text-amber-400"}`} />
                      <span className={`text-xs font-bold ${isVoiceConnected ? "text-emerald-400" : "text-amber-300"}`}>
                        {isVoiceConnected ? "LIVE — Speak directly" : "Connecting audio..."}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-500 text-center leading-relaxed">
                      Real voice over the local network. No TTS — direct microphone and speaker.
                    </p>
                    {voiceError && (
                      <p className="text-[10px] text-rose-400 text-center">{voiceError}</p>
                    )}
                  </div>
                )}

                {currentCall.toExt === roomNum && currentCall.status === "ringing" ? (
                  // Incoming call - show Answer or Reject
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => void handleDeclineWithConfirm(currentCall.callId)}
                      className="py-2 px-3 bg-rose-650 hover:bg-rose-750 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                    <button
                      onClick={() => onAnswerCall(currentCall.callId)}
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow blink-emerald"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Answer</span>
                    </button>
                  </div>
                ) : (
                  // Outgoing call or Active call
                  <div className="space-y-2">
                    {currentCall.status === "connected" && (
                      <div className="flex justify-center gap-6 py-2 border-t border-b border-slate-800">
                        <button
                          type="button"
                          onClick={onToggleMic}
                          className="flex flex-col items-center gap-1"
                        >
                          <span
                            className={`p-2.5 rounded-full border transition-all ${
                              isMicMuted
                                ? "bg-red-950/40 border-red-500/50 text-red-400"
                                : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                            }`}
                          >
                            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500 uppercase">
                            {isMicMuted ? "Unmute" : "Mute"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={onToggleSpeaker}
                          className="flex flex-col items-center gap-1"
                        >
                          <span
                            className={`p-2.5 rounded-full border transition-all ${
                              isSpeakerMuted
                                ? "bg-amber-950/40 border-amber-500/50 text-amber-400"
                                : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                            }`}
                          >
                            {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500 uppercase">
                            {isSpeakerMuted ? "Speaker Off" : "Speaker"}
                          </span>
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => void handleHangupWithConfirm(currentCall.callId)}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-sans transition-all flex items-center justify-center gap-1.5 shadow"
                    >
                      <PhoneOff className="w-4 h-4" />
                      <span>Hang Up</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // STATIC NO-CALL PLACEHOLDER
            <div className="flex-1 flex flex-col justify-between min-h-0">
              
              {/* Request Status Monitor */}
              <div>
                <h6 className="text-[10px] font-mono font-bold text-slate-400 mb-2 uppercase tracking-widest flex items-center gap-1">
                  <History className="w-3.5 h-3.5" />
                  <span>Current Requests</span>
                </h6>

                <div className="space-y-2 overflow-y-auto max-h-[160px] pr-1">
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
              <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-400 font-mono space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold uppercase tracking-wider">SIP REGISTER INFO</span>
                </div>
                <p className="leading-normal">
                  The IP-PBX ringer signal runs on the local network. No Internet connection required.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      {dialog}
      {pinDialog}
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
