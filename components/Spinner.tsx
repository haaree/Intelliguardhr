
import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', color = 'text-teal-600', className = '' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-[3px]',
    lg: 'w-12 h-12 border-4',
    xl: 'w-20 h-20 border-[6px]'
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer Glow Ring */}
      <div className={`${sizeClasses[size]} border-teal-100 rounded-full animate-pulse absolute`}></div>
      {/* Spinning Primary Ring */}
      <div className={`${sizeClasses[size]} border-t-teal-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin absolute`}></div>
      {/* Inner Dot Branding */}
      <div className={`w-1/4 h-1/4 bg-teal-600 rounded-full animate-ping opacity-20`}></div>
    </div>
  );
};

export default Spinner;
