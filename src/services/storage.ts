import { CheckInRecord, AuthUser, GeoPoint } from '../types';
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  GeoPoint as FirestoreGeoPoint,
  Timestamp
} from 'firebase/firestore';

const STORAGE_CHECKINS_KEY = 'geocheckin_firestore_checkins';
const STORAGE_USER_KEY = 'geocheckin_firebase_auth_user';

// Pre-seeded high quality check-in records for immediate supervisor demoing
const SEED_CHECKINS: CheckInRecord[] = [
  {
    id: 'chk_seed_101',
    userId: 'usr_hermann_01',
    userEmail: 'hermanntalk@gmail.com',
    tripCode: 'INSPECT-0824-A',
    location: { latitude: 25.033964, longitude: 121.564468 }, // Taipei 101
    timestamp: new Date(Date.now() - 3600 * 1000 * 3.5).toISOString(),
    accuracy: 4.2,
    addressHint: 'Taipei 101 Tower Base, Xinyi District',
    deviceModel: 'Pixel 8 Pro (Android 15)'
  },
  {
    id: 'chk_seed_102',
    userId: 'usr_hermann_01',
    userEmail: 'hermanntalk@gmail.com',
    tripCode: 'INSPECT-0824-A',
    location: { latitude: 25.0385, longitude: 121.5583 }, // Sun Yat-sen Memorial Hall
    timestamp: new Date(Date.now() - 3600 * 1000 * 2.2).toISOString(),
    accuracy: 3.8,
    addressHint: 'SYS Memorial Hall, Renai Road',
    deviceModel: 'Pixel 8 Pro (Android 15)'
  },
  {
    id: 'chk_seed_103',
    userId: 'usr_hermann_01',
    userEmail: 'hermanntalk@gmail.com',
    tripCode: 'INSPECT-0824-A',
    location: { latitude: 25.0418, longitude: 121.5353 }, // Huashan 1914 Park
    timestamp: new Date(Date.now() - 3600 * 1000 * 1.1).toISOString(),
    accuracy: 5.1,
    addressHint: 'Huashan 1914 Creative Park, Zhongzheng',
    deviceModel: 'Pixel 8 Pro (Android 15)'
  },
  {
    id: 'chk_seed_104',
    userId: 'usr_hermann_01',
    userEmail: 'hermanntalk@gmail.com',
    tripCode: 'TRIP-NORTH-EXPRESS',
    location: { latitude: 25.0478, longitude: 121.5170 }, // Taipei Main Station
    timestamp: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    accuracy: 4.0,
    addressHint: 'Taipei Main Station Station Front',
    deviceModel: 'Pixel 8 Pro (Android 15)'
  },
  {
    id: 'chk_seed_105',
    userId: 'usr_agent_02',
    userEmail: 'field_agent_01@company.com',
    tripCode: 'ROUTE-METRO-99',
    location: { latitude: 35.6586, longitude: 139.7454 }, // Tokyo Tower
    timestamp: new Date(Date.now() - 3600 * 1000 * 4.5).toISOString(),
    accuracy: 6.0,
    addressHint: 'Tokyo Tower, Minato City',
    deviceModel: 'Samsung Galaxy S24 Ultra'
  },
  {
    id: 'chk_seed_106',
    userId: 'usr_agent_02',
    userEmail: 'field_agent_01@company.com',
    tripCode: 'ROUTE-METRO-99',
    location: { latitude: 35.6595, longitude: 139.7004 }, // Shibuya Crossing
    timestamp: new Date(Date.now() - 3600 * 1000 * 2.8).toISOString(),
    accuracy: 3.5,
    addressHint: 'Shibuya Crossing Hachiko Exit',
    deviceModel: 'Samsung Galaxy S24 Ultra'
  },
  {
    id: 'chk_seed_107',
    userId: 'usr_agent_02',
    userEmail: 'field_agent_01@company.com',
    tripCode: 'ROUTE-METRO-99',
    location: { latitude: 35.6895, longitude: 139.6917 }, // Shinjuku
    timestamp: new Date(Date.now() - 3600 * 1000 * 1.4).toISOString(),
    accuracy: 4.8,
    addressHint: 'Tokyo Metropolitan Govt, Shinjuku',
    deviceModel: 'Samsung Galaxy S24 Ultra'
  }
];

