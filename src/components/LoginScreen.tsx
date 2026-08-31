import React, { useState } from 'react';
import { AuthUser } from '../types';
import { StorageService } from '../services/storage';
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Mail, Lock, LogIn, MapPin, ShieldCheck, AlertCircle } from 'lucide-react';

interface Props {
  onLoginSuccess: (user: AuthUser) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const LoginScreen: React.FC<Props> = ({ onLoginSuccess, showToast }) => {
  const [email, setEmail] = useState('test@gmail.com');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getFirebaseErrorMessage = (error: any): string => {
    const code = error?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Firebase 驗證失敗：帳號或密碼不正確。請確認已在 Firebase Console 後台建立此帳號與密碼。';
      case 'auth/operation-not-allowed':
        return 'Firebase Authentication 尚未啟用「電子郵件/密碼」登入！請至 Firebase Console -> Authentication -> Sign-in method 將「Email/Password」啟用。';
      case 'auth/unauthorized-domain':
        return '目前網域未在 Firebase 的授權網域清單中，請至 Firebase Console -> Authentication -> Settings -> Authorized domains 加入此網域。';
      case 'auth/user-disabled':
        return '此 Firebase 帳號已被管理員停用。';
      case 'auth/weak-password':
        return '密碼長度不足，Firebase 要求密碼長度至少為 6 個字元。';
      case 'auth/invalid-email':
        return 'Email 格式無效，請檢查輸入內容。';
      case 'auth/too-many-requests':
        return '嘗試次數過多被暫時鎖定，請稍後再試。';
      case 'auth/network-request-failed':
        return '網路連線異常，無法連接 Firebase Authentication 伺服器。';
      default:
        return `Firebase 錯誤 (${code || error?.message || '未知原因'})`;
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      showToast('請輸入 Email 帳號', 'error');
      setErrorMessage('請輸入 Email 帳號');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      showToast('Email 格式不正確', 'error');
      setErrorMessage('Email 格式不正確');
      return;
    }

    if (!cleanPassword) {
      showToast('請輸入密碼', 'error');
      setErrorMessage('請輸入密碼');
      return;
    }

    if (cleanPassword.length < 6) {
      showToast('密碼長度至少需 6 個字元', 'error');
      setErrorMessage('密碼長度至少需 6 個字元');
      return;
    }

    setIsLoading(true);

    try {
      // Real Firebase Auth sign-in verification only
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      const fbUser = cred.user;
      const userObj: AuthUser = {
        uid: fbUser.uid,
        email: fbUser.email || cleanEmail,
        displayName: fbUser.displayName || cleanEmail.split('@')[0]
      };
      StorageService.setCurrentUser(userObj);
      showToast(`Firebase 認證成功！歡迎 ${cleanEmail}`, 'success');
      onLoginSuccess(userObj);
    } catch (err: any) {
      const msg = getFirebaseErrorMessage(err);
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="screen-login" className="flex-1 flex flex-col justify-between p-6 overflow-y-auto bg-gradient-to-b from-[#FEF7FF] via-white to-[#F7F2FA] text-[#1C1B1F]">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full py-4">
        {/* Brand Icon Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[#EADDFF] border border-[#D0BCFF] flex items-center justify-center text-[#6750A4] mb-3 shadow-md">
            <MapPin className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-[#1C1B1F] tracking-tight">MyTrackIn</h1>
          <p className="text-sm text-[#49454F] mt-1 font-medium">旅遊打卡 & 百景集章</p>
          <div className="flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full bg-[#F3EDF7] border border-[#E7E0EC] text-[#6750A4] text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-[#6750A4]" />
            <span>Firebase 授權帳號登入</span>
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-4 bg-white border border-[#E7E0EC] rounded-2xl p-5 shadow-xs">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#49454F] ml-1">Firebase Email 帳號</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#79747E]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="login-input-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@gmail.com"
                className="w-full bg-white border border-[#79747E] focus:border-[#6750A4] focus:ring-1 focus:ring-[#6750A4] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1C1B1F] placeholder-[#79747E]/70 transition-all outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#49454F] ml-1">Firebase 密碼 (至少6位)</label>
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
                <span>登入 MyTrackIn (Firebase 認證)</span>
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-center text-[#79747E] mt-3">
          🔒 僅限管理者在 Firebase 後台開通設定之授權帳號登入使用。
        </p>
      </div>
    </div>
  );
};


