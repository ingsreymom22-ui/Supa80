import React, { useRef, useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  LogOut, 
  CalendarCheck, 
  Contact, 
  LayoutGrid,
  ChevronDown,
  Eye,
  EyeOff,
  ChevronLeft,
  Menu,
  User as UserIcon,
  UserCheck,
  BookOpen,
  FilterX,
  Zap,
  ClipboardList,
  Bell,
  CheckSquare,
  Image as ImageIcon,
  Trash2,
  FileText,
  Wallet,
  RotateCcw,
  RotateCw,
  GraduationCap,
  Settings,
  Sparkles,
  BarChart3,
  ShieldCheck,
  Bookmark
} from 'lucide-react';
import { Tab, UserRole, AppSettings, ViewMode, StudentCategory, AppData, CurrentUser } from '../types';
import { getSyncStatus } from '../services/supabase';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onLogout: () => void;
  role: UserRole;
  currentUser?: CurrentUser | null;
  onSettingsOpen: () => void;
  filters: any;
  setFilters: (f: any) => void;
  uniqueTeachers: string[];
  uniqueAssistants: string[];
  uniqueTimes: string[];
  uniqueLevels?: string[];
  uniqueBehaviors?: string[];
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  globalScale: number;
  setGlobalScale: (s: number) => void;
  settings?: AppSettings;
  onUpdateSettings?: (s: AppSettings) => void;
  data: AppData;
  onClearCategory: (categories: StudentCategory[]) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  isSyncing?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  setIsOpen,
  activeTab, 
  setActiveTab, 
  role,
  currentUser,
  onSettingsOpen,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isSyncing
}) => {

  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      const { checkSupabaseConnection } = await import('../services/supabase');
      const active = typeof window !== 'undefined' && window.navigator.onLine && await checkSupabaseConnection();
      setIsOnline(!!active);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 15000); // Check every 15s

    const handleOnline = () => checkStatus();
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleTabSelect = (tab: Tab) => {
    setActiveTab(tab);
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  const navItems = [
    { id: Tab.DailyPerformanceCheck, icon: CheckSquare, label: 'Daily Performance', roles: ['Admin', 'Teacher', 'Finance'] },
    { id: Tab.DPSS, icon: FileText, label: 'Note-taking', roles: ['Admin', 'Teacher', 'Finance'] },
    { id: Tab.SelfLearning, icon: GraduationCap, label: 'Self-Learning', roles: ['Admin', 'Teacher', 'Finance'] },
    { id: Tab.Templates, icon: Bookmark, label: 'Templates', roles: ['Admin', 'Teacher', 'Finance'] },
    { id: Tab.ExpenseTracker, icon: Wallet, label: 'Daily Expenses', roles: ['Admin', 'Teacher', 'Finance'] },
    { id: Tab.Reflections, icon: LayoutGrid, label: 'Growth Plan', roles: ['Admin', 'Teacher', 'Finance'] },
    { id: Tab.DailyJournal, icon: BookOpen, label: 'Daily Journal', roles: ['Admin', 'Teacher', 'Finance'] },
    { id: Tab.Analytics, icon: BarChart3, label: 'Analytics', roles: ['Admin', 'Teacher', 'Finance'] },
    { id: Tab.AdvancedHabitTracker, icon: Sparkles, label: 'Advanced Habits', roles: ['Admin', 'Teacher', 'Finance'] },
    { id: Tab.RecycleBin, icon: Trash2, label: 'Recycle Bin', roles: ['Admin', 'Teacher'] },
    { id: Tab.Maintenance, icon: ShieldCheck, label: 'Maintenance & Sync', roles: ['Admin'] },
  ];

  const filterSelectStyle = "w-full bg-white/10 border border-white/20 rounded-xl py-2.5 px-3 text-[11px] text-slate-900 font-black outline-none transition-all cursor-pointer appearance-none hover:bg-white/20 focus:ring-4 focus:ring-primary-500/10 backdrop-blur-md";
  const labelStyle = "text-[10px] font-black text-slate-800 mb-2 flex items-center gap-2 ml-1 tracking-[3px]";

  return (
    <>
      {/* Re-open button when hidden */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed top-4 left-4 z-[60] w-12 h-12 bg-white text-[#1B254B] rounded-xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-slate-100"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/5 z-40 md:hidden backdrop-blur-[2px] transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside 
        className={`fixed md:relative h-full z-50 md:z-40 bg-white/[0.02] backdrop-blur-md border-r border-white/10 text-slate-900 flex flex-col transition-all duration-300 ease-in-out overflow-hidden shadow-2xl no-print shrink-0 ${
          isOpen ? 'w-[270px] translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 overflow-hidden'
        }`}
      >
        {/* Branding Area with Collapse Toggle */}
        <div className="p-6 flex items-center justify-between border-b border-white/5 h-20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg flex-shrink-0">
              P
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight uppercase leading-none text-slate-900">Peak Performance</h2>
              <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mt-1">Growth Portal</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-white/10 rounded-xl transition-all"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Undo/Redo Section */}
        <div className="px-5 py-3 border-b border-white/5 flex gap-2 shrink-0 bg-slate-50/10">
            <button 
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                className={`flex-1 h-9 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${canUndo ? 'bg-white/20 text-slate-900 hover:bg-white/30 border border-slate-200' : 'bg-white/5 text-slate-300 opacity-50 cursor-not-allowed border border-transparent'}`}
            >
                <RotateCcw size={14} /> Undo
            </button>
            <button 
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
                className={`flex-1 h-9 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${canRedo ? 'bg-white/20 text-slate-900 hover:bg-white/30 border border-slate-200' : 'bg-white/5 text-slate-300 opacity-50 cursor-not-allowed border border-transparent'}`}
            >
                <RotateCw size={14} /> Redo
            </button>
        </div>

        {/* Navigation & Filters */}
        <div className="flex-1 pl-5 pr-4 py-6 space-y-8 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {role && (
            <div className="bg-orange-500/10 rounded-2xl p-4 border border-orange-500/20 mb-4 w-[90%] relative">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-[10px] font-black">
                  {currentUser?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-[10px] font-black text-slate-900 truncate tracking-tight">{currentUser?.name}</p>
                  <p className="text-[10px] font-black text-rose-600 truncate lowercase mt-0.5">{currentUser?.email || 'Local Account'}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-blue-500 animate-bounce' : isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span 
                      className={`text-[9px] font-black leading-none ${isSyncing ? 'text-blue-600' : isOnline ? 'text-emerald-600' : 'text-amber-600/90'}`} 
                      title={
                        isSyncing
                          ? "Uploading changes to cloud..."
                          : isOnline 
                            ? "Connected to Supabase Cloud sync" 
                            : typeof window !== 'undefined' && window.navigator.onLine 
                              ? "Internet connected, but Supabase is unreachable! Ensure the 'dps_data' table exists in your Supabase project and check your VITE_SUPABASE keys." 
                              : "Offline. Notes are saved locally and will auto-sync when connection is restored."
                      }
                    >
                      {isSyncing ? 'Syncing...' : isOnline ? 'Online • synced' : 'Offline • local'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <nav className="space-y-2">
              {navItems.filter(item => item.roles.includes(role)).map(item => (
                <button
                    key={item.id}
                    onClick={() => handleTabSelect(item.id)}
                    className={`flex items-center gap-4 px-6 py-4 rounded-[20px] transition-all w-full group ${
                      activeTab === item.id 
                        ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20 backdrop-blur-[4px]' 
                        : 'text-slate-600 hover:text-orange-600 hover:bg-white/[0.05]'
                    }`}
                >
                    <item.icon size={22} strokeWidth={activeTab === item.id ? 3 : 2} />
                    <span className="text-[11px] font-black tracking-widest">{item.label}</span>
                </button>
              ))}
          </nav>
        </div>

        {/* Footer Area */}
        <div className="p-4 bg-white/5 border-t border-white/5 no-print shrink-0 backdrop-blur-md">
          <button 
            onClick={onSettingsOpen}
            className="flex items-center gap-3 px-5 py-3 rounded-xl text-slate-900 dark:text-slate-200 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white/20 dark:hover:bg-slate-800 transition-all w-full font-black uppercase tracking-widest text-[10px]"
          >
            <Settings size={18} />
            Settings
          </button>
          
          <button 
            onClick={() => {
              document.documentElement.classList.toggle('dark');
              // Optionally save user preference to localStorage
              const isDark = document.documentElement.classList.contains('dark');
              localStorage.setItem('theme', isDark ? 'dark' : 'light');
            }}
            className="flex items-center gap-3 px-5 py-3 rounded-xl text-slate-900 dark:text-slate-200 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white/20 dark:hover:bg-slate-800 transition-all w-full font-black uppercase tracking-widest text-[10px] mt-2"
          >
            <Eye size={18} className="dark:hidden block" />
            <EyeOff size={18} className="dark:block hidden" />
            Toggle Theme
          </button>
        </div>
      </aside>
    </>
  );
};
