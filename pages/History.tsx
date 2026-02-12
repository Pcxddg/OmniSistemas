import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, AlertTriangle, FileText, Settings, RefreshCw, ExternalLink, Eye, X, ArrowRight, ShoppingCart, Truck, Hammer, Package, Ban, TrendingUp, TrendingDown, DollarSign, Percent, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { calculateLineItemCost, calculateOrderTotalCost } from '../utils/financials';

// Enhanced Log Structure
interface HistoryEvent {
   id: string; // Changed to string for UUIDs
   type: 'RATE_CHANGE' | 'INVENTORY' | 'ORDER_CANCEL' | 'PRODUCTION' | 'PURCHASE' | 'SALE';
   title: string;
   user: string;
   date: string;
   referenceId?: string; // The "Link" ID
   status?: string; // For Orders
   payload?: any;
   originalData?: any; // Store raw data for actions
}

const getIcon = (type: string) => {
   switch (type) {
      case 'RATE_CHANGE': return <RefreshCw size={18} className="text-blue-600" />;
      case 'ORDER_CANCEL': return <Ban size={18} className="text-red-600" />;
      case 'SALE': return <ShoppingCart size={18} className="text-green-600" />;
      case 'INVENTORY': return <Package size={18} className="text-orange-600" />;
      case 'PRODUCTION': return <Hammer size={18} className="text-purple-600" />;
      case 'PURCHASE': return <Truck size={18} className="text-green-600" />;
      default: return <FileText size={18} className="text-slate-600" />;
   }
};

const getBadgeColor = (type: string) => {
   switch (type) {
      case 'RATE_CHANGE': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ORDER_CANCEL': return 'bg-red-100 text-red-700 border-red-200';
      case 'SALE': return 'bg-green-50 text-green-700 border-green-200';
      case 'INVENTORY': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'PRODUCTION': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'PURCHASE': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
   }
};

