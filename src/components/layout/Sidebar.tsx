import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Users, TruckIcon, ArrowDownToLine,
  ArrowUpFromLine, ClipboardList, Warehouse, Clock, FileText,
  Search, Shield, Settings, ChevronLeft, ChevronRight, AlertTriangle, Archive,
  HardHat, StickyNote, Wrench, CheckSquare, History, Briefcase, QrCode,
  Boxes,
} from 'lucide-react';
import { useWMSStore } from '../../store';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { divider: 'Inventory' },
  { to: '/items', label: 'Master Items', icon: Package },
  { to: '/stock-in', label: 'Stock In', icon: ArrowDownToLine },
  { to: '/stock-out', label: 'Stock Out', icon: ArrowUpFromLine },
  { to: '/batch-ledger', label: 'Batch Ledger', icon: ClipboardList },
  { to: '/inventory', label: 'Inventory Control', icon: Warehouse },
  { to: '/archived-items', label: 'Archived Items', icon: Archive },
  { divider: 'Operations' },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/job-materials', label: 'Job Materials', icon: Boxes },
  { to: '/ppe-history', label: 'PPE Issue History', icon: TruckIcon },
  { to: '/quarantine-materials', label: 'Quarantine Materials', icon: Shield },
  { to: '/expiry', label: 'Expiry Management', icon: AlertTriangle },
  { divider: 'Trackers' },
  { to: '/ppe-tracker', label: 'PPE Tracker', icon: HardHat },
  { to: '/stationery-tracker', label: 'Stationery Tracker', icon: StickyNote },
  { to: '/job-material-tracker', label: 'Job Material Tracker', icon: Wrench },
  { to: '/qc-tracker', label: 'QC Tracker', icon: CheckSquare },
  { to: '/inventory-history', label: 'Inventory History', icon: History },
  { divider: 'System' },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/search', label: 'Global Search', icon: Search },
  { to: '/qr-code', label: 'Stock Out QR', icon: QrCode },
  { to: '/pending-requests', label: 'Form Requests Sheet', icon: ClipboardList },
  { to: '/audit', label: 'Audit Trail', icon: Clock },
  { to: '/security', label: 'Security', icon: Shield, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const currentUser = useWMSStore((s) => s.currentUser);
  const isAdmin = currentUser.role === 'Administrator';

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-gray-900 text-white transition-all duration-300 z-50 flex flex-col ${
        collapsed ? 'w-[68px]' : 'w-[260px]'
      }`}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Warehouse className="w-6 h-6 text-blue-400" />
            <span className="font-bold text-lg">AMSER</span>
          </div>
        )}
        {collapsed && <Warehouse className="w-6 h-6 text-blue-400 mx-auto" />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-white p-1"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map((item, i) => {
          if ('adminOnly' in item && item.adminOnly && !isAdmin) return null;
          if ('divider' in item && item.divider) {
            return (
              <div key={i} className={`px-4 pt-4 pb-1 ${collapsed ? 'hidden' : ''}`}>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {item.divider}
                </span>
              </div>
            );
          }
          if ('to' in item && item.to && item.icon) {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          }
          return null;
        })}
      </nav>
    </aside>
  );
}
