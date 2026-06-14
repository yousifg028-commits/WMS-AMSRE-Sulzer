import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import {
  Package, TrendingUp, AlertTriangle, Users, Boxes, ShoppingCart,
  Clock, ArrowDown, ArrowUp, DollarSign,
} from 'lucide-react';
import { useWMSStore } from '../store';
import { getExpiryStatus, formatNumber } from '../utils/helpers';
import { format, subDays } from 'date-fns';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Dashboard() {
  const { masterItems, employees, stockInRecords, stockOutRecords, batchLedger } = useWMSStore();

  const stats = useMemo(() => {
    const activeItems = masterItems.filter(i => i.status === 'Active');
    const activeItemIds = new Set(activeItems.map(i => i.id));

    const activeBatches = batchLedger.filter(b => activeItemIds.has(b.itemId));
    const totalStock = activeBatches.reduce((sum, b) => sum + b.balance, 0);

    const getItemBalance = (itemId: string) =>
      batchLedger.filter(b => b.itemId === itemId).reduce((s, b) => s + b.balance, 0);

    const lowStockItems = activeItems.filter(i => {
      const bal = getItemBalance(i.id);
      return bal > 0 && bal <= i.reorderLevel;
    });

    const outOfStockItems = activeItems.filter(i => getItemBalance(i.id) === 0);

    const nearExpiryItems = activeBatches.filter(b => getExpiryStatus(b.expiryDate) === 'Near Expiry' && b.balance > 0);
    const expiredItems = activeBatches.filter(b => getExpiryStatus(b.expiryDate) === 'Expired' && b.balance > 0);

    const ppeItems = activeItems.filter(i => i.trackerGroup === 'PPE');
    const ppeStock = activeBatches.filter(b => ppeItems.some(p => p.id === b.itemId)).reduce((s, b) => s + b.balance, 0);

    return {
      totalItems: activeItems.length,
      totalSKUs: activeItems.length,
      totalStock,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      nearExpiryCount: nearExpiryItems.length,
      expiredCount: expiredItems.length,
      totalEmployees: employees.filter(e => e.status === 'Active').length,
      totalTransactions: stockInRecords.length + stockOutRecords.length,
      ppeStock,
    };
  }, [masterItems, employees, stockInRecords, stockOutRecords, batchLedger]);

  const stockMovementData = useMemo(() => {
    const days = 30;
    const data = [];
    for (let i = days; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const shortDate = format(date, 'MMM dd');
      const inCount = stockInRecords.filter(r => r.receiptDate === dateStr).reduce((s, r) => s + r.quantity, 0);
      const outCount = stockOutRecords.filter(r => r.issueDate === dateStr).reduce((s, r) => s + r.quantity, 0);
      data.push({ date: shortDate, stockIn: inCount, stockOut: outCount });
    }
    return data;
  }, [stockInRecords, stockOutRecords]);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    batchLedger.forEach(b => {
      const item = masterItems.find(i => i.id === b.itemId);
      if (item) {
        cats[item.category] = (cats[item.category] || 0) + b.balance;
      }
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [batchLedger, masterItems]);

  const topIssuedItems = useMemo(() => {
    const issued: Record<string, { name: string; qty: number }> = {};
    stockOutRecords.forEach(r => {
      if (!issued[r.itemId]) issued[r.itemId] = { name: r.itemName, qty: 0 };
      issued[r.itemId].qty += r.quantity;
    });
    return Object.values(issued).sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [stockOutRecords]);

  const expiryBreakdown = useMemo(() => {
    let expired = 0, nearExpiry = 0, warning = 0, healthy = 0;
    batchLedger.filter(b => b.balance > 0).forEach(b => {
      const status = getExpiryStatus(b.expiryDate);
      if (status === 'Expired') expired += b.balance;
      else if (status === 'Near Expiry') nearExpiry += b.balance;
      else if (status === 'Warning') warning += b.balance;
      else healthy += b.balance;
    });
    return [
      { name: 'Expired', value: expired },
      { name: 'Near Expiry', value: nearExpiry },
      { name: 'Warning', value: warning },
      { name: 'Healthy', value: healthy },
    ].filter(d => d.value > 0);
  }, [batchLedger]);

  const recentTransactions = useMemo(() => {
    const all = [
      ...stockInRecords.map(r => ({ type: 'Stock In' as const, date: r.createdAt, ref: r.grnNumber, item: r.itemName, qty: r.quantity })),
      ...stockOutRecords.map(r => ({ type: 'Stock Out' as const, date: r.createdAt, ref: r.issueNumber, item: r.itemName, qty: r.quantity })),
    ];
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
  }, [stockInRecords, stockOutRecords]);

  const statCards = [
    { label: 'Total Items', value: stats.totalItems, icon: Package, color: 'bg-blue-500', textColor: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Total Stock', value: formatNumber(stats.totalStock), icon: Boxes, color: 'bg-emerald-500', textColor: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { label: 'Active SKUs', value: stats.totalSKUs, icon: TrendingUp, color: 'bg-purple-500', textColor: 'text-purple-600', bgColor: 'bg-purple-50' },
    { label: 'Low Stock Items', value: stats.lowStockCount, icon: AlertTriangle, color: 'bg-yellow-500', textColor: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    { label: 'Out of Stock', value: stats.outOfStockCount, icon: ShoppingCart, color: 'bg-red-500', textColor: 'text-red-600', bgColor: 'bg-red-50' },
    { label: 'Near Expiry', value: stats.nearExpiryCount, icon: Clock, color: 'bg-orange-500', textColor: 'text-orange-600', bgColor: 'bg-orange-50' },
    { label: 'Expired Items', value: stats.expiredCount, icon: AlertTriangle, color: 'bg-red-600', textColor: 'text-red-600', bgColor: 'bg-red-50' },
    { label: 'Total Employees', value: stats.totalEmployees, icon: Users, color: 'bg-indigo-500', textColor: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    { label: 'Transactions', value: stats.totalTransactions, icon: DollarSign, color: 'bg-teal-500', textColor: 'text-teal-600', bgColor: 'bg-teal-50' },
    { label: 'PPE Stock', value: stats.ppeStock, icon: Package, color: 'bg-pink-500', textColor: 'text-pink-600', bgColor: 'bg-pink-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time warehouse overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`w-10 h-10 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.textColor}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ArrowDown className="w-4 h-4 text-green-500" /> Stock In Trend (30 days)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stockMovementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={6} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="stockIn" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ArrowUp className="w-4 h-4 text-blue-500" /> Stock Out Trend (30 days)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stockMovementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={6} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="stockOut" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Expiry Analysis</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={expiryBreakdown}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {expiryBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Stock by Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Issued Items</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topIssuedItems} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="qty" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Stock Movement Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={stockMovementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={6} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="stockIn" stroke="#10B981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="stockOut" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Reference</th>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Quantity</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentTransactions.map((tx, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <span className={tx.type === 'Stock In' ? 'badge-green' : 'badge-blue'}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="table-cell font-medium">{tx.ref}</td>
                  <td className="table-cell">{tx.item}</td>
                  <td className="table-cell">{tx.qty}</td>
                  <td className="table-cell text-gray-500">{format(new Date(tx.date), 'dd MMM yyyy HH:mm')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(stats.nearExpiryCount > 0 || stats.expiredCount > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div>
              <h4 className="font-medium text-yellow-800">Expiry Alert</h4>
              <p className="text-sm text-yellow-600">
                You have {stats.nearExpiryCount} batches near expiry and {stats.expiredCount} expired batches requiring attention.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
