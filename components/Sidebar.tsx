
import React from 'react';
import {
  LayoutDashboard,
  Users,
  Clock,
  LogOut,
  Settings,
  Shield,
  Fingerprint,
  FileBarChart
} from 'lucide-react';
import { Page, UserRole } from '../types.ts';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onOpenSecurity: () => void;
  role: UserRole;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, onLogout, onOpenSecurity, role }) => {
  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['SaaS_Admin', 'Admin', 'Manager', 'Employee'] },
    { id: 'employees', label: 'Employee', icon: Users, roles: ['SaaS_Admin', 'Admin'] },
    { id: 'biometric', label: 'Biometric', icon: Fingerprint, roles: ['SaaS_Admin', 'Admin'] },
    { id: 'attendance', label: 'Logs Audit', icon: Clock, roles: ['SaaS_Admin', 'Admin', 'Employee'] },
    { id: 'reports', label: 'Reports', icon: FileBarChart, roles: ['SaaS_Admin', 'Admin', 'Manager'] },
    { id: 'headcount', label: 'Headcount', icon: Users, roles: ['SaaS_Admin', 'Admin'] },
    { id: 'shifts', label: 'Settings', icon: Settings, roles: ['SaaS_Admin', 'Admin', 'Manager'] },
  ];

  const menuItems = allMenuItems.filter(item => item.roles.includes(role));

  const getRoleLabel = (role: UserRole) => {
    if (role === 'SaaS_Admin') return 'Global Admin';
    return role;
  };

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-[1px_0_0_rgba(0,0,0,0.05)]">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-100 flex-shrink-0">
            <div className="w-5 h-5 border-2 border-white rounded-sm"></div>
          </div>
          <div>
            <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-teal-900 leading-none block">
              Intelliguard
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
              HR Core
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as Page)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-slate-900 text-white font-bold shadow-xl shadow-slate-100' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 space-y-2">
        <button 
          onClick={onOpenSecurity}
          className="w-full group px-4 py-3 bg-slate-50 rounded-2xl flex items-center justify-between hover:bg-teal-50 transition-all border border-transparent hover:border-teal-100 text-left"
        >
          <div className="overflow-hidden">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Security Key</p>
            <p className="text-xs font-black text-teal-600 truncate group-hover:text-teal-700">{getRoleLabel(role)}</p>
          </div>
          <Shield size={16} className="text-slate-300 group-hover:text-teal-500 transition-colors" />
        </button>
        
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all font-bold"
        >
          <LogOut size={20} />
          <span className="text-sm">Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
