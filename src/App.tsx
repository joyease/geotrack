/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthUser, NavigationTab, ToastMessage, UserStamp } from './types';
import { StorageService } from './services/storage';
import { AndroidFrame } from './components/AndroidFrame';
import { MaterialBottomNav } from './components/MaterialBottomNav';
import { MaterialToastContainer } from './components/MaterialToast';
import { LoginScreen } from './components/LoginScreen';
import { CheckInScreen } from './components/CheckInScreen';
import { SupervisorMapScreen } from './components/SupervisorMapScreen';
import { StampRallyScreen } from './components/StampRallyScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { CodeViewerModal } from './components/CodeViewerModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => StorageService.getCurrentUser());
  const [activeTab, setActiveTab] = useState<NavigationTab>('checkin');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [userStamps, setUserStamps] = useState<UserStamp[]>([]);

  // Deep-link state for supervisor map query
  const [mapPrefillEmail, setMapPrefillEmail] = useState('');
  const [mapPrefillTripCode, setMapPrefillTripCode] = useState('');

  // Load user stamps
  useEffect(() => {
    if (currentUser) {
      const localStamps = StorageService.getUserStamps(currentUser.uid);
      setUserStamps(localStamps);
      StorageService.loadFirestoreStamps(currentUser.uid).then(stamps => {
        if (stamps && stamps.length > 0) {
          setUserStamps(stamps);
        }
      });
    }
  }, [currentUser?.uid]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const newToast: ToastMessage = {
      id: 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      message,
      type
    };
    setToasts(prev => [...prev.slice(-3), newToast]); // keep max 4 toasts
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setActiveTab('checkin');
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const handleNavigateToMapWithTrip = (email: string, tripCode: string) => {
    setMapPrefillEmail(email);
    setMapPrefillTripCode(tripCode);
    setActiveTab('map');
    showToast(`Filtering map for ${tripCode}`, 'info');
  };

  const handleProfileTripClick = (tripCode: string) => {
    if (currentUser) {
      handleNavigateToMapWithTrip(currentUser.email, tripCode);
    }
  };

  const handleStampUnlocked = (newStamp: UserStamp) => {
    setUserStamps(prev => {
      if (prev.some(s => s.attractionId === newStamp.attractionId)) return prev;
      return [...prev, newStamp];
    });
  };

  return (
    <AndroidFrame onOpenCodeViewer={() => setIsCodeModalOpen(true)}>
      {/* Active Screen Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {!currentUser ? (
          <LoginScreen onLoginSuccess={handleLoginSuccess} showToast={showToast} />
        ) : (
          <>
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeTab === 'checkin' && (
                <CheckInScreen
                  currentUser={currentUser}
                  showToast={showToast}
                  onNavigateToMapWithTrip={handleNavigateToMapWithTrip}
                />
              )}
              {activeTab === 'map' && (
                <SupervisorMapScreen
                  initialEmail={mapPrefillEmail}
                  initialTripCode={mapPrefillTripCode}
                  showToast={showToast}
                />
              )}
              {activeTab === 'stamps' && (
                <StampRallyScreen
                  currentUser={currentUser}
                  showToast={showToast}
                  userStamps={userStamps}
                  onStampUnlocked={handleStampUnlocked}
                />
              )}
              {activeTab === 'profile' && (
                <ProfileScreen
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  showToast={showToast}
                  onViewTripOnMap={handleProfileTripClick}
                  userStampsCount={userStamps.length}
                  onNavigateToStamps={() => setActiveTab('stamps')}
                />
              )}
            </div>

            {/* Bottom Material 3 Navigation Bar (4 tabs) */}
            <MaterialBottomNav
              activeTab={activeTab}
              onTabChange={setActiveTab}
              unlockedStampsCount={userStamps.length}
            />
          </>
        )}
      </main>

      {/* Floating Status Toasts */}
      <MaterialToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Android Kotlin & Compose Source Code Inspector Modal */}
      <CodeViewerModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        showToast={showToast}
      />
    </AndroidFrame>
  );
}
