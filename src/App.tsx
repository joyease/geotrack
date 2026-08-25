/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthUser, NavigationTab, ToastMessage } from './types';
import { StorageService } from './services/storage';
import { AndroidFrame } from './components/AndroidFrame';
import { MaterialBottomNav } from './components/MaterialBottomNav';
import { MaterialToastContainer } from './components/MaterialToast';
import { LoginScreen } from './components/LoginScreen';
import { CheckInScreen } from './components/CheckInScreen';
import { SupervisorMapScreen } from './components/SupervisorMapScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { CodeViewerModal } from './components/CodeViewerModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => StorageService.getCurrentUser());
  const [activeTab, setActiveTab] = useState<NavigationTab>('checkin');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

  // Deep-link state for supervisor map query
  const [mapPrefillEmail, setMapPrefillEmail] = useState('');
  const [mapPrefillTripCode, setMapPrefillTripCode] = useState('');

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
              {activeTab === 'profile' && (
                <ProfileScreen
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  showToast={showToast}
                  onViewTripOnMap={handleProfileTripClick}
                />
              )}
            </div>

            {/* Bottom Material 3 Navigation Bar */}
            <MaterialBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
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
