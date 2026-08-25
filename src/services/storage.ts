import { CheckInRecord, AuthUser, GeoPoint } from '../types';
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
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
    tripCode: 'TAIPEI',
    location: { latitude: 25.033964, longitude: 121.564468 }, // Taipei 101
    timestamp: new Date(Date.now() - 3600 * 1000 * 6.5).toISOString(),
    accuracy: 4.2,
    addressHint: 'Taipei 101 Tower Base, Xinyi District',
    deviceModel: 'Pixel 8 Pro (Android 15)'
  },
  {
    id: 'chk_seed_102',
    userId: 'usr_hermann_01',
    userEmail: 'hermanntalk@gmail.com',
    tripCode: 'TAIPEI',
    location: { latitude: 25.0385, longitude: 121.5583 }, // Sun Yat-sen Memorial Hall
    timestamp: new Date(Date.now() - 3600 * 1000 * 5.2).toISOString(),
    accuracy: 3.8,
    addressHint: 'SYS Memorial Hall, Renai Road',
    deviceModel: 'Pixel 8 Pro (Android 15)'
  },
  {
    id: 'chk_seed_103',
    userId: 'usr_hermann_01',
    userEmail: 'hermanntalk@gmail.com',
    tripCode: 'TAIPEI',
    location: { latitude: 25.0418, longitude: 121.5353 }, // Huashan 1914 Park
    timestamp: new Date(Date.now() - 3600 * 1000 * 4.1).toISOString(),
    accuracy: 5.1,
    addressHint: 'Huashan 1914 Creative Park, Zhongzheng',
    deviceModel: 'Pixel 8 Pro (Android 15)'
  },
  {
    id: 'chk_seed_104',
    userId: 'usr_hermann_01',
    userEmail: 'hermanntalk@gmail.com',
    tripCode: 'TAIPEI',
    location: { latitude: 25.0478, longitude: 121.5170 }, // Taipei Main Station
    timestamp: new Date(Date.now() - 3600 * 1000 * 3.0).toISOString(),
    accuracy: 4.0,
    addressHint: 'Taipei Main Station Station Front',
    deviceModel: 'Pixel 8 Pro (Android 15)'
  },
  {
    id: 'chk_seed_105',
    userId: 'usr_hermann_01',
    userEmail: 'hermanntalk@gmail.com',
    tripCode: 'TAIPEI',
    location: { latitude: 25.0422, longitude: 121.5080 }, // Ximending
    timestamp: new Date(Date.now() - 3600 * 1000 * 2.1).toISOString(),
    accuracy: 3.5,
    addressHint: 'Ximending Walking Street',
    deviceModel: 'Pixel 8 Pro (Android 15)'
  },
  {
    id: 'chk_seed_106',
    userId: 'usr_hermann_01',
    userEmail: 'hermanntalk@gmail.com',
    tripCode: 'TAIPEI',
    location: { latitude: 25.0353, longitude: 121.5197 }, // Chiang Kai-shek Memorial Hall
    timestamp: new Date(Date.now() - 3600 * 1000 * 1.2).toISOString(),
    accuracy: 3.9,
    addressHint: 'Chiang Kai-shek Memorial Hall Square',
    deviceModel: 'Pixel 8 Pro (Android 15)'
  },
  {
    id: 'chk_seed_107',
    userId: 'usr_hermann_01',
    userEmail: 'hermanntalk@gmail.com',
    tripCode: 'TAIPEI',
    location: { latitude: 25.0330, longitude: 121.5320 }, // Daan Forest Park
    timestamp: new Date(Date.now() - 3600 * 1000 * 0.4).toISOString(),
    accuracy: 3.2,
    addressHint: 'Daan Forest Park Metro Station',
    deviceModel: 'Pixel 8 Pro (Android 15)'
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
    const defaultUser: AuthUser = {
      uid: 'usr_hermann_01',
      email: 'hermanntalk@gmail.com',
      displayName: 'Hermann'
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

    // 2. Write to live Cloud Firestore (collection: checkins)
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
        deviceModel: 'Android (MySportsPal)'
      });
      console.log('✅ Successfully persisted to Cloud Firestore collection [checkins]');
    } catch (err) {
      console.warn('Firestore live write error / offline fallback:', err);
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
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  async queryFirestoreLive(userEmailQuery?: string, tripCodeQuery?: string): Promise<CheckInRecord[]> {
    try {
      const checkinsRef = collection(db, 'checkins');
      let q = query(checkinsRef);
      if (userEmailQuery && userEmailQuery.trim()) {
        q = query(checkinsRef, where('userEmail', '==', userEmailQuery.trim()));
      }
      const snapshot = await getDocs(q);
      if (snapshot.empty) return [];

      const records: CheckInRecord[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const loc = data.location as FirestoreGeoPoint;
        let tsStr = new Date().toISOString();
        if (data.timestamp instanceof Timestamp) {
          tsStr = data.timestamp.toDate().toISOString();
        }
        records.push({
          id: docSnap.id,
          userId: data.userId || '',
          userEmail: data.userEmail || '',
          tripCode: data.tripCode || '',
          location: {
            latitude: loc?.latitude ?? 0,
            longitude: loc?.longitude ?? 0
          },
          timestamp: tsStr,
          accuracy: data.accuracy,
          addressHint: data.addressHint,
          deviceModel: data.deviceModel
        });
      });
      return records;
    } catch (err) {
      console.warn('Live Firestore query fallback:', err);
      return [];
    }
  },

  resetDemoData(): void {
    localStorage.setItem(STORAGE_CHECKINS_KEY, JSON.stringify(SEED_CHECKINS));
  }
};
