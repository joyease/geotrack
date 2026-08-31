import { CheckInRecord, AuthUser, GeoPoint, UserStamp } from '../types';
import { db, auth } from './firebase';
import { 
  collection, 
  doc,
  setDoc,
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  GeoPoint as FirestoreGeoPoint,
  Timestamp
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';

const STORAGE_CHECKINS_KEY = 'geocheckin_firestore_checkins';
const STORAGE_USER_KEY = 'geocheckin_firebase_auth_user';
const STORAGE_STAMPS_KEY_PREFIX = 'geocheckin_user_stamps_';

// Pre-seeded records are empty by default so new accounts start clean
const SEED_CHECKINS: CheckInRecord[] = [];

export const StorageService = {
  // Authentication methods
  getCurrentUser(): AuthUser | null {
    if (auth.currentUser) {
      return {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        displayName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'User'
      };
    }
    try {
      const stored = localStorage.getItem(STORAGE_USER_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return null;
  },

  setCurrentUser(user: AuthUser | null): void {
    if (user) {
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
      // 同步使用者帳號至 Firestore users 集合
      try {
        const userDocRef = doc(db, 'users', user.uid);
        setDoc(userDocRef, {
          email: user.email,
          displayName: user.displayName,
          userId: user.uid,
          lastLoginAt: serverTimestamp()
        }, { merge: true }).catch(err => console.warn('User doc sync fallback:', err));
      } catch (e) {
        // ignore
      }
    } else {
      localStorage.removeItem(STORAGE_USER_KEY);
    }
  },

  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase signOut error:', e);
    }
    this.setCurrentUser(null);
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
      const currentAuth = auth.currentUser;
      const effectiveUserId = currentAuth?.uid || record.userId;
      const effectiveUserEmail = currentAuth?.email || record.userEmail;
      const checkinsRef = collection(db, 'checkins');
      await addDoc(checkinsRef, {
        userId: effectiveUserId,
        userEmail: effectiveUserEmail,
        tripCode: record.tripCode.trim(),
        location: new FirestoreGeoPoint(record.location.latitude, record.location.longitude),
        timestamp: serverTimestamp(),
        accuracy: record.accuracy || 4.5,
        addressHint: newRecord.addressHint,
        deviceModel: 'Web Browser'
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
  },

  // Stamp Rally Persistence
  getUserStamps(userId: string): UserStamp[] {
    const key = `${STORAGE_STAMPS_KEY_PREFIX}${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Return default initial stamps (e.g. 101 observation desk unlocked for Hermann)
      const defaultStamps: UserStamp[] = [
        {
          attractionId: 1,
          name: '台北101觀景台',
          stampedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          dateString: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0]
        },
        {
          attractionId: 2,
          name: '象山六巨石',
          stampedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          dateString: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0]
        },
        {
          attractionId: 28,
          name: '華山1914文創園區',
          stampedAt: new Date().toISOString(),
          dateString: new Date().toISOString().split('T')[0]
        }
      ];
      localStorage.setItem(key, JSON.stringify(defaultStamps));
      return defaultStamps;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  async saveUserStamp(userId: string, stamp: UserStamp): Promise<void> {
    const key = `${STORAGE_STAMPS_KEY_PREFIX}${userId}`;
    const existing = this.getUserStamps(userId);
    if (!existing.some(s => s.attractionId === stamp.attractionId)) {
      const updated = [...existing, stamp];
      localStorage.setItem(key, JSON.stringify(updated));
    }

    // Persist to Cloud Firestore: users/{userId}/stamps/{attractionId} and global stamps
    try {
      const currentAuth = auth.currentUser;
      const targetUserId = currentAuth?.uid || userId;
      const userEmail = currentAuth?.email || '';

      // 1. 更新使用者個人文件
      const userDocRef = doc(db, 'users', targetUserId);
      await setDoc(userDocRef, {
        email: userEmail,
        userId: targetUserId,
        lastActiveAt: serverTimestamp()
      }, { merge: true });

      // 2. 寫入使用者專屬百景集章子集合 (users/{userId}/stamps/{attractionId})
      const stampDocRef = doc(db, 'users', targetUserId, 'stamps', stamp.attractionId.toString());
      await setDoc(stampDocRef, {
        attractionId: stamp.attractionId,
        name: stamp.name,
        userId: targetUserId,
        userEmail: userEmail,
        stampedAt: serverTimestamp()
      }, { merge: true });

      // 3. 同步至全域 stamps 集合（相容舊版與總後台查詢）
      const globalStampDocRef = doc(db, 'stamps', stamp.attractionId.toString());
      await setDoc(globalStampDocRef, {
        attractionId: stamp.attractionId,
        name: stamp.name,
        lastUserId: targetUserId,
        lastUserEmail: userEmail,
        lastStampedAt: serverTimestamp()
      }, { merge: true });

      console.log(`✅ Stamp saved to Firestore: users/${targetUserId}/stamps/${stamp.attractionId}`);
    } catch (err) {
      console.warn('Firestore stamp save fallback:', err);
    }
  },

  async loadFirestoreStamps(userId: string): Promise<UserStamp[]> {
    try {
      const stampsColRef = collection(db, 'users', userId, 'stamps');
      const snap = await getDocs(stampsColRef);
      if (!snap.empty) {
        const firestoreStamps: UserStamp[] = [];
        snap.forEach(d => {
          const data = d.data();
          let dStr = new Date().toISOString().split('T')[0];
          let isoStr = new Date().toISOString();
          if (data.stampedAt instanceof Timestamp) {
            const dateObj = data.stampedAt.toDate();
            dStr = dateObj.toISOString().split('T')[0];
            isoStr = dateObj.toISOString();
          }
          firestoreStamps.push({
            attractionId: data.attractionId || parseInt(d.id, 10),
            name: data.name || '',
            stampedAt: isoStr,
            dateString: dStr
          });
        });
        if (firestoreStamps.length > 0) {
          const key = `${STORAGE_STAMPS_KEY_PREFIX}${userId}`;
          localStorage.setItem(key, JSON.stringify(firestoreStamps));
          return firestoreStamps;
        }
      }
    } catch (err) {
      console.warn('Load Firestore stamps error:', err);
    }
    return this.getUserStamps(userId);
  }
};
