import React, { useState, useEffect } from 'react';
import { Package, Hammer, Search, AlertCircle, Plus, X, ClipboardCheck, UserCheck, ShieldAlert, TrendingDown, Clock, Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw, Loader2, ArrowRight } from 'lucide-react';
import { InventoryAdjustmentType, Product, ProductType, InventoryMovement, ProductionOrder } from '../types';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

interface InventoryItem extends Product {
  dailyConsumption: number; // Configurable or calculated field
}

interface MovementLog {
  id: string;
  type: string;
  itemName: string;
  quantity: number;
  reason: string;
  user: string;
  date: string;
  rawDate: string; // ISO string for filtering
  unit: string;
}
const Inventory: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'inventory' | 'production'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // New History Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateStart, setHistoryDateStart] = useState('');
  const [historyDateEnd, setHistoryDateEnd] = useState('');

  // Data States
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Record<string, { ingredientId: string; qty: number }[]>>({});
  const [movements, setMovements] = useState<MovementLog[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]); // Local queue for now

  // Modal State for Manual Adjustment
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    quantity: 0,
    type: InventoryAdjustmentType.AUDITORIA,
    reason: ''
  });

  // Modal State for Production
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [newProductionProduct, setNewProductionProduct] = useState<string>('');
  const [newProductionQty, setNewProductionQty] = useState<number>(1);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Products (Inventory)
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (products) {
        // Map to InventoryItem, mocking dailyConsumption for now
        const items = products.map(p => ({
          ...p,
          dailyConsumption: p.min_stock ? p.min_stock / 2 : 1 // Rough estimate or mock
        }));
        setInventoryItems(items);
      }

      // 2. Fetch Recipes
      const { data: recipeData } = await supabase
        .from('product_recipes')
        .select('*');

      const recipeMap: Record<string, { ingredientId: string; qty: number }[]> = {};
      recipeData?.forEach(r => {
        if (!recipeMap[r.product_id]) recipeMap[r.product_id] = [];
        recipeMap[r.product_id].push({ ingredientId: r.ingredient_id, qty: r.quantity });
      });
      setRecipes(recipeMap);

      // 3. Fetch Recent Movements
      const { data: moveData } = await supabase
        .from('inventory_movements')
        .select(`
            *,
            products (name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      const logs = moveData?.map(m => ({
        id: m.id,
        type: m.type,
        itemName: m.products?.name || 'Producto Desconocido',
        quantity: m.quantity,
        reason: m.reason || '',
        user: m.user_id || 'System',
        date: new Date(m.created_at).toLocaleString(),
        rawDate: m.created_at,
        unit: 'un' // Default unit
      })) || [];
      setMovements(logs);

      // 4. Fetch Production Orders
      const { data: prodData } = await supabase
        .from('production_orders')
        .select(`
            *,
            products (name)
        `)
        .order('created_at', { ascending: false });

      if (prodData) {
        const prodOrders: ProductionOrder[] = prodData.map((p: any) => ({
          id: p.id,
          product_id: p.product_id,
          product_name: p.products?.name || 'Producto Desconocido',
          quantity: p.quantity,
          status: p.status,
          created_at: new Date(p.created_at).toLocaleDateString() + ' ' + new Date(p.created_at).toLocaleTimeString().slice(0, 5),
          notes: p.notes
        }));
        setProductionOrders(prodOrders);
      }

    } catch (error) {
      console.error("Error loading inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Logic for Manual Adjustment ---
  const handleOpenAdjust = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustForm({
      quantity: 0,
      type: InventoryAdjustmentType.AUDITORIA,
      reason: ''
    });
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async () => {
    if (!selectedItem) return;
    if (adjustForm.quantity === 0) return alert("La cantidad no puede ser 0");
    if (!adjustForm.reason.trim()) return alert("El motivo es obligatorio.");

    try {
      // Map UI Type to DB Type
      let dbType = 'ajuste';
      let dbQuantity = adjustForm.quantity;

      switch (adjustForm.type) {
        case InventoryAdjustmentType.RECEPCION:
          dbType = 'entrada';
          dbQuantity = Math.abs(adjustForm.quantity);
          break;
        case InventoryAdjustmentType.MERMA:
        case InventoryAdjustmentType.CONSUMO_INTERNO:
          dbType = 'salida';
          dbQuantity = Math.abs(adjustForm.quantity);
          break;
        default: // ERROR_ADMIN, AUDITORIA
          dbType = 'ajuste';
          // Keep sign as is for adjustments
          break;
      }

      // Log Movement ONLY - Trigger handles stock update
      const { error: logError } = await supabase
        .from('inventory_movements')
        .insert({
          product_id: selectedItem.id,
          type: dbType,
          quantity: dbQuantity,
          reason: `${adjustForm.type}: ${adjustForm.reason}`,
          user_id: user?.email || 'unknown'
        });

      if (logError) throw logError;

      // Step 10.3: Audit Log for Manual Adjustment
      await supabase.from('audit_logs').insert([{
        entity: 'inventory',
        entity_id: selectedItem.id,
        action: 'manual_adjustment',
        user_id: user?.email || 'unknown',
        new_value: {
          quantity: dbQuantity,
          type: dbType,
          reason: adjustForm.reason,
          product_name: selectedItem.name,
          adjusted_by: user?.email || 'unknown'
        },
        old_value: { stock_before: selectedItem.stock }
      }]);

      alert("Ajuste registrado correctamente.");
      setIsAdjustModalOpen(false);
      loadData(); // Refresh to see updated stock from DB

    } catch (error) {
      console.error("Error saving adjustment:", error);
      alert("Error al guardar ajuste.");
    }
  };

  // --- Logic for Production ---

  // Step 6.5: Validation of stock for production
  // Calculates real impact and verifies if there is enough stock
  const getRecipeImpact = (order: ProductionOrder) => {
    const ingredients = recipes[order.product_id];
    if (!ingredients) return [];

    return ingredients.map(ing => {
      const item = inventoryItems.find(i => i.id === ing.ingredientId);
      if (!item) return null;

      const requiredQty = ing.qty * order.quantity;
      const hasStock = item.stock >= requiredQty;

      return {
        ...item,
        requiredQty,
        hasStock,
        qtyPerUnit: ing.qty
      };
    }).filter(Boolean) as (InventoryItem & { requiredQty: number, hasStock: boolean, qtyPerUnit: number })[];
  };

  const calculateMaxPossible = (order: ProductionOrder) => {
    const ingredients = recipes[order.product_id];
    if (!ingredients) return 0;

    // Calculate max possible production for each ingredient
    const limits = ingredients.map(ing => {
      const item = inventoryItems.find(i => i.id === ing.ingredientId);
      if (!item) return 0;
      return Math.floor((item.stock / ing.qty) * 10) / 10;
    });

    return limits.length > 0 ? Math.min(...limits) : 0;
  };

  const handleConfirmProduction = async () => {
    if (!selectedOrder) return;
    const impact = getRecipeImpact(selectedOrder);

    if (impact.length === 0) {
      alert("Error: Este producto no tiene receta configurada. No se puede producir sin insumos.");
      return;
    }

    const canProduce = impact.every(i => i.hasStock);

    if (!canProduce) return;

    try {
      // 1. Deduct Ingredients (Only insert movement, trigger updates stock)
      for (const ing of impact) {
        const { error: moveError } = await supabase.from('inventory_movements').insert({
          product_id: ing.id,
          type: 'salida',
          quantity: ing.requiredQty,
          reason: `Producción ${selectedOrder.product_name}: Insumo`
        });

        if (moveError) throw moveError;
      }

      // 2. Add Finished Product (Only insert movement, trigger updates stock)
      const { error: moveError } = await supabase.from('inventory_movements').insert({
        product_id: selectedOrder.product_id,
        type: 'entrada', // Producción is an entry for the final product
        quantity: selectedOrder.quantity,
        reason: `Producción Finalizada: ${selectedOrder.id}`
      });

      if (moveError) throw moveError;

      // Step 6.7: Update Average Cost
      const finalProduct = inventoryItems.find(i => i.id === selectedOrder.product_id);
      let finalUnitCost = 0;

      if (finalProduct) {
        const currentStock = finalProduct.stock || 0; // Stock BEFORE production (snapshot)
        const currentCost = finalProduct.base_cost || 0;
        const producedQty = selectedOrder.quantity;

        // Calculate Cost of Goods Manufactured (COGM) based on current ingredients
        // impact contains the ingredients with their CURRENT base_cost
        const batchCost = impact.reduce((sum, ing) => sum + ((ing.base_cost || 0) * ing.requiredQty), 0);
        const unitProductionCost = batchCost / producedQty;
        finalUnitCost = unitProductionCost;

        let newBaseCost = unitProductionCost;

        // Weighted Average Calculation
        // Only average if we have positive stock, otherwise reset to current production cost
        if (currentStock > 0) {
          const currentTotalValue = currentStock * currentCost;
          const newTotalValue = currentTotalValue + batchCost;
          const newTotalQty = currentStock + producedQty; // Stock AFTER production
          newBaseCost = newTotalValue / newTotalQty;
        }

        // Update Product Cost
        const { error: costError } = await supabase
          .from('products')
          .update({ base_cost: newBaseCost })
          .eq('id', finalProduct.id);

        if (costError) console.error("Error updating product cost:", costError);
      }

      // 3. Update Order Status
      const { error: updateError } = await supabase
        .from('production_orders')
        .update({
          status: 'confirmed',
          produced_unit_cost: finalUnitCost, // Step 6.8: Save Resulting Cost
          user_id: user?.email || 'unknown'  // Step 6.8: Save User
        })
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      // Step 10.5: Audit Log for Production Confirmation
      await supabase.from('audit_logs').insert([{
        entity: 'production_order',
        entity_id: selectedOrder.id,
        action: 'confirm',
        user_id: user?.email || 'unknown',
        new_value: {
          quantity: selectedOrder.quantity,
          product: selectedOrder.product_name,
          unit_cost: finalUnitCost,
          total_cost: finalUnitCost * selectedOrder.quantity,
          confirmed_at: new Date().toISOString()
        }
      }]);

      alert("Producción registrada y stock actualizado.");

      // Remove from local queue or mark completed
      setSelectedOrder(null);
      loadData();

    } catch (error: any) {
      console.error("Error confirming production:", error);
      if (error.message && error.message.includes('Stock insuficiente')) {
        alert("Error: Stock insuficiente de materia prima para realizar esta producción.");
      } else {
        alert("Error al procesar producción.");
      }
    }
  };

  const createProductionOrder = async () => {
    if (!newProductionProduct || newProductionQty <= 0) return;
    const prod = inventoryItems.find(i => i.id === newProductionProduct);
    if (!prod) return;

    try {
      const { error } = await supabase.from('production_orders').insert({
        product_id: prod.id,
        quantity: newProductionQty,
        status: 'draft',
        created_at: new Date().toISOString()
      });

      if (error) throw error;

      setNewProductionProduct('');
      setNewProductionQty(1);
      setIsProductionModalOpen(false);
      loadData();
    } catch (error) {
      console.error("Error creating production order:", error);
      alert("Error al crear orden de producción.");
    }
  };

  const getMovementColor = (type: string) => {
    // Map DB types to colors
    if (type === 'PRODUCCION' || type === 'produccion') return 'text-purple-600 bg-purple-50 border-purple-100';
    if (type === 'entrada' || type === 'RECEPCION' || type === InventoryAdjustmentType.RECEPCION) return 'text-green-600 bg-green-50 border-green-100';
    if (type === 'salida' || type === 'MERMA' || type === InventoryAdjustmentType.MERMA) return 'text-red-600 bg-red-50 border-red-100';
    return 'text-slate-600 bg-slate-50 border-slate-100';
  };

  const filteredInventory = inventoryItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const criticalItems = inventoryItems.filter(i => i.stock < i.min_stock).length;
  // Warning logic: assuming default consumption if not set
  const warningItems = inventoryItems.filter(i => i.stock >= i.min_stock && (i.stock / i.dailyConsumption) < 3).length;

  const currentImpact = selectedOrder ? getRecipeImpact(selectedOrder) : [];
  const canProduceCurrent = selectedOrder && currentImpact.every(i => i.hasStock);
  const maxPossible = selectedOrder ? calculateMaxPossible(selectedOrder) : 0;

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;

  return (
    <div className="p-6 h-full overflow-y-auto relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {activeTab === 'inventory' ? 'Inventario & Stock' : 'Producción'}
          </h1>
          <p className="text-slate-500">
            {activeTab === 'inventory'
              ? 'Gestión de existencias en tiempo real'
              : 'Gestión de recetas y órdenes de producción'}
          </p>
        </div>

        <div className="flex bg-slate-200 p-1 rounded-lg mt-4 sm:mt-0">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'inventory' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <div className="flex items-center gap-2">
              <Package size={16} />
              <span>Inventario</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('production')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'production' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <div className="flex items-center gap-2">
              <Hammer size={16} />
              <span>Producción</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'inventory' ? "Buscar producto..." : "Buscar orden..."}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white text-slate-700"
            />
          </div>
          {activeTab === 'inventory' && (
            <button onClick={loadData} className="p-2 text-slate-500 hover:text-brand-600 bg-slate-100 rounded-lg">
              <RefreshCw size={18} />
            </button>
          )}
          {activeTab === 'production' && (
            <button
              onClick={() => setIsProductionModalOpen(true)}
              className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
            >
              <Plus size={18} />
              <span>Nueva Orden Producción</span>
            </button>
          )}
        </div>

        {activeTab === 'inventory' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Stock Actual</th>
                  <th className="px-6 py-4">Min Stock</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventory.map((item) => {
                  const isCritical = item.stock < item.min_stock;
                  const isWarning = !isCritical && (item.stock < item.min_stock * 1.2);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {item.name}
                        <div className="text-[10px] text-slate-400 font-normal uppercase">{item.type}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-700 font-bold">{item.stock}</td>
                      <td className="px-6 py-4 text-slate-600 text-sm">{item.min_stock}</td>
                      <td className="px-6 py-4">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                            <AlertCircle size={14} /> Crítico
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <TrendingDown size={14} /> Bajo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenAdjust(item)}
                          className="text-slate-500 hover:text-brand-600 hover:bg-brand-50 px-3 py-1 rounded-lg text-sm font-medium transition-all border border-transparent hover:border-brand-200 flex items-center justify-end gap-2 ml-auto"
                        >
                          <ClipboardCheck size={16} />
                          Ajustar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {productionOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p>No hay órdenes de producción pendientes.</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-4">ID Orden</th>
                    <th className="px-6 py-4">Producto a Producir</th>
                    <th className="px-6 py-4">Cantidad</th>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productionOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-slate-500 text-xs">{order.id}</td>
                      <td className="px-6 py-4 font-medium text-slate-800">{order.product_name}</td>
                      <td className="px-6 py-4 text-slate-600">{order.quantity} un</td>
                      <td className="px-6 py-4 text-slate-500">{order.created_at}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${order.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                          {order.status === 'confirmed' ? 'Confirmado' : 'Borrador'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {order.status === 'draft' && (
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="text-brand-600 hover:text-brand-800 text-sm font-medium border border-brand-200 px-3 py-1 rounded-lg hover:bg-brand-50"
                          >
                            Validar y Confirmar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Audit Log */}
      <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
            <ShieldAlert size={16} className="text-slate-400" />
            Auditoría de Movimientos
          </h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Filtrar por producto..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="px-3 py-1.5 text-xs border rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
            <input
              type="date"
              value={historyDateStart}
              onChange={(e) => setHistoryDateStart(e.target.value)}
              className="px-3 py-1.5 text-xs border rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
            <span className="text-slate-400 self-center">-</span>
            <input
              type="date"
              value={historyDateEnd}
              onChange={(e) => setHistoryDateEnd(e.target.value)}
              className="px-3 py-1.5 text-xs border rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
            {(historySearch || historyDateStart || historyDateEnd) && (
              <button
                onClick={() => { setHistorySearch(''); setHistoryDateStart(''); setHistoryDateEnd(''); }}
                className="text-xs text-red-500 hover:text-red-700 font-bold px-2"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="space-y-0 divide-y divide-slate-100 max-h-96 overflow-y-auto pr-2">
          {movements
            .filter(m => {
              const matchesSearch = m.itemName.toLowerCase().includes(historySearch.toLowerCase());
              // Simple string comparison for dates works if format is consistent or converted nicely,
              // but parsing is safer. Assuming ISO strings in DB and local date inputs YYYY-MM-DD.
              // Movement date is locale string in UI state, let's look at raw data if possible or just do crude check.
              // Wait, 'movements' state already has formatted date string.
              // Better to filter on fetch? Or keep filtered list?
              // For small datasets (<500), client filtering is fine.
              // But 'date' in state is toLocaleString().
              // Let's rely on basic string match or reloading data for range?
              // For simplicity in this step, let's filter purely by text match on name and simple logic on date if feasible.
              // Actually, best approach is:
              if (!matchesSearch) return false;

              if (!m.rawDate) return true;

              const movDate = new Date(m.rawDate);

              if (historyDateStart) {
                const start = new Date(historyDateStart);
                // Reset time to start of day for comparison
                start.setHours(0, 0, 0, 0);
                if (movDate < start) return false;
              }

              if (historyDateEnd) {
                const end = new Date(historyDateEnd);
                end.setHours(23, 59, 59, 999);
                if (movDate > end) return false;
              }

              return true;
            })
            // Real implementation of date filtering needs raw date in state.
            .map((mov) => (
              <div key={mov.id} className="py-3 flex justify-between items-start group hover:bg-slate-50 px-2 rounded-lg transition-colors">
                <div className="flex gap-3">
                  <div className={`mt-1 w-2 h-2 rounded-full ${mov.quantity > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">{mov.itemName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${getMovementColor(mov.type)}`}>
                        {mov.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 italic">"{mov.reason}"</p>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <UserCheck size={10} /> {mov.user} • {mov.date}
                    </p>
                  </div>
                </div>
                <span className={`font-mono text-sm font-bold ${mov.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {mov.quantity > 0 ? '+' : ''}{mov.quantity} {mov.unit}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Manual Adjustment Modal */}
      {isAdjustModalOpen && selectedItem && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-lg text-slate-800">Ajuste de Inventario</h3>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wide mt-1">
                  {selectedItem.name}
                </p>
              </div>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <span className="text-sm text-blue-800 font-medium">Existencia Actual:</span>
                <span className="text-xl font-bold text-blue-900 font-mono">{selectedItem.stock}</span>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Cantidad a ajustar (+/-)</label>
                <input
                  type="number"
                  className="w-full p-3 rounded-lg border-2 text-lg font-mono font-bold outline-none transition-colors border-slate-200 text-slate-800 focus:border-brand-500 bg-white"
                  placeholder="0"
                  value={adjustForm.quantity === 0 ? '' : adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-slate-400 mt-1">Use negativo (-) para salidas, positivo (+) para entradas.</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Ajuste</label>
                <select
                  className="w-full p-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as InventoryAdjustmentType })}
                >
                  {Object.values(InventoryAdjustmentType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Motivo / Justificación
                </label>
                <textarea
                  className="w-full p-3 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px] bg-white text-slate-700"
                  placeholder="Describa la razón del ajuste..."
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                ></textarea>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
              <button onClick={() => setIsAdjustModalOpen(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveAdjustment} className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg shadow-lg shadow-brand-500/30 transition-all">
                Confirmar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Production Order Modal */}
      {isProductionModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-800">
              Nueva Orden de Producción
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Producto</label>
                <select
                  className="w-full p-2 border rounded-lg bg-white text-slate-700"
                  value={newProductionProduct}
                  onChange={(e) => setNewProductionProduct(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {inventoryItems.filter(i => i.is_producible).map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cantidad</label>
                <input
                  type="number" min="1"
                  className="w-full p-2 border rounded-lg bg-white text-slate-700"
                  value={newProductionQty}
                  onChange={(e) => setNewProductionQty(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setIsProductionModalOpen(false)} className="px-3 py-1.5 text-slate-500 text-sm font-bold">Cancelar</button>
              <button onClick={createProductionOrder} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-bold">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Production Validation Modal */}
      {selectedOrder && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
              <div>
                <h3 className="font-bold text-2xl text-slate-800">Confirmar Producción</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Se producirán <strong>{selectedOrder.quantity} un</strong> de <strong className="text-purple-700">{selectedOrder.product_name}</strong>
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">
                <X size={28} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Package size={18} /> Impacto en Inventario (Materia Prima)
              </h4>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-4 py-3">Ingrediente</th>
                      <th className="px-4 py-3 text-center">Requerido</th>
                      <th className="px-4 py-3 text-center">Disponible</th>
                      <th className="px-4 py-3 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentImpact.map((ing, idx) => (
                      <tr key={idx} className={ing.hasStock ? 'bg-white' : 'bg-red-50'}>
                        <td className="px-4 py-3 font-medium text-slate-700">{ing.name}</td>
                        <td className="px-4 py-3 text-center text-slate-600 font-mono">
                          {ing.requiredQty.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600 font-mono">
                          {ing.stock.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {ing.hasStock ? (
                            <span className="inline-flex items-center gap-1 text-green-600 font-bold text-xs bg-green-100 px-2 py-1 rounded-full">
                              <CheckCircle size={14} /> Suficiente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 font-bold text-xs bg-red-100 px-2 py-1 rounded-full">
                              <XCircle size={14} /> Faltan {(ing.requiredQty - ing.stock).toFixed(2)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!canProduceCurrent && (
                <div className="mt-4 space-y-3">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-start">
                    <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
                    <div>
                      <h5 className="font-bold text-red-700 text-sm">Producción Completa Bloqueada</h5>
                      <p className="text-red-600 text-xs mt-1">
                        No existe suficiente stock para producir la cantidad total.
                      </p>
                    </div>
                  </div>

                  {maxPossible > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-center justify-between">
                      <div className="flex gap-3 items-center">
                        <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                        <div>
                          <h5 className="font-bold text-amber-800 text-sm">Opción: Producción Parcial</h5>
                          <p className="text-amber-700 text-xs mt-1">
                            Puede producir hasta <strong>{maxPossible} un</strong> con los ingredientes actuales.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedOrder({ ...selectedOrder, quantity: maxPossible })}
                        className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold rounded-lg border border-amber-200 flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw size={12} />
                        Ajustar a {maxPossible} un
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmProduction}
                disabled={!canProduceCurrent}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-brand-500/30 transition-all flex items-center gap-2"
              >
                <CheckCircle size={18} />
                Confirmar Producción
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Inventory;