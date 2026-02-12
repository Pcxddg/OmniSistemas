import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { Supplier, SupplierProduct, PurchaseOrder, Product } from '../types';
import { Truck, Plus, Search, Edit2, Trash2, Save, X, DollarSign, Archive, FileText, CheckCircle, Clock, AlertTriangle, ChevronRight, Calculator } from 'lucide-react';

const Suppliers: React.FC = () => {
   const { user } = useAuth();
   const [activeTab, setActiveTab] = useState<'proveedores' | 'catalogo' | 'ordenes'>('proveedores');
   const [suppliers, setSuppliers] = useState<Supplier[]>([]);
   const [products, setProducts] = useState<Product[]>([]); // For catalog linking
   const [isLoading, setIsLoading] = useState(false);

   // Suppliers State
   const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);

   // Catalog State
   const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
   const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
   const [editingLink, setEditingLink] = useState<Partial<SupplierProduct> | null>(null);

   // Orders State
   const [orders, setOrders] = useState<PurchaseOrder[]>([]);
   const [editingOrder, setEditingOrder] = useState<Partial<PurchaseOrder> | null>(null);
   const [orderItems, setOrderItems] = useState<any[]>([]); // Temp items for new order

   useEffect(() => {
      fetchSuppliers();
      fetchProducts(); // Global products for linking
   }, []);

   useEffect(() => {
      if (activeTab === 'ordenes') fetchOrders();
   }, [activeTab]);

   useEffect(() => {
      if (selectedSupplierId && activeTab === 'catalogo') {
         fetchSupplierProducts(selectedSupplierId);
      }
   }, [selectedSupplierId, activeTab]);

   const fetchSuppliers = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) console.error(error);
      else setSuppliers(data || []);
      setIsLoading(false);
   };

   const fetchProducts = async () => {
      const { data } = await supabase.from('products').select('*').eq('is_active', true);
      setProducts(data || []);
   };

   const fetchOrders = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
         .from('purchase_orders')
         .select('*, suppliers(name)')
         .order('created_at', { ascending: false });
      if (error) console.error(error);
      else setOrders(data || []);
      setIsLoading(false);
   };

   const fetchSupplierProducts = async (supplierId: string) => {
      const { data, error } = await supabase
         .from('supplier_products')
         .select('*, products(name)')
         .eq('supplier_id', supplierId);
      if (error) console.error(error);
      else setSupplierProducts(data || []);
   };

   // --- Order Handlers ---
   const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
   const [selectedOrderItems, setSelectedOrderItems] = useState<any[]>([]);

   const handleViewOrder = async (order: PurchaseOrder) => {
      setSelectedOrder(order);
      const { data, error } = await supabase
         .from('purchase_order_items')
         .select('*, products(name)')
         .eq('purchase_order_id', order.id);

      if (error) console.error(error);
      else setSelectedOrderItems(data || []);
   };

   const handleReceiveOrder = async () => {
      if (!selectedOrder || !selectedOrderItems.length) return;
      if (!confirm("¿Confirmar recepción de mercancía? Esto aumentará el stock y recalculará costos.")) return;

      setIsLoading(true);

      try {
         // 1. Process each item (Update Stock & Cost)
         for (const item of selectedOrderItems) {
            const { data: product } = await supabase.from('products').select('stock, base_cost').eq('id', item.product_id).single();

            if (product) {
               const currentStock = product.stock || 0;
               const currentCost = product.base_cost || 0;
               const incomingQty = item.quantity;
               const incomingCost = item.unit_cost;

               const totalQty = currentStock + incomingQty;
               let newCost = currentCost;

               if (totalQty > 0) {
                  newCost = ((currentStock * currentCost) + (incomingQty * incomingCost)) / totalQty;
               }

               await supabase.from('products').update({
                  stock: totalQty,
                  base_cost: newCost
               }).eq('id', item.product_id);

               await supabase.from('inventory_movements').insert({
                  product_id: item.product_id,
                  type: 'entrada',
                  quantity: incomingQty,
                  reason: `Recepción Orden #${selectedOrder.id.slice(0, 8)}`,
                  user_id: user?.id || 'unknown'
               });

               if (Math.abs(newCost - currentCost) > 0.01) {
                  await supabase.from('audit_logs').insert({
                     entity: 'product',
                     entity_id: item.product_id,
                     action: 'cost_update',
                     user_id: user?.id || 'unknown',
                     old_value: { base_cost: currentCost },
                     new_value: { base_cost: newCost, source: 'purchase_order', order_id: selectedOrder.id }
                  });
               }
            }
         }

         await supabase.from('purchase_orders').update({
            status: 'received'
          }).eq('id', selectedOrder.id);

         alert("Orden recibida exitosamente. Inventario actualizado.");
         setSelectedOrder(null);
         fetchOrders();

      } catch (error) {
         console.error(error);
         alert("Error al procesar la recepción.");
      } finally {
         setIsLoading(false);
      }
   };
   const handleSaveSupplier = async () => {
      if (!editingSupplier?.name) return alert("Nombre requerido");

      const payload = {
         name: editingSupplier.name,
         contact_name: editingSupplier.contact_name,
         phone: editingSupplier.phone,
         email: editingSupplier.email,
         tax_id: editingSupplier.tax_id,
         is_active: editingSupplier.is_active ?? true
      };

      if (editingSupplier.id) {
         await supabase.from('suppliers').update(payload).eq('id', editingSupplier.id);
      } else {
         await supabase.from('suppliers').insert(payload);
      }
      setEditingSupplier(null);
      fetchSuppliers();
   };

   const handleDeleteSupplier = async (id: string) => {
      if (!confirm("¿Eliminar proveedor?")) return;
      await supabase.from('suppliers').delete().eq('id', id);
      fetchSuppliers();
   };

   // --- Catalog Handlers ---
   const handleLinkProduct = async () => {
      if (!editingLink?.supplier_id || !editingLink?.product_id || !editingLink?.unit_cost) {
         return alert("Complete los datos");
      }

      const payload = {
         supplier_id: editingLink.supplier_id,
         product_id: editingLink.product_id,
         sku_supplier: editingLink.sku_supplier,
         unit_cost: editingLink.unit_cost,
         currency: editingLink.currency || 'USD'
      };

      if (editingLink.id) {
         await supabase.from('supplier_products').update(payload).eq('id', editingLink.id);
      } else {
         await supabase.from('supplier_products').insert(payload); // Upsert logic handled by Unique constraint usually, but insert works if not exists
      }
      setEditingLink(null);
      if (selectedSupplierId) fetchSupplierProducts(selectedSupplierId);
   };

   const handleDeleteLink = async (id: string) => {
      if (!confirm("¿Desvincular producto?")) return;
      await supabase.from('supplier_products').delete().eq('id', id);
      if (selectedSupplierId) fetchSupplierProducts(selectedSupplierId);
   };

   // --- Order Handlers ---
   const handleCreateOrder = async () => {
      if (!editingOrder?.supplier_id) return alert("Seleccione proveedor");

      // 1. Create Header
      const { data: order, error } = await supabase.from('purchase_orders').insert({
         supplier_id: editingOrder.supplier_id,
         status: 'draft',
         notes: editingOrder.notes,
         total_estimated: orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0),
         user_id: user?.id || 'unknown'
      }).select().single();

      if (error || !order) return alert("Error creando orden");

      // 2. Create Items
      const itemsPayload = orderItems.map(item => ({
         purchase_order_id: order.id,
         product_id: item.product_id,
         quantity: item.quantity,
         unit_cost: item.unit_cost
      }));

      await supabase.from('purchase_order_items').insert(itemsPayload);

      alert("Orden creada en borrador");
      setEditingOrder(null);
      setOrderItems([]);
      fetchOrders();
   };


   // --- Renderers ---

   if (isLoading && !suppliers.length) return <div className="p-12 text-center text-slate-400">Cargando módulo...</div>;

   return (
      <div className="p-6 h-full overflow-y-auto bg-slate-50/50">
         <div className="flex justify-between items-center mb-6">
            <div>
               <h1 className="text-3xl font-bold text-slate-900">Gestión de Compras</h1>
               <p className="text-slate-500">Proveedores, costos y órdenes de compra</p>
            </div>

            <div className="flex bg-slate-200 p-1 rounded-lg">
               <button
                  onClick={() => setActiveTab('proveedores')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'proveedores' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                  Proveedores
               </button>
               <button
                  onClick={() => setActiveTab('catalogo')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'catalogo' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                  Catálogo de Costos
               </button>
               <button
                  onClick={() => setActiveTab('ordenes')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'ordenes' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                  Órdenes de Compra
               </button>
            </div>
         </div>

         {/* --- PROVEEDORES TAB --- */}
         {activeTab === 'proveedores' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-700 uppercase text-xs">Directorio de Proveedores</h3>
                  <button
                     onClick={() => setEditingSupplier({})}
                     className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                  >
                     <Plus size={16} /> Nuevo Proveedor
                  </button>
               </div>

               <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold border-b border-slate-200">
                     <tr>
                        <th className="px-6 py-4">Empresa</th>
                        <th className="px-6 py-4">Contacto</th>
                        <th className="px-6 py-4">Teléfono / Email</th>
                        <th className="px-6 py-4">ID Fiscal</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {suppliers.map(sup => (
                        <tr key={sup.id} className="hover:bg-slate-50 group">
                           <td className="px-6 py-4 font-bold text-slate-800">{sup.name}</td>
                           <td className="px-6 py-4 text-sm text-slate-600">{sup.contact_name || '-'}</td>
                           <td className="px-6 py-4 text-sm">
                              <div className="text-slate-800">{sup.phone}</div>
                              <div className="text-slate-500 text-xs">{sup.email}</div>
                           </td>
                           <td className="px-6 py-4 text-sm font-mono text-slate-500">{sup.tax_id || '-'}</td>
                           <td className="px-6 py-4 text-right flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingSupplier(sup)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteSupplier(sup.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                           </td>
                        </tr>
                     ))}
                     {suppliers.length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No hay proveedores registrados</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         )}

         {/* --- CATALOGO TAB --- */}
         {activeTab === 'catalogo' && (
            <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-200px)]">
               {/* Supplier Selector Sidebar */}
               <div className="w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700">Seleccionar Proveedor</div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                     {suppliers.map(sup => (
                        <div
                           key={sup.id}
                           onClick={() => setSelectedSupplierId(sup.id)}
                           className={`p-3 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${selectedSupplierId === sup.id ? 'bg-brand-50 border border-brand-200 text-brand-700' : 'hover:bg-slate-50 border border-transparent'}`}
                        >
                           <span className="font-bold text-sm">{sup.name}</span>
                           <ChevronRight size={16} className={selectedSupplierId === sup.id ? 'text-brand-500' : 'text-slate-300'} />
                        </div>
                     ))}
                  </div>
               </div>

               {/* Products List */}
               <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  {selectedSupplierId ? (
                     <>
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                           <h3 className="font-bold text-slate-700">Lista de Precios Pactados</h3>
                           <button
                              onClick={() => setEditingLink({ supplier_id: selectedSupplierId, currency: 'USD' })}
                              className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2"
                           >
                              <Plus size={14} /> Vincular Producto
                           </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                           <table className="w-full text-left">
                              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold border-b border-slate-200">
                                 <tr>
                                    <th className="px-6 py-3">Producto</th>
                                    <th className="px-6 py-3">SKU Prov.</th>
                                    <th className="px-6 py-3">Costo Unit.</th>
                                    <th className="px-6 py-3 text-right">Acción</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                 {supplierProducts.map(sp => (
                                    <tr key={sp.id} className="hover:bg-slate-50">
                                       <td className="px-6 py-3 font-medium text-slate-800">{sp.products?.name}</td>
                                       <td className="px-6 py-3 font-mono text-xs text-slate-500">{sp.sku_supplier || '-'}</td>
                                       <td className="px-6 py-3 font-bold text-slate-700">
                                          {sp.unit_cost.toFixed(2)} <span className="text-[10px] text-slate-400">{sp.currency}</span>
                                       </td>
                                       <td className="px-6 py-3 text-right">
                                          <button onClick={() => handleDeleteLink(sp.id)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
                                       </td>
                                    </tr>
                                 ))}
                                 {!supplierProducts.length && (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">No hay productos vinculados a este proveedor.</td></tr>
                                 )}
                              </tbody>
                           </table>
                        </div>
                     </>
                  ) : (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Archive size={48} className="mb-4 opacity-20" />
                        <p>Seleccione un proveedor para ver su catálogo</p>
                     </div>
                  )}
               </div>
            </div>
         )}

         {/* --- ORDENES TAB --- */}
         {activeTab === 'ordenes' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-700 uppercase text-xs">Registro de Órdenes</h3>
                  <button
                     onClick={() => setEditingOrder({ status: 'draft' })}
                     className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                  >
                     <FileText size={16} /> Crear Orden de Compra
                  </button>
               </div>

               <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold border-b border-slate-200">
                     <tr>
                        <th className="px-6 py-4">ID</th>
                        <th className="px-6 py-4">Fecha</th>
                        <th className="px-6 py-4">Proveedor</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4 text-right">Total Est.</th>
                        <th className="px-6 py-4 text-right">Acción</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {orders.map(order => (
                        <tr key={order.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleViewOrder(order)}>
                           <td className="px-6 py-4 font-mono text-xs text-slate-500">#{order.id.slice(0, 8)}</td>
                           <td className="px-6 py-4 text-sm">{order.created_at.split('T')[0]}</td>
                           <td className="px-6 py-4 font-bold text-slate-800">{order.suppliers?.name}</td>
                           <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${order.status === 'draft' ? 'bg-slate-100 text-slate-600' :
                                 order.status === 'sent' ? 'bg-blue-100 text-blue-600' :
                                    order.status === 'received' ? 'bg-green-100 text-green-600' :
                                       'bg-red-100 text-red-600'
                                 }`}>
                                 {order.status}
                              </span>
                           </td>
                           <td className="px-6 py-4 text-right font-mono font-bold">${order.total_estimated.toFixed(2)}</td>
                           <td className="px-6 py-4 text-right">
                              <button className="text-brand-600 hover:text-brand-800 font-bold text-xs border border-brand-200 px-3 py-1 rounded hover:bg-brand-50 transition-colors">
                                 Ver Detalle
                              </button>
                           </td>
                        </tr>
                     ))}
                     {!orders.length && (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No hay órdenes registradas.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         )}

         {/* Detail & Receive Modal */}
         {selectedOrder && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                     <div>
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                           Orden #{selectedOrder.id.slice(0, 8)}
                           <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${selectedOrder.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                              {selectedOrder.status}
                           </span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Proveedor: {selectedOrder.suppliers?.name} • Fecha: {selectedOrder.created_at.split('T')[0]}</p>
                     </div>
                     <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-red-500"><X size={24} /></button>
                  </div>

                  <div className="p-6 overflow-y-auto flex-1 bg-white">
                     {selectedOrder.status === 'received' && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-lg flex items-center gap-3 text-green-800">
                           <CheckCircle size={24} />
                           <div>
                              <p className="font-bold">Orden Completada</p>
                              <p className="text-sm">Esta mercancía ya fue ingresada al inventario y los costos fueron actualizados.</p>
                           </div>
                        </div>
                     )}

                     <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                              <th className="py-2">Producto</th>
                              <th className="py-2 text-right">Cantidad</th>
                              <th className="py-2 text-right">Costo Unit.</th>
                              <th className="py-2 text-right">Total</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {selectedOrderItems.map(item => (
                              <tr key={item.id}>
                                 <td className="py-3 font-medium text-slate-800">{item.products?.name}</td>
                                 <td className="py-3 text-right font-mono">{item.quantity}</td>
                                 <td className="py-3 text-right font-mono">${item.unit_cost.toFixed(2)}</td>
                                 <td className="py-3 text-right font-bold font-mono">${(item.quantity * item.unit_cost).toFixed(2)}</td>
                              </tr>
                           ))}
                        </tbody>
                        <tfoot>
                           <tr className="border-t border-slate-200">
                              <td colSpan={3} className="py-4 text-right font-bold uppercase text-xs text-slate-500">Total Orden:</td>
                              <td className="py-4 text-right font-bold text-lg">${selectedOrder.total_estimated.toFixed(2)}</td>
                           </tr>
                        </tfoot>
                     </table>
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                     <button onClick={() => setSelectedOrder(null)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-lg transition-colors">Cerrar</button>

                     {selectedOrder.status !== 'received' && selectedOrder.status !== 'cancelled' && (
                        <button
                           onClick={handleReceiveOrder}
                           className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-lg shadow-green-200 flex items-center gap-2 transition-transform active:scale-95"
                        >
                           <Archive size={20} />
                           Recibir Mercancía e Ingresar Stock
                        </button>
                     )}
                  </div>
               </div>
            </div>
         )}

         {/* --- MODALS --- */}

         {/* Edit Supplier Modal */}
         {editingSupplier && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                  <h3 className="font-bold text-lg mb-4">{editingSupplier.id ? 'Editar' : 'Nuevo'} Proveedor</h3>
                  <div className="space-y-3">
                     <input
                        className="w-full border p-2 rounded"
                        placeholder="Nombre Empresa *"
                        value={editingSupplier.name || ''}
                        onChange={e => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                     />
                     <input
                        className="w-full border p-2 rounded"
                        placeholder="Nombre Contacto"
                        value={editingSupplier.contact_name || ''}
                        onChange={e => setEditingSupplier({ ...editingSupplier, contact_name: e.target.value })}
                     />
                     <div className="flex gap-2">
                        <input
                           className="w-full border p-2 rounded"
                           placeholder="Teléfono"
                           value={editingSupplier.phone || ''}
                           onChange={e => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                        />
                        <input
                           className="w-full border p-2 rounded"
                           placeholder="ID Fiscal"
                           value={editingSupplier.tax_id || ''}
                           onChange={e => setEditingSupplier({ ...editingSupplier, tax_id: e.target.value })}
                        />
                     </div>
                     <input
                        className="w-full border p-2 rounded"
                        placeholder="Email"
                        value={editingSupplier.email || ''}
                        onChange={e => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                     />
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                     <button onClick={() => setEditingSupplier(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                     <button onClick={handleSaveSupplier} className="px-4 py-2 bg-slate-900 text-white rounded font-bold">Guardar</button>
                  </div>
               </div>
            </div>
         )}

         {/* Link Product Modal */}
         {editingLink && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                  <h3 className="font-bold text-lg mb-4">Vincular Producto a Proveedor</h3>
                  <div className="space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Producto</label>
                        <select
                           className="w-full border p-2 rounded"
                           value={editingLink.product_id || ''}
                           onChange={e => setEditingLink({ ...editingLink, product_id: e.target.value })}
                        >
                           <option value="">Seleccione Producto...</option>
                           {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                           ))}
                        </select>
                     </div>
                     <div className="flex gap-4">
                        <div className="flex-1">
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Costo Unitario</label>
                           <input
                              type="number" step="0.01"
                              className="w-full border p-2 rounded"
                              value={editingLink.unit_cost || ''}
                              onChange={e => setEditingLink({ ...editingLink, unit_cost: parseFloat(e.target.value) })}
                           />
                        </div>
                        <div className="w-1/3">
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda</label>
                           <select
                              className="w-full border p-2 rounded"
                              value={editingLink.currency || 'USD'}
                              onChange={e => setEditingLink({ ...editingLink, currency: e.target.value })}
                           >
                              <option value="USD">USD</option>
                              <option value="BS">BS</option>
                           </select>
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">SKU / Código Proveedor</label>
                        <input
                           className="w-full border p-2 rounded"
                           placeholder="Opcional"
                           value={editingLink.sku_supplier || ''}
                           onChange={e => setEditingLink({ ...editingLink, sku_supplier: e.target.value })}
                        />
                     </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                     <button onClick={() => setEditingLink(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                     <button onClick={handleLinkProduct} className="px-4 py-2 bg-brand-600 text-white rounded font-bold">Vincular</button>
                  </div>
               </div>
            </div>
         )}

         {/* Create Order Modal */}
         {editingOrder && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
                  <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                     <h3 className="font-bold text-lg">Nueva Orden de Compra</h3>
                     <button onClick={() => { setEditingOrder(null); setOrderItems([]); }}><X size={24} className="text-slate-400" /></button>
                  </div>

                  <div className="p-6 flex-1 overflow-y-auto">
                     <div className="grid grid-cols-2 gap-6 mb-6">
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Proveedor</label>
                           <select
                              className="w-full border p-2 rounded bg-white font-bold"
                              value={editingOrder.supplier_id || ''}
                              onChange={async e => {
                                 setEditingOrder({ ...editingOrder, supplier_id: e.target.value });
                                 // Fetch supplier products to populate selector
                                 await fetchSupplierProducts(e.target.value);
                              }}
                           >
                              <option value="">Seleccione Proveedor...</option>
                              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas</label>
                           <input
                              className="w-full border p-2 rounded"
                              placeholder="Notas opcionales..."
                              value={editingOrder.notes || ''}
                              onChange={e => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                           />
                        </div>
                     </div>

                     {/* Item Selector (Only if supplier selected) */}
                     {editingOrder.supplier_id && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 mb-6">
                           <h4 className="text-sm font-bold text-slate-600 mb-3">Agregar Productos</h4>
                           <div className="flex gap-2">
                              {supplierProducts.length > 0 ? (
                                 supplierProducts.map(sp => (
                                    <button
                                       key={sp.id}
                                       onClick={() => {
                                          const existing = orderItems.find(i => i.product_id === sp.product_id);
                                          if (existing) {
                                             setOrderItems(orderItems.map(i => i.product_id === sp.product_id ? { ...i, quantity: i.quantity + 1 } : i));
                                          } else {
                                             setOrderItems([...orderItems, {
                                                product_id: sp.product_id,
                                                name: sp.products?.name,
                                                quantity: 1,
                                                unit_cost: sp.unit_cost
                                             }]);
                                          }
                                       }}
                                       className="bg-white border border-slate-200 px-3 py-2 rounded shadow-sm hover:border-brand-500 text-sm text-left transition-colors"
                                    >
                                       <div className="font-bold">{sp.products?.name}</div>
                                       <div className="text-xs text-slate-500">${sp.unit_cost}</div>
                                    </button>
                                 ))
                              ) : (
                                 <p className="text-sm text-red-500">Este proveedor no tiene productos vinculados en el catálogo.</p>
                              )}
                           </div>
                        </div>
                     )}

                     {/* Order Items List */}
                     <table className="w-full text-left">
                        <thead className="text-xs uppercase text-slate-500 bg-slate-100">
                           <tr>
                              <th className="p-3">Producto</th>
                              <th className="p-3 w-32">Cantidad</th>
                              <th className="p-3 w-32">Costo U.</th>
                              <th className="p-3 w-32 text-right">Total</th>
                              <th className="p-3 w-10"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {orderItems.map((item, idx) => (
                              <tr key={idx}>
                                 <td className="p-3 font-medium">{item.name}</td>
                                 <td className="p-3">
                                    <input
                                       type="number"
                                       className="w-20 border rounded p-1 text-center"
                                       value={item.quantity}
                                       onChange={e => {
                                          const qty = parseFloat(e.target.value) || 0;
                                          const newItems = [...orderItems];
                                          newItems[idx].quantity = qty;
                                          setOrderItems(newItems);
                                       }}
                                    />
                                 </td>
                                 <td className="p-3 text-slate-500">${item.unit_cost}</td>
                                 <td className="p-3 text-right font-bold">${(item.quantity * item.unit_cost).toFixed(2)}</td>
                                 <td className="p-3">
                                    <button onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}><X size={16} className="text-red-400" /></button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                        <tfoot>
                           <tr className="bg-slate-50 font-bold text-slate-800">
                              <td colSpan={3} className="p-3 text-right uppercase text-xs">Total Estimado:</td>
                              <td className="p-3 text-right text-lg">
                                 ${orderItems.reduce((acc, i) => acc + (i.quantity * i.unit_cost), 0).toFixed(2)}
                              </td>
                              <td></td>
                           </tr>
                        </tfoot>
                     </table>
                  </div>

                  <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                     <button onClick={() => { setEditingOrder(null); setOrderItems([]); }} className="px-6 py-3 text-slate-500 font-bold">Cancelar</button>
                     <button
                        onClick={handleCreateOrder}
                        disabled={!orderItems.length}
                        className="px-6 py-3 bg-slate-900 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                        Confirmar y Crear Borrador
                     </button>
                  </div>
               </div>
            </div>
         )}

      </div>
   );
};

export default Suppliers;