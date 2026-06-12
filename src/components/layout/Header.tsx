import { useState, useRef, useEffect } from 'react';
import { Bell, Search, LogOut, CheckCheck, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWMSStore } from '../../store';
import { format } from '../../utils/helpers';

interface HeaderProps {
  onLogout: () => void;
  currentUser: { id: string; username: string; role: string; fullName: string };
}

const severityIcons = {
  critical: <AlertCircle className="w-4 h-4 text-red-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  info: <Info className="w-4 h-4 text-blue-500" />,
};

const severityColors = {
  critical: 'border-l-red-500 bg-red-50',
  warning: 'border-l-yellow-500 bg-yellow-50',
  info: 'border-l-blue-500 bg-blue-50',
};

export default function Header({ onLogout }: HeaderProps) {
  const navigate = useNavigate();
  const { stockAlerts, markAlertRead, markAllAlertsRead, getUnreadAlertCount } = useWMSStore();
  const [showAlerts, setShowAlerts] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const unreadCount = getUnreadAlertCount();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAlerts(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/search')}
          className="flex items-center gap-2 bg-gray-100 rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-200 transition-colors w-80"
        >
          <Search className="w-4 h-4" />
          <span>Search items, employees, batches...</span>
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showAlerts && (
            <div className="absolute right-0 top-12 w-[420px] bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-[500px] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={() => markAllAlertsRead()} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowAlerts(false)} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {stockAlerts.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">No notifications</div>
                ) : (
                  stockAlerts.slice(0, 50).map(alert => (
                    <div
                      key={alert.id}
                      onClick={() => !alert.read && markAlertRead(alert.id)}
                      className={`border-l-4 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${severityColors[alert.severity]} ${!alert.read ? 'opacity-100' : 'opacity-60'}`}
                    >
                      <div className="flex items-start gap-2">
                        {severityIcons[alert.severity]}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{alert.title}</p>
                            {!alert.read && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{alert.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{format(new Date(alert.createdAt), 'dd MMM yyyy HH:mm')}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-l border-gray-200 pl-4">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
