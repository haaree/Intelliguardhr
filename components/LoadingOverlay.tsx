
import React from 'react';
import Spinner from './Spinner.tsx';

interface LoadingOverlayProps {
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = "Synchronizing Environment" }) => {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative mb-8">
         <Spinner size="xl" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-slate-900 font-black text-xs uppercase tracking-[0.3em] animate-pulse">
          {message}
        </h3>
        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest opacity-60">
          Intelliguard HR Core • Secure Protocol
        </p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
