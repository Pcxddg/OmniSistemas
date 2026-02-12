import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertTriangle, ChefHat, Flame, UtensilsCrossed, Timer, RefreshCw } from 'lucide-react';
import { OrderType } from '../types';
import { supabase } from '../supabase';

// Interface for Kitchen View
interface KitchenOrder {
  id: string;
  table_id: string; // We'll try to fetch table name if possible
  table_name?: string; // Derived
  order_type_id: string;
  order_type_name?: string; // Derived
  user_id: string; // Waiter
  created_at: string;
  notes: string;
  items: {
    id: string;
    product: { name: string };
    quantity: number;
    modifiers: any[]; // JSONB
  }[];
}

const Kitchen: React.FC = () => {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update timer every minute to refresh "Time Elapsed" UI
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchOrders = async () => {
    // setLoading(true); // Don't show spinner on background refresh
    try {
      // Fetch Pending Orders
      // We need deeply nested data: Order -> Items -> Product
      // Also Order -> Table, Order -> OrderType
      const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (
                id,
                quantity,
                modifiers,
                products (name)
            ),
            tables (name),
            order_types (name)
        `)
        .in('status', ['pending']) // Updated to match likely statuses
        .order('created_at', { ascending: true }); // Oldest first

      if (error) throw error;

      // Transform data to flat structure for easier rendering
      const formattedOrders = data?.map((o: any) => {
        // Debug
        // console.log("Order Data:", o); 
        return {
          ...o,
          table_name: o.tables?.name || 'Mostrador',
          order_type_name: o.order_types?.name || 'General',
          items: o.order_items?.map((i: any) => ({
            ...i,
            product: i.products // Flatten product name
          }))
        }
      }) || [];

      setOrders(formattedOrders);

    } catch (err) {
      console.error("Error fetching kitchen orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true); // Initial load only
    fetchOrders();
    // Poll every 10 seconds
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCompleteOrder = async (id: string) => {
    if (confirm('¿Marcar orden como despachada?')) {
      try {
        const { error } = await supabase
          .from('orders')
          .update({ status: 'completed' })
          .eq('id', id);

        if (error) throw error;

        // Optimistic update
        setOrders(prev => prev.filter(o => o.id !== id));
      } catch (err) {
        console.error("Error completing order:", err);
        alert("Error al completar orden.");
      }
    }
  };

  const getElapsedTime = (dateString: string) => {
    const start = new Date(dateString);
    const diffMs = currentTime.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins;
  };

  const getUrgencyStyles = (minutes: number) => {
    if (minutes >= 20) return 'border-red-500 bg-red-50 ring-1 ring-red-200';
    if (minutes >= 10) return 'border-orange-400 bg-orange-50';
    return 'border-green-500 bg-green-50';
  };

  const getHeaderColor = (minutes: number) => {
    if (minutes >= 20) return 'bg-red-600 text-white';
    if (minutes >= 10) return 'bg-orange-500 text-white';
    return 'bg-green-600 text-white';
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-100">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ChefHat className="text-brand-600" size={32} />
            Monitor de Cocina (KDS)
          </h1>
          <p className="text-slate-500">Gestión de comandas en tiempo real</p>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={fetchOrders} className="p-2 bg-white rounded-full shadow hover:bg-slate-50 text-slate-500">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs font-bold text-slate-600">A tiempo (&lt;10m)</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-xs font-bold text-slate-600">Retrasado (10-20m)</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <span className="text-xs font-bold text-slate-600">Crítico (&gt;20m)</span>
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400">
          <UtensilsCrossed size={64} className="mb-4 opacity-20" />
          <h2 className="text-2xl font-bold text-slate-300">Todo limpio, Chef.</h2>
          <p>No hay órdenes pendientes en este momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {orders.map((order) => {
            const elapsed = getElapsedTime(order.created_at);

            return (
              <div key={order.id} className={`flex flex-col rounded-xl shadow-md border-t-4 overflow-hidden bg-white ${getUrgencyStyles(elapsed)}`}>

                {/* Header */}
                <div className={`p-3 flex justify-between items-start ${getHeaderColor(elapsed)}`}>
                  <div>
                    <h3 className="font-bold text-lg leading-none truncate max-w-[150px]">{order.table_name || 'Sin Mesa'}</h3>
                    <span className="text-xs opacity-90 font-mono">#{order.id.slice(0, 6)} • {order.user_id}</span>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 font-bold text-lg">
                      <Timer size={18} />
                      {elapsed} min
                    </div>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-black/20 rounded">
                      {order.order_type_name}
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div className="p-4 flex-1 overflow-y-auto max-h-[400px] bg-white/60">
                  <ul className="space-y-4">
                    {order.items.map((item, idx) => (
                      <li key={idx} className="border-b border-slate-200 pb-3 last:border-0 last:pb-0">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-slate-800 text-lg">{item.quantity}x {item.product?.name}</span>
                        </div>

                        {/* Modifiers */}
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.modifiers.map((mod: any, i: number) => (
                              <span key={i} className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                {mod.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {order.notes && (
                    <div className="mt-3 flex items-start gap-1 text-xs text-slate-600 italic bg-yellow-50 p-2 rounded border border-yellow-100">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5 text-yellow-600" />
                      {order.notes}
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="p-3 bg-white border-t border-slate-100">
                  <button
                    onClick={() => handleCompleteOrder(order.id)}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-slate-500/20"
                  >
                    <CheckCircle size={20} />
                    <span>Marcar como Listo</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Kitchen;