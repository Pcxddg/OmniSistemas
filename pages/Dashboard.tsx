import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, TrendingUp, Users, ShoppingBag, RefreshCw, Calculator, Award, CreditCard, ChevronUp, TrendingDown
} from 'lucide-react';
import { supabase } from '../supabase';
import { calculateOrderTotalCost } from '../utils/financials';

const COLORS = ['#1e293b', '#334155', '#475569', '#64748b'];


interface OrderItem {
  quantity: number;
  unit_price: number;
  unit_cost?: number; // Snapshot of cost at time of order
  modifiers?: any[];
  products: {
    cost_price: number;
    name: string;
  } | null;
}

interface OrderPayment {
  amount: number;
}

interface OrderData {
  id: string;
  total: number;
  created_at: string;
  status: string;
  order_items: OrderItem[];
  order_payments: OrderPayment[];
}

const Dashboard: React.FC = () => {
  const [exchangeRate, setExchangeRate] = useState<number>(36.5);
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('today'); // Step 9.10: added yesterday/custom
  const [customDateStart, setCustomDateStart] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customDateEnd, setCustomDateEnd] = useState<string>(new Date().toISOString().split('T')[0]);
  const [topItemsMetric, setTopItemsMetric] = useState<'quantity' | 'revenue'>('quantity'); // Step 9.7: Metric Toggle
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    grossIncome: 0,
    totalCost: 0,
    netProfit: 0,
    receiptsCount: 0,
    averageMargin: 0,
    topItems: [] as { name: string, value: number, revenue: number }[], // Step 9.7: Updated structure
    topEmployees: [] as { name: string, sales: number, count: number }[], // Step 9.8
    topTerminals: [] as { name: string, sales: number, count: number }[],  // Step 9.9
    salesChartData: [] as { name: string, sales: number, costos: number }[],
    topCustomers: [
      { name: 'Maria Perez', visits: 12, spent: 450 },
      { name: 'Carlos Ruiz', visits: 10, spent: 380 },
      { name: 'Ana Silva', visits: 8, spent: 320 },
    ]
  });

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, topItemsMetric, customDateStart, customDateEnd]); // Refetch/Recalculate on filter change

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. Calculate Date Range (Step 9.10)
      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      let endDate: Date | null = null; // null means 'now'

      if (dateRange === 'yesterday') {
        startDate.setDate(startDate.getDate() - 1);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (dateRange === 'week') {
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate.setDate(diff);
      } else if (dateRange === 'month') {
        startDate.setDate(1);
      } else if (dateRange === 'all') {
        startDate = new Date(0);
      } else if (dateRange === 'custom') {
        startDate = new Date(customDateStart);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customDateEnd);
        endDate.setHours(23, 59, 59, 999);
      }

      // 1. FETCH COLLECTED SALES (Step 9.1 & 9.2: Only non-draft, non-cancelled) with DATE FILTER
      let query = supabase
        .from('orders')
        .select(`
          id,
          total,
          created_at,
          status,
          user_id,
          cash_register_id,
          order_items (
            quantity,
            unit_price,
            unit_cost,
            modifiers,
            products (cost_price, name)
          ),
          order_payments (
            amount
          )
        `)
        .neq('status', 'draft')
        .neq('status', 'cancelled')
        .gte('created_at', startDate.toISOString());

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error: ordersError } = await query;

      if (ordersError) throw ordersError;

      const orders = (data as unknown) as any[];

      // Calculate Metrics
      let totalGross = 0;
      let totalCost = 0;
      let totalReceipts = 0;
      const productStats: Record<string, { quantity: number, revenue: number }> = {};
      const employeeStats: Record<string, { sales: number, count: number }> = {};
      const terminalStats: Record<string, { sales: number, count: number }> = {};

      orders?.forEach(order => {
        // Step 9.2: Gross Income must match collected funds
        const orderPaymentsSum = order.order_payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;

        totalGross += orderPaymentsSum;
        totalReceipts++;

        // Step 9.3: Total Cost Calculation using Utility
        // We calculate cost based on snapshot 'unit_cost' if available, otherwise current 'products.cost_price'
        const mappedItems = order.order_items?.map((item: any) => ({
          ...item,
          unit_cost: item.unit_cost || item.products?.cost_price || 0
        })) || [];

        const orderCost = calculateOrderTotalCost(mappedItems);
        totalCost += orderCost;

        order.order_items?.forEach((item: any) => {
          const productName = item.products?.name || 'Unknown';
          const qty = Number(item.quantity);
          const rev = Number(item.unit_price) * qty; // Basic revenue per item line (excluding tax logic for simplicity here)

          if (!productStats[productName]) {
            productStats[productName] = { quantity: 0, revenue: 0 };
          }
          productStats[productName].quantity += qty;
          productStats[productName].revenue += rev;
        });

        // Employees (Step 9.8)
        const empId = order.user_id || 'Unknown';
        if (!employeeStats[empId]) employeeStats[empId] = { sales: 0, count: 0 };
        employeeStats[empId].sales += orderPaymentsSum;
        employeeStats[empId].count += 1;

        // Terminals (Step 9.9)
        const termId = order.cash_register_id || 'Unknown';
        if (!terminalStats[termId]) terminalStats[termId] = { sales: 0, count: 0 };
        terminalStats[termId].sales += orderPaymentsSum;
        terminalStats[termId].count += 1;
      });

      const netProfit = totalGross - totalCost;
      const margin = totalGross > 0 ? (netProfit / totalGross) * 100 : 0;

      // Step 9.7: Top 10 Sorting Logic
      const sortedItems = Object.entries(productStats)
        .map(([name, stat]) => ({ name, value: stat.quantity, revenue: stat.revenue }))
        .sort((a, b) => {
          if (topItemsMetric === 'revenue') return b.revenue - a.revenue;
          return b.value - a.value;
        })
        .slice(0, 10); // Top 10

      // Sort Top Employees
      const sortedEmployees = Object.entries(employeeStats)
        .map(([id, stat]) => ({ name: id === 'Unknown' ? 'Sin Asignar' : id.substring(0, 8), sales: stat.sales, count: stat.count })) // Use ID substring as name fallback
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

      // Sort Top Terminals
      const sortedTerminals = Object.entries(terminalStats)
        .map(([id, stat]) => ({ name: id === 'Unknown' ? 'Sin Caja' : `Caja ${id.substring(0, 4)}`, sales: stat.sales, count: stat.count }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

            // Build Sales Chart Data from real orders
      const dailyStats: Record<string, { sales: number, cost: number }> = {};
      orders?.forEach(order => {
        const dateKey = new Date(order.created_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
        if (!dailyStats[dateKey]) dailyStats[dateKey] = { sales: 0, cost: 0 };
        const orderPayments = order.order_payments?.reduce((s: number, p: any) => s + Number(p.amount), 0) || 0;
        const mappedCostItems = order.order_items?.map((item: any) => ({
          ...item,
          unit_cost: item.unit_cost || item.products?.cost_price || 0
        })) || [];
        dailyStats[dateKey].sales += orderPayments;
        dailyStats[dateKey].cost += calculateOrderTotalCost(mappedCostItems);
      });
      const salesChartData = Object.entries(dailyStats)
        .map(([name, d]) => ({ name, sales: Math.round(d.sales * 100) / 100, costos: Math.round(d.cost * 100) / 100 }));

      setStats(prev => ({
        ...prev,
        grossIncome: totalGross,
        totalCost: totalCost,
        netProfit: netProfit,
        receiptsCount: totalReceipts,
        averageMargin: Math.round(margin), // Step 9.6: This is Average Margin
        topItems: sortedItems,
        topEmployees: sortedEmployees,
        topTerminals: sortedTerminals,
        salesChartData: salesChartData
      }));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-500 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest animate-pulse">Sincronizando Métricas...</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="text-left">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard Central</h1>
            <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded border border-emerald-200 shadow-sm flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              En Vivo
            </div>
          </div>
          <p className="text-slate-500 text-sm">Paso 9.10: Filtros, Empleados y Terminales</p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Step 9.10: Enhanced Date Range Filter UI */}
          <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex items-center flex-wrap gap-1">
            {[
              { key: 'today', label: 'Hoy' },
              { key: 'yesterday', label: 'Ayer' },
              { key: 'week', label: 'Semana' },
              { key: 'month', label: 'Mes' },
              { key: 'all', label: 'Histórico' },
              { key: 'custom', label: 'Rango' }
            ].map((range) => (
              <button
                key={range.key}
                onClick={() => setDateRange(range.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dateRange === range.key
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200">
              <input type="date" value={customDateStart} onChange={(e) => setCustomDateStart(e.target.value)} className="text-[10px] font-bold text-slate-600 outline-none" />
              <span className="text-slate-400">-</span>
              <input type="date" value={customDateEnd} onChange={(e) => setCustomDateEnd(e.target.value)} className="text-[10px] font-bold text-slate-600 outline-none" />
            </div>
          )}


          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 flex items-center gap-4 group hover:shadow-md transition-all">
            <div className="p-3 bg-slate-900 rounded-xl text-white shadow-lg shadow-slate-200 group-hover:scale-105 transition-transform">
              <RefreshCw size={20} />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1.5">Tasa del Día</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value))}
                  className="w-20 bg-transparent border-b border-slate-100 text-lg font-black text-slate-900 focus:outline-none focus:border-brand-500 text-right transition-colors"
                />
                <span className="text-slate-400 text-xs font-black">Bs/$</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { title: "Ingreso Bruto", value: `$${stats.grossIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
          { title: "Costo Operativo", value: `$${stats.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: TrendingDown, color: "text-rose-600", bg: "bg-rose-50" },
          { title: "Ganancia Neta", value: `$${stats.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
          // Step 9.5: Restored Receipts Card
          { title: "Recibos (Volumen)", value: stats.receiptsCount.toString(), icon: ShoppingBag, color: "text-amber-600", bg: "bg-amber-50" },
          { title: "Margen Promedio", value: `${stats.averageMargin}%`, icon: Calculator, color: "text-purple-600", bg: "bg-purple-50" }, // Step 9.6 Renamed
        ].map((card, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 text-left transition-all hover:shadow-lg relative overflow-hidden group">
            <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${card.color}`}>
              <card.icon size={80} />
            </div>
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.title}</p>
                <h3 className="text-2xl font-black text-slate-900">{card.value}</h3>
              </div>
              <div className={`p-2.5 rounded-xl ${card.bg} ${card.color} border border-current opacity-20`}>
                <card.icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 text-left relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-900"></div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <TrendingUp size={14} className="text-slate-900" />
            Rendimiento de Ventas Histórico
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.salesChartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e293b" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#1e293b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontStyle: 'bold', fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontStyle: 'bold', fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="sales" name="Ventas" stroke="#1e293b" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="costos" name="Costos" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 6" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-left relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Calculator size={14} className="text-slate-900" />
              Top 10 Artículos
            </h3>
            {/* Step 9.7: Toggle for Metric */}
            <div className="bg-slate-100 p-0.5 rounded-lg flex">
              <button
                onClick={() => setTopItemsMetric('quantity')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${topItemsMetric === 'quantity' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
              >
                Cant.
              </button>
              <button
                onClick={() => setTopItemsMetric('revenue')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${topItemsMetric === 'revenue' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
              >
                $$$
              </button>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.topItems.length > 0 ? stats.topItems : [{ name: 'Sin Ventas', value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={8}
                  dataKey={topItemsMetric === 'quantity' ? "value" : "revenue"} // Dynamic Key
                >
                  {(stats.topItems.length > 0 ? stats.topItems : [{ name: 'N/A', value: 1 }]).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-2.5 overflow-y-auto max-h-[150px] pr-2 scrollbar-thin">
            {stats.topItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between group">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors uppercase truncate max-w-[120px]">{item.name}</span>
                </div>
                <span className="text-[11px] font-black text-slate-900 bg-slate-50 px-2 py-0.5 rounded-full">
                  {topItemsMetric === 'quantity' ? `${item.value} und.` : `$${item.revenue.toFixed(2)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Employees & Terminals (Step 9.8 & 9.9) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-left">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Award size={16} className="text-yellow-500" />
            Top Empleados (Ventas)
          </h3>
          <div className="space-y-5">
            {stats.topEmployees.length > 0 ? stats.topEmployees.map((emp, i) => (
              <div key={i} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-black text-slate-900 text-sm border border-slate-300 shadow-sm group-hover:scale-105 transition-transform">
                    {emp.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm leading-none mb-1">{emp.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{emp.count} Ordenes</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-brand-600 text-sm">${emp.sales.toFixed(2)}</p>
                </div>
              </div>
            )) : <p className="text-slate-400 text-xs italic">Sin datos de empleados</p>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-left">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Users size={16} className="text-brand-500" />
            Lealtad de Clientes
          </h3>
          <div className="space-y-5">
            {stats.topCustomers.map((customer, i) => (
              <div key={i} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-black text-xs border border-brand-100 shadow-inner group-hover:rotate-12 transition-transform">
                    {customer.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm leading-none mb-1">{customer.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{customer.visits} Visitas Registradas</p>
                  </div>
                </div>
                <p className="font-black text-slate-900 text-sm">${customer.spent}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-left">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <CreditCard size={16} className="text-emerald-500" />
            Top Terminales / Cajas
          </h3>
          <div className="space-y-5">
            {stats.topTerminals.length > 0 ? stats.topTerminals.map((term, i) => (
              <div key={i} className="flex items-center justify-between bg-emerald-50/30 p-3 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-200">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm leading-none mb-1">{term.name}</p>
                    <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Activa</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-emerald-700 text-sm">${term.sales.toFixed(2)}</p>
                  <p className="text-[9px] text-emerald-500 font-bold uppercase">{term.count} Ops</p>
                </div>
              </div>
            )) : <p className="text-slate-400 text-xs italic">Sin datos de terminales</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;