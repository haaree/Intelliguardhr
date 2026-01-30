
import React, { useState } from 'react';
import { UserRole } from '../types';
import { Loader2, Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
  onLogin: (role: UserRole, email: string, key?: string) => void;
  onBack: () => void;
  error?: string | null;
  isAuthenticating?: boolean;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, error: externalError, isAuthenticating }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    
    if (!email || !password) {
      setLocalError("Please enter both identity and security key.");
      return;
    }

    onLogin('Employee', email, password); 
  };

  const displayError = externalError || localError;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Form Container */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <div className="mb-10 text-center md:text-left">
            <div className="inline-flex items-center space-x-2 mb-6">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-100">
                <div className="w-5 h-5 border-2 border-white rounded-sm"></div>
              </div>
              <span className="text-2xl font-black text-slate-900 tracking-tight">Intelliguard HR</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Security Portal</h2>
            <p className="text-slate-500 font-medium">Authentication required for corporate environment access.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {displayError && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold animate-in fade-in slide-in-from-top-2">
                {displayError}
              </div>
            )}
            
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Corporate Identity (Email)</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isAuthenticating}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all font-bold text-sm disabled:opacity-50"
                placeholder="identity@company.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Security Key</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isAuthenticating}
                  className="w-full px-5 py-4 pr-14 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all font-bold text-sm disabled:opacity-50"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-teal-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <label className="flex items-center cursor-pointer group">
                <input type="checkbox" className="hidden peer" disabled={isAuthenticating} />
                <div className="w-5 h-5 rounded-lg border-2 border-slate-200 peer-checked:bg-slate-900 peer-checked:border-slate-900 transition-all mr-3 flex items-center justify-center">
                   <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
                <span className="text-sm font-bold text-slate-600">Trust this workstation</span>
              </label>
            </div>

            <button 
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 transform active:scale-[0.98] flex items-center justify-center gap-3 disabled:bg-slate-700"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Verifying Identity...
                </>
              ) : (
                'Authorise & Enter'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Visual Section */}
      <div className="hidden md:block w-1/2 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
        
        <div className="h-full flex flex-col items-center justify-center p-16 text-center">
           <div className="relative z-10">
             <div className="bg-white/5 backdrop-blur-3xl p-10 rounded-[48px] border border-white/10 shadow-2xl max-w-sm">
                <div className="w-16 h-16 bg-white rounded-2xl mb-8 mx-auto flex items-center justify-center shadow-lg transform -rotate-6">
                  <div className="w-8 h-8 border-4 border-slate-900 rounded-full border-t-teal-500 animate-[spin_3s_linear_infinite]"></div>
                </div>
                <h3 className="text-2xl font-black text-white mb-3">Intelliguard HR Core</h3>
                <p className="text-slate-400 text-sm font-medium opacity-80 leading-relaxed">
                  Validating workforce synchronization and timekeeping logic for professional environments.
                </p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