const History: React.FC = () => {
   const { user } = useAuth();
   const [events, setEvents] = useState<HistoryEvent[]>([]);
   const [loading, setLoading] = useState(true);
   const [selectedEvent, setSelectedEvent] = useState<HistoryEvent | null>(null);
   const [filter, setFilter] = useState('ALL');

   const [activeTab, setActiveTab] = useState<'sales' | 'audit'>('sales');
   const [auditLogs, setAuditLogs] = useState<any[]>([]);
   const [selectedAudit, setSelectedAudit] = useState<any | null>(null);

   const fetchHistory = async () => {
      setLoading(true);
      try {
         // Fetch Orders
         const { data: orders, error: orderError } = await supabase
            .from('orders')
            .select('*, order_items(*, products(name))')
            .order('created_at', { ascending: false });

         if (orderError) throw orderError;

         // Transform Orders into Events
         const orderEvents: HistoryEvent[] = orders ? orders.map((o: any) => ({
            id: o.id,
            type: o.status === 'cancelled' ? 'ORDER_CANCEL' : 'SALE',
            title: o.status === 'cancelled' ? 'Venta Cancelada' : 'Venta Completada POS',
            user: o.user_id || 'Sistema',
            date: new Date(o.created_at).toLocaleString(),
            referenceId: `#${o.id.slice(0, 8)}`,
            status: o.status,
            originalData: o,
            payload: {
               total: o.total,
               items: o.order_items.map((i: any) => `${i.quantity}x ${i.products?.name}`),
               reason: o.notes || 'Sin motivo'
            }
         })) : [];

         setEvents([...orderEvents]);

      } catch (error) {
         console.error("Error fetching history:", error);
      } finally {
         setLoading(false);
      }
   };

   const fetchAuditLogs = async () => {
      setLoading(true);
      const { data, error } = await supabase
         .from('audit_logs')
         .select('*')
         .order('created_at', { ascending: false })
         .limit(100);

      if (error) {
         console.error("Error fetching audit logs:", error);
      } else {
         setAuditLogs(data || []);
      }
      setLoading(false);
   };

   useEffect(() => {
      if (activeTab === 'sales') fetchHistory();
      else fetchAuditLogs();
   }, [activeTab]);

   // Step 5.8: Simple Aggregates
   const stats = useMemo(() => {
      let revenue = 0;
      let cost = 0;
      let saleCount = 0;

      events.forEach(e => {
         if (e.type === 'SALE' && e.status !== 'cancelled') {
            revenue += (e.payload?.total || 0);
            cost += calculateOrderTotalCost(e.originalData?.order_items || []);
            saleCount++;
         }
      });

      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return { revenue, cost, profit, margin, saleCount };
   }, [events]);

   const handleCancelOrder = async (order: any) => {
      // Guard: Prevent double-cancellation
      if (order.status === 'cancelled') {
         alert("Esta orden ya fue cancelada anteriormente.");
         return;
      }

      if (!confirm(`¿Está seguro de cancelar la orden #${order.id.slice(0, 8)}? Esto revertirá el inventario.`)) return;

      try {
         // Double-check in DB to prevent race conditions
         const { data: currentOrder, error: checkError } = await supabase
            .from('orders')
            .select('status')
            .eq('id', order.id)
            .single();

         if (checkError) throw checkError;
         if (currentOrder.status === 'cancelled') {
            alert("Esta orden ya fue cancelada por otro usuario.");
            fetchHistory();
            return;
         }

         // 1. Update Order Status
         const { error: updateError } = await supabase
            .from('orders')
            .update({ status: 'cancelled', notes: 'Cancelado manualmente desde Historial' })
            .eq('id', order.id)
            .neq('status', 'cancelled'); // Cancel any non-cancelled order (atomic guard)

         if (updateError) throw updateError;

         // 2. Revert Inventory (Entrance)
         const movements = order.order_items.map((item: any) => ({
            product_id: item.product_id,
            type: 'entrada',
            quantity: item.quantity,
            reason: `Reverso POS #${order.id.slice(0, 8)}`
         }));

         const { error: moveError } = await supabase
            .from('inventory_movements')
            .insert(movements);

         if (moveError) throw moveError;

         // Step 10.4: Audit Log for Sales Cancellation
         await supabase.from('audit_logs').insert([{
            entity: 'order',
            entity_id: order.id,
            action: 'cancel',
            user_id: user?.id || 'unknown',
            old_value: { status: currentOrder.status, total: order.total },
            new_value: { status: 'cancelled', reason: 'Cancelado manualmente desde Historial' }
         }]);

         alert("Orden cancelada e inventario revertido correctamente.");
         fetchHistory(); // Refresh
         setSelectedEvent(null);

      } catch (error) {
         console.error("Error cancelling order:", error);
         alert("Error al cancelar la orden.");
      }
   };

   // --- Dynamic Content Renderer for Modal ---
   const renderEventDetails = (event: HistoryEvent) => {
      // Default view for Sales/Cancellations
      return (
         <div className="space-y-4">
            <div className={`flex justify-between items-center p-3 rounded-lg border ${event.type === 'ORDER_CANCEL' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
               <span className={`font-bold ${event.type === 'ORDER_CANCEL' ? 'text-red-800' : 'text-green-800'}`}>
                  {event.type === 'ORDER_CANCEL' ? 'Cancelado' : 'Completado'}
               </span>
               <span className="font-mono font-bold text-lg">{event.referenceId}</span>
            </div>

            <div>
               <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Detalle Financiero del Pedido</h4>
               <div className="space-y-4 mb-4">
                  {event.originalData?.order_items?.map((item: any, idx: number) => {
                     // Step 5.3: Calculate Total Cost per Item
                     const quantity = item.quantity;
                     const baseCost = item.unit_cost || 0;

                     // Sum modifier costs
                     let modifiersCost = 0;
                     let modifiersText = "";
                     if (item.modifiers && Array.isArray(item.modifiers)) {
                        modifiersCost = item.modifiers.reduce((acc: number, mod: any) => acc + (mod.cost || 0), 0);
                        modifiersText = item.modifiers.map((m: any) => m.name).join(', ');
                     }

                     const totalUnitCost = baseCost + modifiersCost;
                     // Use verified utility for line total to ensure consistency
                     const totalLineCost = calculateLineItemCost(item);

                     // Price (Revenue)
                     const unitPrice = item.unit_price;
                     let modifiersPrice = 0;
                     if (item.modifiers && Array.isArray(item.modifiers)) {
                        modifiersPrice = item.modifiers.reduce((acc: number, mod: any) => acc + (mod.price || 0), 0);
                     }
                     const totalUnitPrice = unitPrice + modifiersPrice;
                     const totalLinePrice = totalUnitPrice * quantity;

                     return (
                        <div key={idx} className="text-sm border-b border-slate-100 pb-2">
                           <div className="flex justify-between font-bold text-slate-700">
                              <span>{quantity}x {item.products?.name}</span>
                              <span>${totalLinePrice.toFixed(2)}</span>
                           </div>
                           {modifiersText && <p className="text-xs text-slate-400">+ {modifiersText}</p>}

                           {/* Cost Breakdown (Step 5.3 Verification) */}
                           <div className="mt-1 text-[10px] bg-slate-50 p-1 rounded border border-slate-200 text-slate-500 font-mono">
                              <div className="flex justify-between">
                                 <span>Costo Base:</span>
                                 <span>${baseCost.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                 <span>Costo Mods:</span>
                                 <span>${modifiersCost.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-bold border-t border-slate-200 mt-1 pt-1 text-slate-600">
                                 <span>Costo Total Unit:</span>
                                 <span>${totalUnitCost.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-bold text-slate-800">
                                 <span>Costo Total Línea:</span>
                                 <span>${totalLineCost.toFixed(2)}</span>
                              </div>
                           </div>
                        </div>
                     );
                  })}
               </div>

               <div className="border-t border-slate-200 pt-2 space-y-1">
                  <div className="flex justify-between items-center font-bold text-slate-800 text-lg">
                     <span>Total Venta (PVP):</span>
                     <span>${event.payload.total?.toFixed(2)}</span>
                  </div>

                  {/* Step 5.4: Display Total Order Cost (admin/manager only view usually) */}
                  <div className="flex justify-between items-center font-bold text-slate-500 text-sm font-mono bg-slate-100 p-2 rounded">
                     <span>Costo Total (Interno):</span>
                     <span>${calculateOrderTotalCost(event.originalData?.order_items || []).toFixed(2)}</span>
                  </div>
               </div>

               {/* Step 5.6: Calculate Profit */}
               {(() => {
                  const totalRevenue = event.payload.total || 0;
                  // Note: Ideally revenue should be Net Revenue (excl tax), but for this step using Total as requested proxy for "Ingreso"
                  // If tax is included in total, profit margin is lower. Assuming Total = Billed Amount.
                  const totalCost = calculateOrderTotalCost(event.originalData?.order_items || []);
                  const profit = totalRevenue - totalCost;
                  const isPositive = profit > 0;

                  return (
                     <div className={`p-2 rounded border-2 ${isPositive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        <div className="flex justify-between items-center font-bold text-lg">
                           <span>Ganancia Neta:</span>
                           <span>${profit.toFixed(2)}</span>
                        </div>
                        {/* Step 5.7: Profit Margin */}
                        <div className="flex justify-end mt-1">
                           <span className="text-xs font-mono font-bold bg-white/50 px-2 py-0.5 rounded">
                              Margen: {totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0.0'}%
                           </span>
                        </div>
                     </div>
                  );
               })()}
            </div>

            {
               event.type === 'SALE' && event.status !== 'cancelled' && (
                  <button
                     onClick={() => handleCancelOrder(event.originalData)}
                     className="w-full mt-4 bg-red-100 hover:bg-red-200 text-red-700 font-bold py-3 rounded-lg flex items-center justify-center gap-2 border border-red-200 transition-colors"
                  >
                     <Ban size={18} />
                     CANCELAR ORDEN Y REVERTIR STOCK
                  </button>
               )
            }

            {
               event.type === 'ORDER_CANCEL' && (
                  <div className="bg-slate-100 p-3 rounded-lg">
                     <span className="block text-xs font-bold text-slate-500 uppercase">Motivo</span>
                     <p className="text-slate-700 italic">"{event.payload.reason}"</p>
                  </div>
               )
            }
         </div >
      );
   };

   return (
      <div className="p-6 h-full overflow-y-auto relative bg-slate-50/50">
         <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
               <h1 className="text-3xl font-bold text-slate-900">Historial & Auditoría</h1>
               <p className="text-slate-500">Registro de operaciones, ventas y trazabilidad</p>
            </div>

            <div className="flex bg-slate-200 p-1 rounded-lg">
               <button
                  onClick={() => setActiveTab('sales')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'sales' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                  Ventas
               </button>
               <button
                  onClick={() => setActiveTab('audit')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'audit' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                  Auditoría Sistema
               </button>
            </div>
         </div>

         {/* SALES TAB CONTENT */}
         {activeTab === 'sales' && (
            <>
               {/* Sales Stats - ONLY visible in Sales Tab */}
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* ... Existing stats helper widgets ... */}
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={20} /></div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Ingresos</span>
                     </div>
                     <div className="text-2xl font-black text-slate-800">${stats.revenue.toFixed(2)}</div>
                     <div className="text-xs text-slate-400 mt-1">{stats.saleCount} ventas</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-slate-50 text-slate-600 rounded-lg"><TrendingDown size={20} /></div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Costos</span>
                     </div>
                     <div className="text-2xl font-black text-slate-800">${stats.cost.toFixed(2)}</div>
                     <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Base + Extras</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-50 text-green-600 rounded-lg"><TrendingUp size={20} /></div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Ganancia Neta</span>
                     </div>
                     <div className={`text-2xl font-black ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${stats.profit.toFixed(2)}</div>
                     <div className="text-xs text-slate-400 mt-1">Real (Ingreso - Costo)</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Percent size={20} /></div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Margen Promedio</span>
                     </div>
                     <div className="text-2xl font-black text-slate-800">{stats.margin.toFixed(1)}%</div>
                     <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, stats.margin))}%` }}></div>
                     </div>
                  </div>
               </div>

               <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold border-b border-slate-200">
                           <tr>
                              <th className="px-6 py-4">Evento</th>
                              <th className="px-6 py-4">Descripción</th>
                              <th className="px-6 py-4">Referencia</th>
                              <th className="px-6 py-4">Responsable</th>
                              <th className="px-6 py-4">Fecha</th>
                              <th className="px-6 py-4 text-right">Acción</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {events.length === 0 ? (
                              <tr>
                                 <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">
                                    No se encontraron eventos recientes.
                                 </td>
                              </tr>
                           ) : (
                              events.map((item) => (
                                 <tr key={item.id} className="hover:bg-slate-50 group transition-colors cursor-pointer" onClick={() => setSelectedEvent(item)}>
                                    <td className="px-6 py-4">
                                       <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold border ${getBadgeColor(item.type)}`}>
                                          {getIcon(item.type)}
                                          {item.type === 'SALE' ? 'VENTA' : item.type}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-800 text-sm font-medium">{item.title}</td>
                                    <td className="px-6 py-4">
                                       <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                          {item.referenceId}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 text-sm">{item.user}</td>
                                    <td className="px-6 py-4 text-slate-500 text-xs">{item.date}</td>
                                    <td className="px-6 py-4 text-right">
                                       <button className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800 text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Eye size={16} /> Ver
                                       </button>
                                    </td>
                                 </tr>
                              ))
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </>
         )}

         {/* AUDIT TAB CONTENT */}
         {activeTab === 'audit' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-700 uppercase">Registro de Cambios (Audit Logs)</h3>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold border-b border-slate-200">
                        <tr>
                           <th className="px-6 py-4">Fecha</th>
                           <th className="px-6 py-4">Entidad</th>
                           <th className="px-6 py-4">Acción</th>
                           <th className="px-6 py-4">Usuario</th>
                           <th className="px-6 py-4 text-right">Detalles</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {auditLogs.map((log: any) => (
                           <tr key={log.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                 {new Date(log.created_at).toLocaleString()}
                              </td>
                              <td className="px-6 py-4">
                                 <span className="inline-flex px-2 py-1 bg-slate-100 rounded text-xs font-bold uppercase tracking-wider text-slate-600 border border-slate-200">
                                    {log.entity}
                                 </span>
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-800 text-sm">
                                 {log.action}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                 {log.user_id}
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <button
                                    onClick={() => setSelectedAudit(log)}
                                    className="text-brand-600 hover:text-brand-800 font-bold text-xs border border-brand-200 px-3 py-1 rounded hover:bg-brand-50 transition-colors"
                                 >
                                    Ver Cambios
                                 </button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {/* SALES Detail Modal */}
         {selectedEvent && (
            <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                     <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg border ${getBadgeColor(selectedEvent.type)}`}>
                           {getIcon(selectedEvent.type)}
                        </div>
                        <div>
                           <h3 className="font-bold text-lg text-slate-800">Detalle del Evento</h3>
                           <p className="text-xs text-slate-500 font-mono">{selectedEvent.referenceId} • {selectedEvent.date}</p>
                        </div>
                     </div>
                     <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                     </button>
                  </div>
                  <div className="p-6 overflow-y-auto max-h-[60vh]">
                     {renderEventDetails(selectedEvent)}
                  </div>
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                     <div className="text-xs text-slate-400">
                        User: <strong>{selectedEvent.user}</strong>
                     </div>
                     <button
                        onClick={() => setSelectedEvent(null)}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors"
                     >
                        Cerrar
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* AUDIT Detail Modal */}
         {selectedAudit && (
            <div className="absolute inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                     <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <ShieldCheck size={20} className="text-purple-600" />
                        Detalle Auditoría
                     </h3>
                     <button onClick={() => setSelectedAudit(null)} className="text-slate-400 hover:text-red-500"><X size={24} /></button>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1 font-mono text-xs">
                     <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-3 bg-red-50 rounded border border-red-100">
                           <span className="block font-bold text-red-700 mb-2 uppercase">Valor Anterior</span>
                           <pre className="whitespace-pre-wrap text-slate-700">{JSON.stringify(selectedAudit.old_value, null, 2)}</pre>
                        </div>
                        <div className="p-3 bg-green-50 rounded border border-green-100">
                           <span className="block font-bold text-green-700 mb-2 uppercase">Valor Nuevo</span>
                           <pre className="whitespace-pre-wrap text-slate-700">{JSON.stringify(selectedAudit.new_value, null, 2)}</pre>
                        </div>
                     </div>
                     <div className="bg-slate-50 p-4 rounded border border-slate-200">
                        <p><strong>ID Evento:</strong> {selectedAudit.id}</p>
                        <p><strong>Entidad ID:</strong> {selectedAudit.entity_id}</p>
                     </div>
                  </div>
                  <div className="p-4 border-t border-slate-100 text-right">
                     <button onClick={() => setSelectedAudit(null)} className="px-6 py-2 bg-slate-800 text-white rounded font-bold">Cerrar</button>
                  </div>
               </div>
            </div>
         )}

      </div>
   );
};

export default History;