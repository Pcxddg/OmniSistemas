import React, { useState, useMemo, useEffect } from 'react';
import { Search, Grid, List, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone, ChefHat, User, Send, Save, Clock, X, AlertOctagon, ShoppingCart, CheckCircle, Monitor, Lock, Unlock } from 'lucide-react';
import { Product, CartItem, ProductType, ModifierGroup, ModifierOption, PaymentMethod, OrderTypeConfig, CategoryConfig, TableConfig, TerminalConfig, OrderPayment } from '../types';
import { supabase } from '../supabase';
import { useOrganization } from '../OrganizationContext';

// Mock Data - Updated to reflect strict rules logic
// Mock Data for demo/transition
// Modifiers fetched dynamically now


const EMPLOYEES = ['Juan Doe', 'Ana Smith', 'Carlos Ruiz'];

const POS: React.FC = () => {
  const { organizationId } = useOrganization();
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Dynamic States
  const [orderTypes, setOrderTypes] = useState<OrderTypeConfig[]>([]);
  const [selectedOrderType, setSelectedOrderType] = useState<OrderTypeConfig | null>(null);
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [terminals, setTerminals] = useState<TerminalConfig[]>([]);
  const [currentTerminal, setCurrentTerminal] = useState<TerminalConfig | null>(null);

  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>(EMPLOYEES[0]);
  const [exchangeRate, setExchangeRate] = useState(36.5); // Default, will update from DB
  const [taxRate, setTaxRate] = useState(0.16); // Default 16%
  const [storeInfo, setStoreInfo] = useState({ name: 'OmniPOS', address: 'Av. Principal #123', rif: 'J-12345678-9' });

  // Modifiers Modal State
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [availableModifiers, setAvailableModifiers] = useState<ModifierOption[]>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<ModifierOption[]>([]);
  const [currentModifierPrice, setCurrentModifierPrice] = useState(0);

  // Checkout State
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null); // Kept for UI selection in split payment
  const [payments, setPayments] = useState<OrderPayment[]>([]); // New: Multi-payment support
  const [paymentAmount, setPaymentAmount] = useState<string>(''); // New: Input for amount

  // Cash Register State
  const [activeCashRegisterId, setActiveCashRegisterId] = useState<string | null>(null);
  const [isRegisterLoading, setIsRegisterLoading] = useState(true);

  // Receipt State
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null); // Store completed order for receipt

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMethods(true);
      setIsLoadingProducts(true);

      // Fetch Payment Methods
      const { data: payData } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      setPaymentMethods(payData || []);
      if (payData && payData.length > 0) setSelectedPaymentMethod(payData[0]);

      // Fetch Order Types
      const { data: orderData } = await supabase
        .from('order_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      setOrderTypes(orderData || []);
      if (orderData && orderData.length > 0) setSelectedOrderType(orderData[0]);

      // Fetch Categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .eq('is_visible', true)
        .order('sort_order', { ascending: true });
      setCategories(catData || []);

      // Fetch Tables
      const { data: tableData } = await supabase
        .from('tables')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      setTables(tableData || []);

      // Fetch Terminals
      const { data: terminalData } = await supabase
        .from('terminals')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      setTerminals(terminalData || []);
      if (terminalData && terminalData.length > 0) setCurrentTerminal(terminalData[0]);

      // Check Active Cash Register
      const { data: register } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('status', 'open')
        .limit(1)
        .maybeSingle();

      if (register) {
        setActiveCashRegisterId(register.id);
      } else {
        setActiveCashRegisterId(null);
      }
      setIsRegisterLoading(false);

      // Fetch Products
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      setProducts(prodData || []);

      // Fetch App Settings
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('*');

      if (settingsData) {
        settingsData.forEach((setting: any) => {
          if (setting.key === 'exchange_rate') setExchangeRate(Number(setting.value));
          if (setting.key === 'tax_rate') setTaxRate(Number(setting.value) / 100); // Store as percentage (e.g., 16 -> 0.16)
          if (setting.key === 'store_info') setStoreInfo(setting.value);
        });
      }

      setIsLoadingMethods(false);
      setIsLoadingProducts(false);
    };
    fetchData();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p: Product) => {
      // Paso 2.6: Strict visibility rules
      const isVisible = p.is_active && p.price > 0 && p.type !== ProductType.PRODUCTION;
      if (!isVisible) return false;

      if (selectedCategory === 'Todo') return p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const category = categories.find((c: CategoryConfig) => c.name === selectedCategory);
      const matchesCategory = category ? p.category_id === category.id : false;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, categories, selectedCategory, searchQuery]);

  // VALIDATION RULE: Check if product can be sold based on stock rules
  const canSellProduct = (product: Product) => {
    if (!product.is_active) return false;
    // Stock validation enabled
    if (product.type !== ProductType.COMPOUND && product.stock <= 0) return false;
    return true;
  };

  const initiateAddToCart = async (product: Product) => {
    if (!canSellProduct(product)) return;

    // Check for modifiers in DB
    const { data: modLinks } = await supabase
      .from('product_modifiers')
      .select('modifier_id, modifiers(*)') // Join to get details
      .eq('product_id', product.id)
      .eq('modifiers.is_active', true);

    if (modLinks && modLinks.length > 0) {
      // Map to ModifierOption format
      const validModifiers = modLinks
        .map((link: any) => link.modifiers)
        .filter((m: any) => m !== null) // Safety check
        .map((m: any) => ({

          id: m.id,
          name: m.name,
          price: m.price,
          cost: m.cost,
          // Inventory logic
          inventoryItemId: m.inventory_product_id, // Map DB column to internal type
          consumption: m.quantity_consumed
        }));

      if (validModifiers.length > 0) {
        setAvailableModifiers(validModifiers);
        setPendingProduct(product);
        setSelectedModifiers([]);
        setCurrentModifierPrice(0);
        setIsModifierModalOpen(true);
        return;
      }
    }

    // No modifiers found, add directly
    addToCartDirectly(product);
  };

  // Removed obsolete categoryNeedsModifiers helper

  const addToCartDirectly = (product: Product, modifiers: ModifierOption[] = [], extraPrice: number = 0) => {
    setCart(prev => {
      // If standard product without modifiers, stack quantity
      if (modifiers.length === 0) {
        const existing = prev.find((item: CartItem) => item.id === product.id && (!item.modifiers || item.modifiers.length === 0));
        if (existing) {
          // Validate stock before incrementing
          if (product.type !== ProductType.COMPOUND && existing.quantity >= product.stock) {
            alert(`Stock insuficiente para ${product.name}`);
            return prev;
          }
          return prev.map((item: CartItem) => item.cartId === existing.cartId ? { ...item, quantity: item.quantity + 1 } : item);
        }
      }

      // Calculate Extra Cost for Modifiers
      const extraCost = modifiers.reduce((acc: number, mod: ModifierOption) => acc + (mod.cost || 0), 0);

      return [...prev, {
        ...product,
        price: product.price + extraPrice,
        base_cost: (product.base_cost || 0) + extraCost, // Integrate modifier cost
        cartId: Date.now().toString(),
        quantity: 1,
        modifiers: modifiers
      }];
    });
  };

  const confirmModifiers = () => {
    if (pendingProduct) {
      addToCartDirectly(pendingProduct, selectedModifiers, currentModifierPrice);
      setIsModifierModalOpen(false);
      setPendingProduct(null);
    }
  };

  const toggleModifier = (mod: ModifierOption) => {
    if (selectedModifiers.find((m: ModifierOption) => m.id === mod.id)) {
      setSelectedModifiers(prev => prev.filter((m: ModifierOption) => m.id !== mod.id));
      setCurrentModifierPrice(prev => prev - mod.price);
    } else {
      setSelectedModifiers(prev => [...prev, mod]);
      setCurrentModifierPrice(prev => prev + (mod.price || 0)); // Safety check
    }
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map((item: CartItem) => {
      if (item.cartId === cartId) {
        // Validate stock increment (implicit check via item.stock if exists)
        if (delta > 0 && item.type !== ProductType.COMPOUND && (item.stock !== undefined && item.quantity >= item.stock)) {
          // simplified logic from original
          return item; // Max stock reached
        }
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const subtotal = cart.reduce((acc: number, item: CartItem) => acc + (item.price * item.quantity), 0);
  const tax = subtotal * taxRate;
  const totalUSD = subtotal + tax;
  const totalBs = totalUSD * exchangeRate;

  // New: Payment Logic
  useEffect(() => {
    if (showCheckout && payments.length === 0) {
      setPaymentAmount(totalUSD.toFixed(2));
    }
  }, [showCheckout, totalUSD]);

  const totalPaid = payments.reduce((acc: number, p: OrderPayment) => acc + p.amount, 0);
  const remaining = totalUSD - totalPaid;

  const handleAddPayment = () => {
    if (!selectedPaymentMethod) return alert("Seleccione un método de pago");
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return alert("Monto inválido");

    // Allow overpayment? For now, yes, to handle "change" or just simple entry.
    // Ideally we should warn if amount > remaining.

    const newPayment: OrderPayment = {
      id: Date.now().toString(), // Temp ID
      payment_method_id: selectedPaymentMethod.id,
      amount: amount
    };

    setPayments([...payments, newPayment]);

    // Auto-update next amount
    const newRemaining = totalUSD - (totalPaid + amount);
    setPaymentAmount(newRemaining > 0 ? newRemaining.toFixed(2) : '0.00');
  };

  const handleRemovePayment = (id?: string) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const handleCheckout = async () => {
    if (!activeCashRegisterId) return alert("❌ ERROR CRÍTICO: No hay caja abierta. Abra su turno para continuar.");

    if (payments.length === 0 && totalUSD > 0) return alert("No hay pagos registrados");
    if (remaining > 0.01) return alert("Aún falta cubrir el monto total");

    try {
      // 1. Create Order
      const orderData = {
        total: totalUSD,
        payment_method_id: payments[0]?.payment_method_id, // Use first payment as primary/fallback logic
        table_id: selectedTable ? tables.find(t => t.name === selectedTable)?.id : null,
        order_type_id: selectedOrderType?.id,
        notes: '',
        user_id: selectedEmployee,
        status: 'pending', // Initial status for Kitchen
        subtotal: subtotal,
        tax: tax,
        cash_register_id: activeCashRegisterId, // Link to specific cash session
        organization_id: organizationId
      };

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Create Order Items and Modifiers
      for (const item of cart) {
        // A. Create Order Item
        // Fix: Calculate clean base cost (subtract modifier costs logic from total) to prevent double counting
        const modifiersCostRaw = item.modifiers ? item.modifiers.reduce((acc, mod) => acc + (mod.cost || 0), 0) : 0;
        const cleanBaseCost = (item.base_cost || 0) - modifiersCostRaw;

        const { data: newItem, error: itemError } = await supabase
          .from('order_items')
          .insert({
            order_id: newOrder.id,
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
            unit_cost: cleanBaseCost
            // Note: 'modifiers' column in order_items is removed/ignored in favor of new table
          })
          .select()
          .single();

        if (itemError) throw itemError;

        // B. Create Snapshot of Modifiers
        if (item.modifiers && item.modifiers.length > 0) {
          const modifiersData = item.modifiers.map(mod => ({
            order_item_id: newItem.id,
            modifier_id: mod.id, // Link to original modifier (can be null/deleted later, that's why we snapshot)
            modifier_name_snapshot: mod.name,
            modifier_price_snapshot: mod.price,
            modifier_cost_snapshot: mod.cost
          }));

          const { error: modError } = await supabase
            .from('order_item_modifiers')
            .insert(modifiersData);

          if (modError) throw modError;
        }
      }

      // 2b. Create Order Payments (New Step)
      const paymentsData = payments.map(p => ({
        order_id: newOrder.id,
        payment_method_id: p.payment_method_id,
        amount: p.amount
      }));

      const { error: payError } = await supabase
        .from('order_payments')
        .insert(paymentsData);


      if (payError) throw payError;

      // 3. Log Movement Only (Trigger auto-updates stock)
      for (const item of cart) {
        // A. Primary Product Movement
        const { error: moveError } = await supabase.from('inventory_movements').insert({
          product_id: item.id,
          type: 'salida',
          quantity: item.quantity,
          reason: `Venta POS #${newOrder.id.slice(0, 8)}`
        });

        if (moveError) {
          console.error("Error logging movement for", item.name, moveError);
          if (moveError.message.includes('Stock insuficiente')) {
            alert(`Error: Stock insuficiente para ${item.name}.`);
            // Continue processing other items, or handle rollback strategy in future
          }
        }

        // B. Modifiers Inventory Movement (New Step 7.7)
        if (item.modifiers && item.modifiers.length > 0) {
          for (const mod of item.modifiers) {
            if (mod.inventoryItemId && mod.consumption && mod.consumption > 0) {
              const totalConsumption = mod.consumption * item.quantity;

              const { error: modInvError } = await supabase.from('inventory_movements').insert({
                product_id: mod.inventoryItemId, // This is the UUID of the ingredient (e.g., Bacon ID)
                type: 'salida',
                quantity: totalConsumption,
                reason: `Modificador Venta #${newOrder.id.slice(0, 8)}: ${mod.name}`
              });

              if (modInvError) console.error(`Error subtracting stock for modifier ${mod.name}:`, modInvError);
            }
          }
        }
      }

      setLastOrder({ ...newOrder, items: [...cart], payments: [...payments] });
      setCart([]);
      setPayments([]);
      setShowCheckout(false);
      setShowReceipt(true); // Show Receipt Modal

      // Refresh products to show new stock
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (prodData) setProducts(prodData);

    } catch (error) {
      console.error("Error processing checkout:", error);
      alert("Error al procesar la venta. Ver consola.");
    }
  };

  return (
    <div className="flex h-full flex-col md:flex-row overflow-hidden bg-slate-100 relative">

      {/* Product Selection Area (Left) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white p-4 shadow-sm z-10">
          {/* ... (Header components same as before) ... */}
          <div className="flex gap-4 mb-4 overflow-x-auto pb-2 scrollbar-hide">
            <button
              key="all"
              onClick={() => setSelectedCategory('Todo')}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all border-2 ${selectedCategory === 'Todo'
                ? 'bg-slate-800 text-white border-slate-800 shadow-lg scale-105'
                : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'
                }`}
            >
              Todo
            </button>
            {categories.map((cat: CategoryConfig) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all border-2 ${selectedCategory === cat.name
                  ? 'bg-slate-800 text-white border-slate-800 shadow-lg scale-105'
                  : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'
                  }`}
              >
                {cat.name}
              </button>
            ))}
            {currentTerminal && (
              <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-full">
                <Monitor size={14} />
                <span className="text-[10px] font-black uppercase whitespace-nowrap">{currentTerminal.name}</span>
              </div>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-slate-700"
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20 md:pb-4">
            {filteredProducts.map((product: Product) => {
              const isOutOfStock = !canSellProduct(product);

              return (
                <div
                  key={product.id}
                  onClick={() => initiateAddToCart(product)}
                  className={`group bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer relative ${isOutOfStock ? 'opacity-60 grayscale cursor-not-allowed' : ''}`}
                >
                  <div className="h-40 overflow-hidden relative border-b border-slate-100">
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                        <div className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase flex items-center gap-1 shadow-lg transform rotate-[-10deg]">
                          <AlertOctagon size={14} /> Agotado
                        </div>
                      </div>
                    )}
                    {!isOutOfStock && (
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                        <span className="text-white text-xs font-bold border border-white/40 px-3 py-1 bg-slate-900/80">Añadir</span>
                      </div>
                    )}
                    <img src={product.image_url || 'https://via.placeholder.com/100?text=Sin+Imagen'} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute top-0 right-0 bg-slate-900 text-white px-3 py-1 font-bold text-sm">
                      ${product.price}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-slate-700 text-sm">{product.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${product.type === 'simple' ? 'bg-blue-50 text-blue-500 border border-blue-100' : product.type === 'compuesto' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                        {product.type}
                      </span>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
                        {product.type === 'simple' ? 'Venta Directa' : product.type === 'compuesto' ? 'Receta / Combo' : 'Preparación'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cart Area (Right) */}
      <div className="w-full md:w-[400px] bg-white shadow-xl flex flex-col h-[50vh] md:h-full border-l border-slate-200">
        {/* Order Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex justify-between items-center mb-4">
            {/* Register Status Badge */}
            <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border ${activeCashRegisterId
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
              : 'bg-red-100 text-red-700 border-red-200 animate-pulse'
              }`}>
              {activeCashRegisterId ? <Unlock size={14} /> : <Lock size={14} />}
              {activeCashRegisterId ? 'CAJA ABIERTA' : 'CAJA CERRADA'}
            </div>
            <div className="text-right text-[10px] text-slate-400 font-mono">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-brand-100 rounded-lg text-brand-600">
                <User size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Empleado</p>
                <select
                  className="bg-transparent font-semibold text-slate-800 text-sm focus:outline-none cursor-pointer"
                  value={selectedEmployee}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedEmployee(e.target.value)}
                >
                  {EMPLOYEES.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                </select>
              </div>
            </div>
            <div className="text-right">
              {selectedOrderType?.requires_table && (
                <select
                  value={selectedTable}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTable(e.target.value)}
                  className="bg-white border-2 border-slate-200 rounded-md text-[10px] px-2 py-1 font-black text-slate-700 uppercase focus:border-brand-500 outline-none"
                >
                  <option value="">Mesa?</option>
                  {tables.map((table: TableConfig) => (
                    <option key={table.id} value={table.name}>{table.name}</option>
                  ))}
                </select>
              )}
              {!selectedOrderType?.requires_table && (
                <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded">Mesa no req.</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {orderTypes.map((type: OrderTypeConfig) => (
              <button
                key={type.id}
                onClick={() => {
                  setSelectedOrderType(type);
                  if (!type.requires_table) setSelectedTable('');
                }}
                className={`text-[10px] font-black uppercase py-2 px-1 rounded transition-all border-2 ${selectedOrderType?.id === type.id
                  ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105 z-10'
                  : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'
                  }`}
              >
                {type.name}
              </button>
            ))}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Grid size={48} className="mb-4 opacity-20" />
              <p>El carrito está vacío</p>
            </div>
          ) : (
            cart.map((item: CartItem) => (
              <div key={item.cartId} className="flex gap-3 group relative">
                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                  <img src={item.image_url || 'https://via.placeholder.com/100'} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h4 className="font-medium text-slate-800 text-sm">{item.name}</h4>
                    <span className="font-semibold text-slate-800 text-sm">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <p className="text-[10px] text-slate-500 leading-tight my-1">
                      {item.modifiers.map((m: ModifierOption) => `${m.name} (+$${m.price.toFixed(2)})`).join(', ')}
                    </p>
                  )}
                  <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1 border border-slate-100">
                      <button
                        onClick={() => updateQuantity(item.cartId, -1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-white shadow-sm text-slate-600 hover:text-red-500"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-semibold w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.cartId, 1)}
                        className={`w-6 h-6 flex items-center justify-center rounded bg-white shadow-sm transition-colors ${item.type !== ProductType.COMPOUND && item.quantity >= item.stock
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-600 hover:text-green-600'
                          }`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.cartId)}
                      className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Actions */}
        <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-end pt-2 border-t border-dashed border-slate-200">
              <div>
                <span className="font-bold text-slate-800 text-lg">Total</span>
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-800 text-xl">${totalUSD.toFixed(2)}</div>
                <div className="text-sm font-medium text-slate-500">Bs {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {selectedOrderType?.requires_table && !selectedTable && cart.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-2 rounded flex items-center gap-2 mb-2 animate-pulse">
                <AlertOctagon size={16} className="text-amber-500" />
                <span className="text-[10px] font-bold text-amber-700 uppercase">Se requiere seleccionar una mesa</span>
              </div>
            )}

            {!activeCashRegisterId && !isRegisterLoading && (
              <div className="mb-2 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm text-center font-bold flex flex-col gap-1 animate-pulse">
                <span className="flex items-center justify-center gap-2"><AlertOctagon size={16} /> CAJA CERRADA</span>
                <span className="text-xs font-normal">Debe abrir caja para procesar ventas.</span>
              </div>
            )}

            <button
              onClick={() => {
                // Strict Validation Rule: Register Must be Open
                if (!activeCashRegisterId) {
                  alert("⚠️ ERROR: No hay caja abierta. Abra su turno en 'Arqueo de Caja'.");
                  return;
                }
                // Strict Validation Rule: Require Table
                if (selectedOrderType?.requires_table && !selectedTable) {
                  alert("⚠️ REGLA: Este tipo de pedido REQUIERE seleccionar una mesa.");
                  return;
                }
                setShowCheckout(true);
              }}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded flex items-center justify-center gap-3 transition-all border-b-4 border-slate-950 active:translate-y-[2px] active:border-b-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={cart.length === 0 || !activeCashRegisterId}
            >
              <Send size={18} />
              <span className="tracking-wide uppercase text-sm">Procesar Pago</span>
            </button>

            {/* "Send to Kitchen" without paying - ONLY if pay_before is FALSE */}
            {!selectedOrderType?.pay_before && (
              <button
                // Strict Block: Cannot postpone if table is missing (when required) or register is closed
                disabled={cart.length === 0 || (selectedOrderType?.requires_table && !selectedTable) || !activeCashRegisterId}
                onClick={() => {
                  if (!activeCashRegisterId) return;
                  if (selectedOrderType?.requires_table && !selectedTable) {
                    alert("⚠️ REGLA: Debe asignar una mesa para enviar a cocina.");
                    return;
                  }
                  // Logic to save as 'active' (Sent to kitchen) without payment
                  /* In a real implementation this would call a subset of handleCheckout 
                     that sets status='active' but payment_method=null */
                  alert("Funcionalidad de comandas (Sin cobro) - Próximamente");
                }}
                className="w-full bg-white hover:bg-slate-100 text-slate-600 font-bold py-3 rounded border border-slate-300 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <ChefHat size={16} />
                <span className="text-sm">Enviar a Cocina</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modifiers Modal */}
      {isModifierModalOpen && pendingProduct && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{pendingProduct.name}</h3>
                <p className="text-sm text-slate-500">Selecciona modificadores</p>
              </div>
              <button onClick={() => setIsModifierModalOpen(false)} className="text-slate-400 hover:text-red-500">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {/* Simplified List for now - Grouping is a future enhancement if needed */}
              <div className="mb-6">
                <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">Opciones Disponibles</h4>
                <div className="space-y-2">
                  {availableModifiers.map(opt => (
                    <label key={opt.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-brand-50 hover:border-brand-200 transition-all">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500"
                          checked={!!selectedModifiers.find(m => m.id === opt.id)}
                          onChange={() => toggleModifier(opt)}
                        />
                        <span className="font-medium text-slate-700">{opt.name}</span>
                      </div>
                      {opt.price > 0 && (
                        <span className="text-sm font-bold text-slate-500">+${opt.price.toFixed(2)}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Total Item</p>
                <p className="text-xl font-bold text-brand-600">${(pendingProduct.price + currentModifierPrice).toFixed(2)}</p>
              </div>
              <button
                onClick={confirmModifiers}
                className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-brand-500/30"
              >
                Agregar al Pedido
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Checkout Modal */}
      {showCheckout && (
        <div className="absolute inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-auto">
            {/* Left side: Summary */}
            <div className="bg-slate-50 p-6 md:w-1/2 border-b md:border-b-0 md:border-r border-slate-200">
              <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                <ShoppingCart size={24} /> Resumen de Orden
              </h3>
              <div className="space-y-4 max-h-[300px] overflow-y-auto mb-6 pr-2">
                {cart.map((item: CartItem) => (
                  <div key={item.cartId} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                    <div>
                      <span className="font-bold text-slate-700">{item.quantity}x</span> {item.name}
                    </div>
                    <span className="font-mono font-bold">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t-2 border-slate-200 pt-4 space-y-2">
                <div className="flex justify-between text-slate-500 text-xs font-bold uppercase">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-xs font-bold uppercase">
                  <span>IVA ({(taxRate * 100).toFixed(0)}%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <span className="text-xl font-black text-slate-800">TOTAL</span>
                  <div className="text-right">
                    <div className="text-3xl font-black text-slate-900">${totalUSD.toFixed(2)}</div>
                    <div className="text-sm font-bold text-slate-400">Bs {totalBs.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Payment Methods */}
            <div className="p-6 md:w-1/2 flex flex-col bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-slate-800">Pagos</h3>
                <button onClick={() => setShowCheckout(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Split Payment Logic */}
              <div className="flex-1 flex flex-col gap-4 overflow-hidden">

                {/* List of Payments */}
                <div className="flex-1 overflow-y-auto bg-slate-50 rounded-lg p-2 border border-slate-100 space-y-2">
                  {payments.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                      Agregue un método de pago
                    </div>
                  ) : (
                    payments.map((p: OrderPayment, idx: number) => {
                      const method = paymentMethods.find((m: PaymentMethod) => m.id === p.payment_method_id);
                      return (
                        <div key={idx} className="flex justify-between items-center bg-white p-3 rounded shadow-sm border border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase bg-slate-100 px-2 py-1 rounded text-slate-600">
                              {method?.name || 'Unknown'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-slate-800">${p.amount.toFixed(2)}</span>
                            <button onClick={() => handleRemovePayment(p.id)} className="text-slate-400 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Payment Input Area */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {paymentMethods.map((method: PaymentMethod) => (
                      <button
                        key={method.id}
                        onClick={() => setSelectedPaymentMethod(method)}
                        className={`p-2 rounded-lg border text-xs font-bold uppercase transition-all flex items-center gap-2 ${selectedPaymentMethod?.id === method.id
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                          }`}
                      >
                        {method.type === 'efectivo' ? <Banknote size={14} /> : <Smartphone size={14} />}
                        {method.name}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        className="w-full pl-6 pr-4 py-3 rounded-lg border border-slate-300 font-mono text-lg font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentAmount(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={handleAddPayment}
                      className="bg-brand-600 hover:bg-brand-700 text-white px-4 rounded-lg font-bold shadow-md active:translate-y-1 transition-all"
                    >
                      <Plus size={24} />
                    </button>
                  </div>
                </div>

                {/* Summary & Action */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Pagado:</span>
                    <span className="font-bold text-green-600">${totalPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black">
                    <span className="text-slate-700">Faltante:</span>
                    <span className={`${remaining > 0.01 ? 'text-red-600' : 'text-slate-400'}`}>
                      ${Math.max(0, remaining).toFixed(2)}
                    </span>
                  </div>

                  {remaining < -0.001 && (
                    <div className="flex justify-between text-lg font-black animate-bounce">
                      <span className="text-slate-700">Cambio:</span>
                      <span className="text-blue-600">
                        ${Math.abs(remaining).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <button
                    disabled={remaining > 0.01}
                    onClick={handleCheckout}
                    className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-lg shadow-xl shadow-slate-900/20 active:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    <CheckCircle size={20} />
                    <span className="uppercase tracking-widest text-sm">CONFIRMAR VENTA</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastOrder && (
        <div className="absolute inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-none w-full max-w-sm shadow-2xl relative font-mono text-sm leading-tight text-slate-800">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black mb-1 uppercase tracking-widest border-b-2 border-black pb-2">{storeInfo.name}</h2>
              <p className="text-xs mt-1">{storeInfo.address}</p>
              <p className="text-xs">Rif: {storeInfo.rif}</p>
              <div className="my-4 border-b border-dashed border-black"></div>
              <p className="font-bold">ORDEN #{lastOrder.id.slice(0, 8)}</p>
              <p>{new Date().toLocaleString()}</p>
              {selectedOrderType && <p className="uppercase mt-1 font-bold">{selectedOrderType.name}</p>}
            </div>

            <div className="mb-4">
              {lastOrder.items.map((item: any, i: number) => (
                <div key={i} className="mb-2">
                  <div className="flex justify-between font-bold">
                    <span>{item.quantity} x {item.name}</span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.modifiers && item.modifiers.map((mod: any, j: number) => (
                    <div key={j} className="text-xs text-slate-500 pl-4 flex justify-between">
                      <span>+ {mod.name}</span>
                      <span>${mod.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-black pt-2 mb-4 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${lastOrder.subtotal?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA ({(taxRate * 100).toFixed(0)}%)</span>
                <span>${lastOrder.tax?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-lg mt-2 border-t border-black pt-2">
                <span>TOTAL</span>
                <span>${lastOrder.total?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Bs</span>
                <span>{((lastOrder.total || 0) * exchangeRate).toLocaleString()}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-black pt-2 mb-6">
              <p className="font-black text-xs mb-1 uppercase">Pagos:</p>
              {lastOrder.payments.map((p: any, i: number) => {
                const method = paymentMethods.find(m => m.id === p.payment_method_id);
                return (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="uppercase">{method?.name || 'Pago'}</span>
                    <span>${p.amount.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>

            <div className="text-center text-xs mt-8">
              <p>¡Gracias por su compra!</p>
              <p className="mt-1 font-bold">NO VÁLIDO COMO FACTURA FISCAL</p>
            </div>

            <button
              onClick={() => {
                setShowReceipt(false);
                setLastOrder(null);
                setSelectedTable(''); // Clear table
              }}
              className="mt-8 w-full bg-black text-white py-3 font-bold uppercase hover:bg-slate-800 transition-colors no-print"
            >
              Cerrar Ticket
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default POS;