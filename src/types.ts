export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface CheckInRecord {
  id: string;
  userId: string;
  userEmail: string;
  tripCode: string;
  location: GeoPoint;
  timestamp: string; // ISO string representation of ServerTimestamp
  accuracy?: number;
  addressHint?: string;
  deviceModel?: string;
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
}

export type NavigationTab = 'checkin' | 'map' | 'profile';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface AndroidSourceFile {
  path: string;
  name: string;
  category: 'compose_ui' | 'navigation' | 'data' | 'webview' | 'gradle_manifest';
  description: string;
  language: 'kotlin' | 'xml' | 'html' | 'gradle';
  content: string;
}
