import React from 'react';
import { CalendarDays, Calendar, AlertTriangle, FileBarChart, TrendingUp, Users, Clock, FileText } from 'lucide-react';
import { Page, UserRole } from '../types';

interface ReportCard {
  id: Page;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  hoverColor: string;
  roles: UserRole[];
}

interface ReportsHubProps {
  onNavigate: (page: Page) => void;
  role: UserRole;
}

const ReportsHub: React.FC<ReportsHubProps> = ({ onNavigate, role }) => {
  const allReports: ReportCard[] = [
    {
      id: 'monthly',
      title: 'Monthly Consolidation',
      description: 'Comprehensive monthly attendance report with calendar view, status summary, and pay days calculation',
      icon: CalendarDays,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      hoverColor: 'hover:bg-blue-100',
      roles: ['SaaS_Admin', 'Admin', 'Manager']
    },
    {
      id: 'shift-deviation',
      title: 'Shift Deviation Analysis',
      description: 'Track and analyze shift deviations, wrong shifts, and unscheduled attendance with financial impact',
      icon: Calendar,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
      hoverColor: 'hover:bg-violet-100',
      roles: ['SaaS_Admin', 'Admin', 'Manager']
    },
    {
      id: 'leave',
      title: 'Reconciliation Report',
      description: 'Reconcile attendance with leave records, Excel uploads, and manage audit queue items',
      icon: FileText,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      hoverColor: 'hover:bg-emerald-100',
      roles: ['SaaS_Admin', 'Admin', 'Manager']
    },
    // Placeholder for future reports
    {
      id: 'dashboard',
      title: 'Overtime Analysis',
      description: 'Detailed overtime hours tracking, eligibility verification, and payroll calculations',
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      hoverColor: 'hover:bg-amber-100',
      roles: ['SaaS_Admin', 'Admin', 'Manager']
    },
    {
      id: 'dashboard',
      title: 'Leave Balance Report',
      description: 'Employee-wise leave balances, accruals, and leave type breakdown',
      icon: FileBarChart,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      hoverColor: 'hover:bg-rose-100',
      roles: ['SaaS_Admin', 'Admin', 'Manager']
    },
    {
      id: 'dashboard',
      title: 'Attendance Trends',
      description: 'Visualize attendance patterns, trends, and insights across departments and time periods',
      icon: TrendingUp,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      hoverColor: 'hover:bg-indigo-100',
      roles: ['SaaS_Admin', 'Admin', 'Manager']
    }
  ];

  // Filter reports based on user role
  const availableReports = allReports.filter(report => report.roles.includes(role));

  const handleReportClick = (reportId: Page) => {
    // For implemented reports, navigate to them
    if (reportId === 'monthly' || reportId === 'shift-deviation' || reportId === 'leave') {
      onNavigate(reportId);
    } else {
      // For placeholder reports, show coming soon message
      alert('This report is coming soon! 🚀');
    }
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-blue-50 p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <FileBarChart size={24} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">Reports Hub</h1>
              <p className="text-sm text-slate-500 font-medium">Access all your attendance and workforce analytics reports</p>
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableReports.map((report) => {
            const Icon = report.icon;
            const isImplemented = report.id === 'monthly' || report.id === 'shift-deviation' || report.id === 'leave';

            return (
              <button
                key={report.id + report.title}
                onClick={() => handleReportClick(report.id)}
                className={`relative group bg-white rounded-2xl border-2 border-slate-200 p-6 transition-all duration-200 text-left ${
                  isImplemented
                    ? `${report.hoverColor} hover:border-slate-300 hover:shadow-xl cursor-pointer`
                    : 'opacity-60 hover:opacity-80 cursor-not-allowed'
                }`}
              >
                {/* Coming Soon Badge */}
                {!isImplemented && (
                  <div className="absolute top-3 right-3 px-3 py-1 bg-slate-200 text-slate-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                    Coming Soon
                  </div>
                )}

                {/* Icon */}
                <div className={`w-14 h-14 ${report.bgColor} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                  <Icon size={28} className={report.color} strokeWidth={2.5} />
                </div>

                {/* Content */}
                <h3 className="text-lg font-black text-slate-900 mb-2">{report.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{report.description}</p>

                {/* Arrow indicator for implemented reports */}
                {isImplemented && (
                  <div className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">
                    <span>View Report</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Quick Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <span className="text-xl">✅</span>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Available Reports</p>
                <p className="text-lg font-black text-slate-900">{availableReports.filter(r => r.id === 'monthly' || r.id === 'shift-deviation' || r.id === 'leave').length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <span className="text-xl">🚀</span>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Coming Soon</p>
                <p className="text-lg font-black text-slate-900">{availableReports.filter(r => r.id === 'dashboard').length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Categories</p>
                <p className="text-lg font-black text-slate-900">{availableReports.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400 font-medium">
            Click on any available report card to view detailed analytics and insights
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportsHub;
