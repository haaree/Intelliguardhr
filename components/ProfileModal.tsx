
import React, { useState } from 'react';
import { X, ShieldCheck, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { authService } from '../services/authService.ts';

interface ProfileModalProps {
  email: string;
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ email, isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: 'Security Key must be at least 6 characters.' });
      return;
    }

    setIsSubmitting(true);
    const result = await authService.changePassword(email, currentPassword, newPassword);
    
    if (result.success) {
      setStatus({ type: 'success', message: result.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => onClose(), 2000);
    } else {
      setStatus({ type: 'error', message: result.message });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-100">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">Security Center</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manage Credentials</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {status && (
            <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
              {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <p className="text-xs font-bold">{status.message}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Current Security Key</label>
            <input 
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none transition-all text-sm font-bold"
              placeholder="••••••••"
            />
          </div>

          <div className="h-px bg-slate-100 my-2"></div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">New Security Key</label>
            <input 
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none transition-all text-sm font-bold"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Confirm New Key</label>
            <input 
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none transition-all text-sm font-bold"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-100 flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Update Credentials'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;
