import React, { useState } from 'react';
import { AuthUser } from '../types';
import { StorageService } from '../services/storage';
import { Mail, Lock, LogIn, MapPin, ShieldCheck, Sparkles } from 'lucide-react';

interface Props {
  onLoginSuccess: (user: AuthUser) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const LoginScreen: React.FC<Props> = ({ onLoginSuccess, showToast }) => {
  const [email, setEmail] = useState('hermanntalk@gmail.com');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);

  const demoAccounts = [
    { email: 'hermanntalk@gmail.com', role: 'Inspector (Taipei Records)' },
    { email: 'field_agent_01@company.com', role: 'Field Agent (Tokyo Route)' },
    { email: 'supervisor@company.com', role: 'HQ Supervisor' }
  ];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      showToast('Please enter your Email address', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      showToast('Invalid email address format', 'error');
      return;
    }

    if (!cleanPassword) {
      showToast('Please enter your password', 'error');
      return;
    }

    if (cleanPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    setIsLoading(true);

    // Simulate FirebaseAuth async network latency
    setTimeout(() => {
      setIsLoading(false);
      const user: AuthUser = {
        uid: 'usr_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'),
        email: cleanEmail,
        displayName: cleanEmail.split('@')[0]
      };
      StorageService.setCurrentUser(user);
      showToast(`Welcome back, ${cleanEmail}!`, 'success');
      onLoginSuccess(user);
    }, 600);
  };

  const selectDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    showToast(`Loaded account: ${demoEmail}`, 'info');
  };

  return (
    <div id="screen-login" className="flex-1 flex flex-col justify-between p-6 overflow-y-auto bg-gradient-to-b from-[#FEF7FF] via-white to-[#F7F2FA] text-[#1C1B1F]">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full py-4">
        {/* Brand Icon Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[#EADDFF] border border-[#D0BCFF] flex items-center justify-center text-[#6750A4] mb-3 shadow-md">
            <MapPin className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-[#1C1B1F] tracking-tight">GeoTrack Pro</h1>
          <p className="text-sm text-[#49454F] mt-1">Field Location & Supervisor Monitor</p>
          <div className="flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full bg-[#F3EDF7] border border-[#E7E0EC] text-[#6750A4] text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-[#6750A4]" />
            <span>Firebase Auth & Firestore</span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 bg-white border border-[#E7E0EC] rounded-2xl p-5 shadow-xs">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#49454F] ml-1">Email Address (帳號)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#79747E]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="login-input-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-white border border-[#79747E] focus:border-[#6750A4] focus:ring-1 focus:ring-[#6750A4] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1C1B1F] placeholder-[#79747E]/70 transition-all outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#49454F] ml-1">Password (密碼)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#79747E]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="login-input-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-[#79747E] focus:border-[#6750A4] focus:ring-1 focus:ring-[#6750A4] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1C1B1F] placeholder-[#79747E]/70 transition-all outline-none font-mono"
              />
            </div>
          </div>

          <button
            id="login-submit-button"
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-[#6750A4] hover:bg-[#4F378B] active:bg-[#381E72] disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-full flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg m3-ripple cursor-pointer"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>SIGN IN (登入系統)</span>
              </>
            )}
          </button>
        </form>

        {/* Demo Fast Login Switcher */}
        <div className="mt-6 pt-4 border-t border-[#E7E0EC]">
          <div className="flex items-center gap-1.5 text-xs text-[#49454F] font-bold mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-[#6750A4]" />
            <span>Quick Demo Accounts:</span>
          </div>
          <div className="space-y-1.5">
            {demoAccounts.map(demo => (
              <button
                key={demo.email}
                type="button"
                onClick={() => selectDemoAccount(demo.email)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between border transition-all cursor-pointer ${
                  email === demo.email
                    ? 'bg-[#EADDFF] border-[#6750A4] text-[#6750A4] font-semibold'
                    : 'bg-[#F7F2FA] border-[#E7E0EC] hover:bg-[#F3EDF7] text-[#49454F]'
                }`}
              >
                <span className="font-mono text-[11px] truncate">{demo.email}</span>
                <span className="text-[10px] text-[#79747E] shrink-0 ml-2">{demo.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

