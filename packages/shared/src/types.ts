export interface SIPExtension {
  extension: string;
  name: string;
  status: 'online' | 'offline' | 'busy' | 'ringing';
  clientType: 'guest' | 'staff' | 'front_desk';
  lastSeen: Date;
  ip: string;
  /** Front desk / staff: reject inbound calls when true. */
  dnd?: boolean;
}

export interface SIPMessage {
  id: string;
  timestamp: string;
  direction: 'sent' | 'received';
  raw: string;
  type: 'REGISTER' | 'INVITE' | 'TRYING' | 'RINGING' | 'OK' | 'BYE' | 'ACK' | 'CANCEL' | 'MESSAGE';
}

export interface GuestRequest {
  id: string;
  roomNumber: string;
  requestType: 'towels' | 'water' | 'cleanup' | 'laundry' | 'wakeup' | 'other';
  customText?: string;
  status: 'pending' | 'processing' | 'done';
  timestamp: string;
}

export interface CallRecord {
  id: string;
  fromExt: string;
  fromName: string;
  toExt: string;
  toName: string;
  status: 'completed' | 'missed' | 'busy' | 'rejected' | 'failed';
  duration: number;
  timestamp: string;
}

export interface PBXState {
  extensions: SIPExtension[];
  calls: CallRecord[];
  requests: GuestRequest[];
}

export interface CallMetadata {
  callId: string;
  fromExt: string;
  fromName: string;
  toExt: string;
  toName: string;
  status: 'ringing' | 'connected';
}