export const StorageService = {
  // Authentication methods
  getCurrentUser(): AuthUser | null {
    try {
      const stored = localStorage.getItem(STORAGE_USER_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    // Default logged-in user Hermann for smooth testing
    const defaultUser: AuthUser = {
      uid: 'usr_hermann_01',
      email: 'hermanntalk@gmail.com',
      displayName: 'Hermann (Inspector)'
    };
    this.setCurrentUser(defaultUser);
    return defaultUser;
  },

  setCurrentUser(user: AuthUser | null): void {
    if (user) {
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_USER_KEY);
    }
  },

  // Firestore Check-ins CRUD
  getAllCheckIns(): CheckInRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_CHECKINS_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_CHECKINS_KEY, JSON.stringify(SEED_CHECKINS));
        return SEED_CHECKINS;
      }
      return JSON.parse(raw);
    } catch {
      return SEED_CHECKINS;
    }
  },

  getUserRecentCheckIns(userId: string, limitCount = 5): CheckInRecord[] {
    const all = this.getAllCheckIns();
    return all
      .filter(item => item.userId === userId || item.userEmail === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limitCount);
  },

  getUserSummary(userId: string, userEmail: string): { uniqueTripCodesCount: number; totalCheckInsCount: number; tripCodes: string[] } {
    const all = this.getAllCheckIns();
    const userRecords = all.filter(item => item.userId === userId || item.userEmail === userEmail);
    const uniqueCodes: string[] = Array.from(new Set(userRecords.map(item => item.tripCode.trim()).filter(Boolean)));
    return {
      uniqueTripCodesCount: uniqueCodes.length,
      totalCheckInsCount: userRecords.length,
      tripCodes: uniqueCodes
    };
  },

  async addCheckIn(record: {
    userId: string;
    userEmail: string;
    tripCode: string;
    location: GeoPoint;
    accuracy?: number;
    addressHint?: string;
  }): Promise<CheckInRecord> {
    const timestampStr = new Date().toISOString();
    const newRecord: CheckInRecord = {
      id: 'chk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId: record.userId,
      userEmail: record.userEmail,
      tripCode: record.tripCode.trim(),
      location: record.location,
      timestamp: timestampStr,
      accuracy: record.accuracy || 4.5,
      addressHint: record.addressHint || `Coordinates: ${record.location.latitude.toFixed(5)}, ${record.location.longitude.toFixed(5)}`,
      deviceModel: 'Android Device (Jetpack Compose)'
    };

    // 1. Sync locally for instant UI response & offline support
    const all = this.getAllCheckIns();
    all.unshift(newRecord);
    localStorage.setItem(STORAGE_CHECKINS_KEY, JSON.stringify(all));

    // 2. Write to live Cloud Firestore (geotrack-8e9b4)
    try {
      const checkinsRef = collection(db, 'checkins');
      await addDoc(checkinsRef, {
        userId: record.userId,
        userEmail: record.userEmail,
        tripCode: record.tripCode.trim(),
        location: new FirestoreGeoPoint(record.location.latitude, record.location.longitude),
        timestamp: serverTimestamp(),
        accuracy: record.accuracy || 4.5,
        addressHint: newRecord.addressHint,
        deviceModel: 'Android (com.hh.geotrack)'
      });
      console.log('Successfully written to Cloud Firestore collection [checkins]');
    } catch (err) {
      console.warn('Firestore live write notice (offline or rules fallback):', err);
    }

    return newRecord;
  },

  searchCheckIns(userEmailQuery: string, tripCodeQuery: string): CheckInRecord[] {
    const all = this.getAllCheckIns();
    const cleanEmail = userEmailQuery.trim().toLowerCase();
    const cleanTripCode = tripCodeQuery.trim().toLowerCase();

    return all.filter(record => {
      const matchEmail = !cleanEmail || record.userEmail.toLowerCase().includes(cleanEmail);
      const matchTrip = !cleanTripCode || record.tripCode.toLowerCase().includes(cleanTripCode);
      return matchEmail && matchTrip;
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()); // chronological for route visualization
  },

  resetDemoData(): void {
    localStorage.setItem(STORAGE_CHECKINS_KEY, JSON.stringify(SEED_CHECKINS));
  }
};

