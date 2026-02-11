import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, AlertCircle, Trash2, Lock, LayoutGrid, Map, CreditCard, List, Monitor, Store, Plus, Edit2, X } from 'lucide-react';
import { supabase } from '../supabase';

interface Zone {
   id: string;
   name: string;
   is_active: boolean;
   tables?: Table[];
}

interface Table {
   id: string;
   zone_id: string;
   name: string;
   capacity: number;
   status: string; // 'available', 'occupied'
}

interface OrderType {
   id: string;
   name: string;
   ask_table: boolean;
   prepay_required: boolean;
   is_active: boolean;
}

interface PaymentMethod {
   id: string;
   name: string;
   type: string;
   is_active: boolean;
}

interface Terminal {
   id: string;
   name: string;
   is_active: boolean;
}

interface AppSetting {
   key: string;
   value: any;
}

const Settings: React.FC = () => {
   const [activeTab, setActiveTab] = useState<'sucursal' | 'zonas' | 'pagos' | 'tipos' | 'terminales' | 'dev'>('sucursal');
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);

   // --- SETTINGS STATE ---
   const [exchangeRate, setExchangeRate] = useState<number>(36.5);
   const [taxRate, setTaxRate] = useState<number>(16);
   const [storeName, setStoreName] = useState<string>('Mi Restaurante');
   const [storeAddress, setStoreAddress] = useState<string>('Dirección Local');
   const [storeRif, setStoreRif] = useState<string>('J-00000000-0');

   // --- ZONES & TABLES STATE ---
   const [zones, setZones] = useState<Zone[]>([]);
   const [editingZone, setEditingZone] = useState<Partial<Zone> | null>(null);
   const [editingTable, setEditingTable] = useState<Partial<Table> | null>(null);
   const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

   // --- ORDER TYPES & PAYMENTS STATE ---
   const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
   const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
   const [newOrderType, setNewOrderType] = useState<Partial<OrderType> | null>(null);
   const [newPaymentMethod, setNewPaymentMethod] = useState<Partial<PaymentMethod> | null>(null);

   // --- TERMINALS STATE ---
   const [terminals, setTerminals] = useState<Terminal[]>([]);
   const [newTerminal, setNewTerminal] = useState<Partial<Terminal> | null>(null);

   useEffect(() => {
      fetchSettings();
   }, []);

   useEffect(() => {
      if (activeTab === 'zonas') fetchZones();
      if (activeTab === 'tipos') fetchOrderTypes();
      if (activeTab === 'pagos') fetchPaymentMethods();
      if (activeTab === 'terminales') fetchTerminals();
   }, [activeTab]);

   // --- SETTINGS HANDLERS ---
   const fetchSettings = async () => {
      setLoading(true);
      try {
         const { data, error } = await supabase.from('app_settings').select('*');
         if (error) throw error;
         if (data) {
            data.forEach((setting: any) => {
               switch (setting.key) {
                  case 'exchange_rate': setExchangeRate(Number(setting.value)); break;
                  case 'tax_rate': setTaxRate(Number(setting.value)); break;
                  case 'store_info':
                     setStoreName(setting.value.name || '');
                     setStoreAddress(setting.value.address || '');
                     setStoreRif(setting.value.rif || '');
                     break;
               }
            });
         }
      } catch (error) {
         console.error('Error fetching settings:', error);
         alert('Error al cargar la configuración');
      } finally {
         setLoading(false);
      }
   };

   const handleSave = async () => {
      setSaving(true);
      try {
         const updates = [
            { key: 'exchange_rate', value: exchangeRate },
            { key: 'tax_rate', value: taxRate },
            { key: 'store_info', value: { name: storeName, address: storeAddress, rif: storeRif } }
         ];
         for (const update of updates) {
            const { error } = await supabase.from('app_settings').upsert(update, { onConflict: 'key' });
            if (error) throw error;
         }
         alert('Configuración guardada exitosamente');
      } catch (error) {
         console.error('Error saving settings:', error);
         alert('Error al guardar la configuración');
      } finally {
         setSaving(false);
      }
   };

   // --- ZONES HANDLERS ---
   const fetchZones = async () => {
      const { data, error } = await supabase
         .from('zones')
         .select('*, tables(*)')
         .order('name');
      if (error) console.error(error);
      else setZones(data || []);
   };

   const handleSaveZone = async () => {
      if (!editingZone?.name) return alert("Nombre requerido");
      const { error } = await supabase.from('zones').upsert(editingZone).select();
      if (error) alert("Error guardando zona");
      else {
         setEditingZone(null);
         fetchZones();
      }
   };

   const handleDeleteZone = async (id: string) => {
      if (!confirm("¿Eliminar zona y sus mesas?")) return;
      await supabase.from('zones').delete().eq('id', id);
      fetchZones();
      if (selectedZoneId === id) setSelectedZoneId(null);
   };

   const handleSaveTable = async () => {
      if (!editingTable?.name || !editingTable.zone_id) return alert("Datos incompletos");
      const { error } = await supabase.from('tables').upsert({
         ...editingTable,
         status: 'available'
      }).select();
      if (error) alert("Error guardando mesa");
      else {
         setEditingTable(null);
         fetchZones();
      }
   };

   const handleDeleteTable = async (id: string) => {
      if (!confirm("¿Eliminar mesa?")) return;
      await supabase.from('tables').delete().eq('id', id);
      fetchZones();
   };

   // --- ORDER TYPES HANDLERS ---
   const fetchOrderTypes = async () => {
      const { data } = await supabase.from('order_types').select('*').order('name');
      setOrderTypes(data || []);
   };

   const toggleOrderType = async (id: string, currentStatus: boolean) => {
      await supabase.from('order_types').update({ is_active: !currentStatus }).eq('id', id);
      fetchOrderTypes();
   };

   const handleSaveOrderType = async () => {
      if (!newOrderType?.name) return alert("Nombre requerido");
      await supabase.from('order_types').upsert({ ...newOrderType, is_active: true }).select();
      setNewOrderType(null);
      fetchOrderTypes();
   };

   // --- PAYMENT METHODS HANDLERS ---
   const fetchPaymentMethods = async () => {
      const { data } = await supabase.from('payment_methods').select('*').order('name');
      setPaymentMethods(data || []);
   };

   const togglePaymentMethod = async (id: string, currentStatus: boolean) => {
      await supabase.from('payment_methods').update({ is_active: !currentStatus }).eq('id', id);
      fetchPaymentMethods();
   };

   const handleSavePaymentMethod = async () => {
      if (!newPaymentMethod?.name) return alert("Nombre requerido");
      await supabase.from('payment_methods').upsert({ ...newPaymentMethod, is_active: true }).select();
      setNewPaymentMethod(null);
      fetchPaymentMethods();
   };

   // --- TERMINALS HANDLERS ---
   const fetchTerminals = async () => {
      const { data } = await supabase.from('terminals').select('*').order('name');
      setTerminals(data || []);
   };

   const toggleTerminal = async (id: string, currentStatus: boolean) => {
      await supabase.from('terminals').update({ is_active: !currentStatus }).eq('id', id);
      fetchTerminals();
   };

   const handleSaveTerminal = async () => {
      if (!newTerminal?.name) return alert("Nombre requerido");
      await supabase.from('terminals').upsert({ ...newTerminal, is_active: true }).select();
      setNewTerminal(null);
      fetchTerminals();
   };

   // --- DEV TOOL ---
   const handleWipeData = async () => {
      const password = prompt("⚠️ ZONA DE PELIGRO ⚠️\n\nEsta acción eliminará TODOS los productos, ventas, inventario y registros.\n\nIngrese la contraseña de desarrollador para confirmar:");
      if (password !== "1212") {
         if (password) alert("Contraseña incorrecta");
         return;
      }
      if (!confirm("¿ESTÁ REALMENTE SEGURO?\n\nNo hay vuelta atrás. Se borrará toda la base de datos operativa.")) return;
      setLoading(true);
      try {
         const { error } = await supabase.rpc('wipe_system_data');

         if (error) {
            console.error('RPC Error:', error);
            throw error;
         }

         alert('BARRIDO DE DATOS COMPLETADO.\n\nEl sistema ha sido reiniciado.');
         window.location.reload();
      } catch (error) {
         console.error(error);
         alert("Error crítico al eliminar datos. Ver consola para detalles.");
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="flex h-screen bg-slate-50">
         {/* Sidebar Navigation */}
         <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
            <div className="p-6 border-b border-slate-100">
               <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <LayoutGrid className="text-brand-600" />
                  Configuración
               </h1>
               <p className="text-xs text-slate-400 mt-1">Panel Administrativo Central</p>
            </div>

            <nav className="flex-1 p-4 space-y-1">
               <SidebarItem
                  isActive={activeTab === 'sucursal'}
                  onClick={() => setActiveTab('sucursal')}
                  icon={<Store size={20} />}
                  label="Sucursal"
               />
               <SidebarItem
                  isActive={activeTab === 'zonas'}
                  onClick={() => setActiveTab('zonas')}
                  icon={<Map size={20} />}
                  label="Zonas y Mesas"
               />
               <SidebarItem
                  isActive={activeTab === 'pagos'}
                  onClick={() => setActiveTab('pagos')}
                  icon={<CreditCard size={20} />}
                  label="Pagos"
               />
               <SidebarItem
                  isActive={activeTab === 'tipos'}
                  onClick={() => setActiveTab('tipos')}
                  icon={<List size={20} />}
                  label="Tipos de Pedido"
               />
               <SidebarItem
                  isActive={activeTab === 'terminales'}
                  onClick={() => setActiveTab('terminales')}
                  icon={<Monitor size={20} />}
                  label="Terminales"
               />
            </nav>

            <div className="p-4 border-t border-slate-100">
               <SidebarItem
                  isActive={activeTab === 'dev'}
                  onClick={() => setActiveTab('dev')}
                  icon={<Lock size={20} />}
                  label="Zona Dev"
                  danger
               />
            </div>
         </aside>

         {/* Main Content Area */}
         <main className="flex-1 overflow-y-auto p-8">
            {activeTab === 'sucursal' && (
               <div className="max-w-4xl mx-auto space-y-6">
                  <header className="mb-8">
                     <h2 className="text-2xl font-bold text-slate-800">Información de Sucursal</h2>
                     <p className="text-slate-500">Configura los datos básicos de tu negocio y parámetros fiscales.</p>
                  </header>

                  {/* Financial Settings */}
                  <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                     <h3 className="text-lg font-bold mb-4 text-slate-700 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center font-black">$</span>
                        Finanzas
                     </h3>
                     <div className="grid md:grid-cols-2 gap-6">
                        <div>
                           <label className="block text-sm font-bold text-slate-600 mb-2">Tasa de Cambio (Bs/$)</label>
                           <div className="relative">
                              <input
                                 type="number"
                                 step="0.01"
                                 value={exchangeRate}
                                 onChange={(e) => setExchangeRate(parseFloat(e.target.value))}
                                 className="w-full pl-4 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none font-mono text-lg"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">Bs/USD</span>
                           </div>
                        </div>
                        <div>
                           <label className="block text-sm font-bold text-slate-600 mb-2">Impuesto (IVA %)</label>
                           <div className="relative">
                              <input
                                 type="number"
                                 step="1"
                                 value={taxRate}
                                 onChange={(e) => setTaxRate(parseFloat(e.target.value))}
                                 className="w-full pl-4 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none font-mono text-lg"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                           </div>
                        </div>
                     </div>
                  </section>

                  {/* Store Information */}
                  <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                     <h3 className="text-lg font-bold mb-4 text-slate-700 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-black">@</span>
                        Información del Local
                     </h3>
                     <div className="space-y-4">
                        <div>
                           <label className="block text-sm font-bold text-slate-600 mb-2">Nombre del Negocio</label>
                           <input
                              type="text"
                              value={storeName}
                              onChange={(e) => setStoreName(e.target.value)}
                              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                              placeholder="Ej. Burger King"
                           />
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                           <div>
                              <label className="block text-sm font-bold text-slate-600 mb-2">Dirección</label>
                              <input
                                 type="text"
                                 value={storeAddress}
                                 onChange={(e) => setStoreAddress(e.target.value)}
                                 className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                                 placeholder="Ej. Av. Principal"
                              />
                           </div>
                           <div>
                              <label className="block text-sm font-bold text-slate-600 mb-2">RIF / ID Fiscal</label>
                              <input
                                 type="text"
                                 value={storeRif}
                                 onChange={(e) => setStoreRif(e.target.value)}
                                 className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none uppercase"
                                 placeholder="J-12345678-9"
                              />
                           </div>
                        </div>
                     </div>
                  </section>

                  <button
                     onClick={handleSave}
                     disabled={saving}
                     className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-all active:translate-y-1 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                     <Save size={20} />
                     {saving ? 'Guardando...' : 'GUARDAR CAMBIOS'}
                  </button>
               </div>
            )}

            {activeTab === 'zonas' && (
               <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-100px)]">
                  {/* Zones Sidebar */}
                  <div className="w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                     <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700">Zonas / Salones</h3>
                        <button onClick={() => setEditingZone({})} className="bg-slate-900 text-white p-1.5 rounded hover:bg-slate-700">
                           <Plus size={16} />
                        </button>
                     </div>
                     <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {zones.map(zone => (
                           <div
                              key={zone.id}
                              onClick={() => setSelectedZoneId(zone.id)}
                              className={`group p-3 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${selectedZoneId === zone.id ? 'bg-brand-50 border border-brand-200 text-brand-700' : 'hover:bg-slate-50 border border-transparent'}`}
                           >
                              <div className="flex items-center gap-3">
                                 <Map size={18} className="opacity-50" />
                                 <span className="font-bold text-sm">{zone.name}</span>
                                 <span className="text-xs bg-slate-100 px-2 rounded-full text-slate-500">{zone.tables?.length || 0} mesas</span>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button onClick={(e) => { e.stopPropagation(); setEditingZone(zone); }} className="p-1 hover:bg-white rounded text-blue-600"><Edit2 size={14} /></button>
                                 <button onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone.id); }} className="p-1 hover:bg-white rounded text-red-600"><Trash2 size={14} /></button>
                              </div>
                           </div>
                        ))}
                        {!zones.length && <div className="p-8 text-center text-slate-400 italic text-sm">Crea una zona para comenzar (Ej. Terraza)</div>}
                     </div>
                  </div>

                  {/* Tables List */}
                  <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                     {selectedZoneId ? (
                        <>
                           <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                              <h3 className="font-bold text-slate-700">Mesas en {zones.find(z => z.id === selectedZoneId)?.name}</h3>
                              <button
                                 onClick={() => setEditingTable({ zone_id: selectedZoneId, capacity: 4 })}
                                 className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2"
                              >
                                 <Plus size={14} /> Nueva Mesa
                              </button>
                           </div>
                           <div className="flex-1 overflow-y-auto p-4">
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                 {zones.find(z => z.id === selectedZoneId)?.tables?.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(table => (
                                    <div key={table.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow relative group bg-white">
                                       <div className="font-black text-xl text-slate-700 mb-1">{table.name}</div>
                                       <div className="text-xs text-slate-500 flex items-center gap-1">
                                          <Monitor size={12} /> Capacidad: {table.capacity} p.
                                       </div>
                                       <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => setEditingTable(table)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Edit2 size={12} /></button>
                                          <button onClick={() => handleDeleteTable(table.id)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 size={12} /></button>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                              {zones.find(z => z.id === selectedZoneId)?.tables?.length === 0 && (
                                 <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <p>No hay mesas en esta zona.</p>
                                 </div>
                              )}
                           </div>
                        </>
                     ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                           <LayoutGrid size={48} className="mb-4 opacity-20" />
                           <p>Seleccione una zona para gestionar sus mesas</p>
                        </div>
                     )}
                  </div>
               </div>
            )}


            {activeTab === 'pagos' && (
               <div className="max-w-4xl mx-auto space-y-6">
                  <header className="flex justify-between items-center mb-8">
                     <div>
                        <h2 className="text-2xl font-bold text-slate-800">Métodos de Pago</h2>
                        <p className="text-slate-500">Administra las formas de pago aceptadas en caja.</p>
                     </div>
                     <button onClick={() => setNewPaymentMethod({ type: 'cash' })} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                        <Plus size={18} /> Nuevo Método
                     </button>
                  </header>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                           <tr>
                              <th className="p-4 font-bold text-slate-600 text-sm">Nombre</th>
                              <th className="p-4 font-bold text-slate-600 text-sm">Tipo</th>
                              <th className="p-4 font-bold text-slate-600 text-sm">Estado</th>
                              <th className="p-4 font-bold text-slate-600 text-sm text-right">Acciones</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {paymentMethods.map(method => (
                              <tr key={method.id} className="hover:bg-slate-50">
                                 <td className="p-4 font-bold text-slate-700">{method.name}</td>
                                 <td className="p-4 text-slate-500 capitalize">{method.type}</td>
                                 <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${method.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                       {method.is_active ? 'ACTIVO' : 'INACTIVO'}
                                    </span>
                                 </td>
                                 <td className="p-4 text-right">
                                    <button
                                       onClick={() => togglePaymentMethod(method.id, method.is_active)}
                                       className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${method.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                    >
                                       {method.is_active ? 'Desactivar' : 'Activar'}
                                    </button>
                                 </td>
                              </tr>
                           ))}
                           {!paymentMethods.length && (
                              <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">No hay métodos de pago registrados.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>

                  {newPaymentMethod && (
                     <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                           <h3 className="font-bold text-lg mb-4">Nuevo Método de Pago</h3>
                           <div className="space-y-4">
                              <input
                                 className="w-full border border-slate-300 rounded p-2"
                                 placeholder="Nombre (Ej. Zelle)"
                                 value={newPaymentMethod.name || ''}
                                 onChange={e => setNewPaymentMethod({ ...newPaymentMethod, name: e.target.value })}
                              />
                              <select
                                 className="w-full border border-slate-300 rounded p-2"
                                 value={newPaymentMethod.type || 'cash'}
                                 onChange={e => setNewPaymentMethod({ ...newPaymentMethod, type: e.target.value })}
                              >
                                 <option value="cash">Efectivo</option>
                                 <option value="card">Tarjeta / Débito</option>
                                 <option value="transfer">Transferencia / Digital</option>
                              </select>
                              <div className="flex justify-end gap-2 mt-4">
                                 <button onClick={() => setNewPaymentMethod(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
                                 <button onClick={handleSavePaymentMethod} className="px-4 py-2 bg-slate-900 text-white rounded font-bold">Guardar</button>
                              </div>
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            )}

            {activeTab === 'tipos' && (
               <div className="max-w-4xl mx-auto space-y-6">
                  <header className="flex justify-between items-center mb-8">
                     <div>
                        <h2 className="text-2xl font-bold text-slate-800">Tipos de Pedido</h2>
                        <p className="text-slate-500">Configura flujos de caja y servicio a mesa.</p>
                     </div>
                     <button onClick={() => setNewOrderType({})} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                        <Plus size={18} /> Nuevo Tipo
                     </button>
                  </header>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                           <tr>
                              <th className="p-4 font-bold text-slate-600 text-sm">Nombre</th>
                              <th className="p-4 font-bold text-slate-600 text-sm text-center">Preguntar Mesa</th>
                              <th className="p-4 font-bold text-slate-600 text-sm text-center">Cobrar Antes</th>
                              <th className="p-4 font-bold text-slate-600 text-sm">Estado</th>
                              <th className="p-4 font-bold text-slate-600 text-sm text-right">Acciones</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {orderTypes.map(type => (
                              <tr key={type.id} className="hover:bg-slate-50">
                                 <td className="p-4 font-bold text-slate-700">{type.name}</td>
                                 <td className="p-4 text-center">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${type.ask_table ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                                       {type.ask_table ? 'SÍ' : 'NO'}
                                    </span>
                                 </td>
                                 <td className="p-4 text-center">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${type.prepay_required ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400'}`}>
                                       {type.prepay_required ? 'SÍ' : 'NO'}
                                    </span>
                                 </td>
                                 <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${type.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                       {type.is_active ? 'ACTIVO' : 'INACTIVO'}
                                    </span>
                                 </td>
                                 <td className="p-4 text-right">
                                    <button
                                       onClick={() => toggleOrderType(type.id, type.is_active)}
                                       className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${type.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                    >
                                       {type.is_active ? 'Desactivar' : 'Activar'}
                                    </button>
                                 </td>
                              </tr>
                           ))}
                           {!orderTypes.length && (
                              <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">No hay tipos de pedido configurados.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>

                  {newOrderType && (
                     <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                           <h3 className="font-bold text-lg mb-4">Nuevo Tipo de Pedido</h3>
                           <div className="space-y-4">
                              <input
                                 className="w-full border border-slate-300 rounded p-2"
                                 placeholder="Nombre (Ej. Delivery)"
                                 value={newOrderType.name || ''}
                                 onChange={e => setNewOrderType({ ...newOrderType, name: e.target.value })}
                              />
                              <label className="flex items-center gap-3 p-3 border rounded bg-slate-50 cursor-pointer">
                                 <input
                                    type="checkbox"
                                    checked={newOrderType.ask_table || false}
                                    onChange={e => setNewOrderType({ ...newOrderType, ask_table: e.target.checked })}
                                 />
                                 <span className="text-sm">Preguntar Mesa (Dine-in)</span>
                              </label>
                              <label className="flex items-center gap-3 p-3 border rounded bg-slate-50 cursor-pointer">
                                 <input
                                    type="checkbox"
                                    checked={newOrderType.prepay_required || false}
                                    onChange={e => setNewOrderType({ ...newOrderType, prepay_required: e.target.checked })}
                                 />
                                 <span className="text-sm">Cobrar Antes (Fast Food)</span>
                              </label>

                              <div className="flex justify-end gap-2 mt-4">
                                 <button onClick={() => setNewOrderType(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
                                 <button onClick={handleSaveOrderType} className="px-4 py-2 bg-slate-900 text-white rounded font-bold">Guardar</button>
                              </div>
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            )}


            {activeTab === 'terminales' && (
               <div className="max-w-4xl mx-auto space-y-6">
                  <header className="flex justify-between items-center mb-8">
                     <div>
                        <h2 className="text-2xl font-bold text-slate-800">Terminales / Puntos de Venta</h2>
                        <p className="text-slate-500">Gestiona los dispositivos autorizados para operar.</p>
                     </div>
                     <button onClick={() => setNewTerminal({})} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                        <Plus size={18} /> Nuevo Terminal
                     </button>
                  </header>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                           <tr>
                              <th className="p-4 font-bold text-slate-600 text-sm">Nombre / Identificador</th>
                              <th className="p-4 font-bold text-slate-600 text-sm">Estado</th>
                              <th className="p-4 font-bold text-slate-600 text-sm text-right">Acciones</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {terminals.map(terminal => (
                              <tr key={terminal.id} className="hover:bg-slate-50">
                                 <td className="p-4 font-bold text-slate-700 flex items-center gap-3">
                                    <Monitor size={18} className="text-slate-400" />
                                    {terminal.name}
                                 </td>
                                 <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${terminal.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                       {terminal.is_active ? 'ACTIVO' : 'INACTIVO'}
                                    </span>
                                 </td>
                                 <td className="p-4 text-right">
                                    <button
                                       onClick={() => toggleTerminal(terminal.id, terminal.is_active)}
                                       className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${terminal.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                    >
                                       {terminal.is_active ? 'Desactivar' : 'Activar'}
                                    </button>
                                 </td>
                              </tr>
                           ))}
                           {!terminals.length && (
                              <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">No hay terminales registrados.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>

                  {newTerminal && (
                     <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                           <h3 className="font-bold text-lg mb-4">Nuevo Terminal</h3>
                           <div className="space-y-4">
                              <input
                                 className="w-full border border-slate-300 rounded p-2"
                                 placeholder="Nombre (Ej. Caja Principal 01)"
                                 value={newTerminal.name || ''}
                                 onChange={e => setNewTerminal({ ...newTerminal, name: e.target.value })}
                              />
                              <div className="flex justify-end gap-2 mt-4">
                                 <button onClick={() => setNewTerminal(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
                                 <button onClick={handleSaveTerminal} className="px-4 py-2 bg-slate-900 text-white rounded font-bold">Guardar</button>
                              </div>
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            )}

            {activeTab === 'dev' && (
               <div className="max-w-2xl mx-auto mt-12 bg-red-50 p-8 rounded-xl shadow border border-red-200 text-center">
                  <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                     <Lock size={32} />
                  </div>
                  <h2 className="text-2xl font-bold text-red-800 mb-2">Zona de Desarrollador</h2>
                  <p className="text-red-600 mb-8">
                     Herramientas avanzadas para mantenimiento y pruebas. <br />
                     <strong>Advertencia:</strong> Las acciones aquí son irreversibles.
                  </p>

                  <button onClick={handleWipeData} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 mx-auto">
                     <Trash2 size={20} />
                     ELIMINAR TODOS LOS DATOS (RESET)
                  </button>
               </div>
            )}

            {/* --- Modals for Zone/Table --- */}
            {editingZone && (
               <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg">{editingZone.id ? 'Editar Zona' : 'Nueva Zona'}</h3>
                        <button onClick={() => setEditingZone(null)}><X size={20} className="text-slate-400 hover:text-red-500" /></button>
                     </div>
                     <input
                        className="w-full border border-slate-300 rounded p-2 mb-4 focus:ring-2 focus:ring-brand-500 outline-none"
                        placeholder="Nombre (Ej. Salón Principal)"
                        value={editingZone.name || ''}
                        onChange={e => setEditingZone({ ...editingZone, name: e.target.value })}
                        autoFocus
                     />
                     <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingZone(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
                        <button onClick={handleSaveZone} className="px-4 py-2 bg-slate-900 text-white rounded font-bold">Guardar</button>
                     </div>
                  </div>
               </div>
            )}

            {editingTable && (
               <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg">{editingTable.id ? 'Editar Mesa' : 'Nueva Mesa'}</h3>
                        <button onClick={() => setEditingTable(null)}><X size={20} className="text-slate-400 hover:text-red-500" /></button>
                     </div>
                     <div className="space-y-3">
                        <div>
                           <label className="text-xs font-bold text-slate-500">Identificador</label>
                           <input
                              className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-brand-500 outline-none"
                              placeholder="Ej. M-01"
                              value={editingTable.name || ''}
                              onChange={e => setEditingTable({ ...editingTable, name: e.target.value })}
                              autoFocus
                           />
                        </div>
                        <div>
                           <label className="text-xs font-bold text-slate-500">Capacidad (Personas)</label>
                           <input
                              type="number"
                              className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-brand-500 outline-none"
                              value={editingTable.capacity || 4}
                              onChange={e => setEditingTable({ ...editingTable, capacity: Number(e.target.value) })}
                           />
                        </div>
                     </div>
                     <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setEditingTable(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
                        <button onClick={handleSaveTable} className="px-4 py-2 bg-slate-900 text-white rounded font-bold">Guardar</button>
                     </div>
                  </div>
               </div>
            )}
         </main>
      </div>
   );
};

const SidebarItem = ({ icon, label, isActive, onClick, danger = false }: any) => (
   <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
         ? (danger ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700')
         : (danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-slate-50')
         }`}
   >
      {React.cloneElement(icon, { size: 18, className: isActive ? (danger ? 'text-red-600' : 'text-brand-600') : (danger ? 'text-red-400' : 'text-slate-400') })}
      {label}
   </button>
);

const PlaceholderModule = ({ title, description }: any) => (
   <div className="h-full flex flex-col items-center justify-center text-slate-400">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
         <LayoutGrid size={32} className="opacity-50" />
      </div>
      <h2 className="text-xl font-bold text-slate-600">{title}</h2>
      <p className="text-sm">{description}</p>
      <div className="mt-4 px-3 py-1 bg-brand-100 text-brand-700 text-xs font-bold rounded-full">Próximamente</div>
   </div>
);

export default Settings;