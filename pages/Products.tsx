import React, { useState, useEffect } from 'react';
import { Package, Folder, Tag, Plus, Search, Edit2, Trash2, X, Save, AlertCircle, ChefHat, Layers, Link as LinkIcon, DollarSign, ArrowRight, Layout, CheckCircle, Smartphone, CreditCard, ClipboardList, Grid, Banknote, List } from 'lucide-react';
import { supabase } from '../supabase';
import { Product, CategoryConfig, ProductType, Modifier } from '../types';

const Products: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'articles' | 'categories' | 'modifiers'>('articles');

  // --- CATEGORIES STATE ---
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryConfig | null>(null);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // --- MODIFIERS STATE ---
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null);
  const [isLoadingModifiers, setIsLoadingModifiers] = useState(false);

  // --- CATALOG STATE ---
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [selectedTypeModal, setSelectedTypeModal] = useState<string>('simple');
  const [recipeIngredients, setRecipeIngredients] = useState<{ ingredient_id: string; quantity: number }[]>([]);
  const [tempIngredientId, setTempIngredientId] = useState<string>('');
  const [tempQuantity, setTempQuantity] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [productModifiers, setProductModifiers] = useState<string[]>([]);

  // --- INVENTORY STATE ---
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<'entrada' | 'salida' | 'ajuste'>('entrada');
  const [movementQuantity, setMovementQuantity] = useState<number>(0);
  const [movementReason, setMovementReason] = useState('');
  const [isProcessingMovement, setIsProcessingMovement] = useState(false);

  // --- LOGIC: FETCHING ---
  const fetchRecipe = async (productId: string) => {
    const { data, error } = await supabase
      .from('product_recipes')
      .select('ingredient_id, quantity')
      .eq('product_id', productId);
    if (error) console.error('Error fetching recipe:', error);
    else setRecipeIngredients(data || []);
  };

  const fetchProductModifiers = async (productId: string) => {
    const { data, error } = await supabase
      .from('product_modifiers')
      .select('modifier_id')
      .eq('product_id', productId);

    if (error) console.error('Error fetching product modifiers:', error);
    else setProductModifiers(data?.map((pm: any) => pm.modifier_id) || []);
  };

  const handleAddIngredient = () => {
    if (!tempIngredientId) return;
    if (tempQuantity <= 0) {
      alert("La cantidad debe ser mayor a 0.");
      return;
    }
    if (editingProduct && tempIngredientId === editingProduct.id) {
      alert("Un producto no puede ser ingrediente de sí mismo.");
      return;
    }
    if (recipeIngredients.some(ri => ri.ingredient_id === tempIngredientId)) {
      alert("Este ingrediente ya está en la receta.");
      return;
    }
    setRecipeIngredients(prev => [...prev, { ingredient_id: tempIngredientId, quantity: tempQuantity }]);
    setTempIngredientId('');
    setTempQuantity(1);
  };

  const handleRemoveIngredient = (id: string) => {
    setRecipeIngredients(prev => prev.filter(ri => ri.ingredient_id !== id));
  };

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      setCategories(data || []);
    }
    setIsLoadingCategories(false);
  };

  const fetchModifiers = async () => {
    setIsLoadingModifiers(true);
    const { data, error } = await supabase
      .from('modifiers')
      .select('*')
      .order('name', { ascending: true });

    if (error) console.error('Error fetching modifiers:', error);
    else setModifiers(data || []);
    setIsLoadingModifiers(false);
  };

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });
    if (error) console.error('Error fetching products:', error);
    else setProducts(data || []);
    setIsLoadingProducts(false);
  };

  useEffect(() => {
    fetchCategories();
    fetchModifiers();
    fetchProducts();
  }, []);

  // --- HANDLERS: MODIFIERS ---
  const handleSaveModifier = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const price = parseFloat(formData.get('price') as string) || 0;
    const cost = parseFloat(formData.get('cost') as string) || 0;
    const is_active = formData.get('is_active') === 'on';

    // Inventory fields
    const inventory_product_id = formData.get('inventory_product_id') as string || null;
    const quantity_consumed = parseFloat(formData.get('quantity_consumed') as string) || 0;

    const modifierData = {
      name,
      price,
      cost,
      is_active,
      inventory_product_id: inventory_product_id === '' ? null : inventory_product_id,
      quantity_consumed
    };

    if (editingModifier) {
      const { error } = await supabase.from('modifiers').update(modifierData).eq('id', editingModifier.id);
      if (error) console.error('Error updating modifier:', error);
    } else {
      const { error } = await supabase.from('modifiers').insert([modifierData]);
      if (error) console.error('Error creating modifier:', error);
    }
    fetchModifiers();
    setIsModifierModalOpen(false);
    setEditingModifier(null);
  };

  const toggleModifierActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('modifiers').update({ is_active: !currentStatus }).eq('id', id);
    if (error) console.error('Error toggling modifier:', error);
    else fetchModifiers();
  };

  const handleDeleteModifier = async (id: string) => {
    if (confirm('¿Eliminar este modificador?')) {
      const { error } = await supabase.from('modifiers').delete().eq('id', id);
      if (error) console.error('Error deleting modifier:', error);
      else fetchModifiers();
    }
  };

  // --- HANDLERS: CATEGORIES ---
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const is_visible = formData.get('is_visible') === 'on';
    const sort_order = parseInt(formData.get('sort_order') as string, 10);

    if (editingCategory) {
      const { error } = await supabase
        .from('categories')
        .update({ name, is_visible, sort_order })
        .eq('id', editingCategory.id);
      if (error) console.error('Error updating category:', error);
      else fetchCategories();
    } else {
      const { error } = await supabase
        .from('categories')
        .insert([{ name, is_visible, sort_order }]);
      if (error) console.error('Error creating category:', error);
      else fetchCategories();
    }
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const toggleCategoryVisibility = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('categories')
      .update({ is_visible: !currentStatus })
      .eq('id', id);
    if (error) console.error('Error toggling visibility:', error);
    else fetchCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('¿Eliminar esta categoría?')) {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) console.error('Error deleting category:', error);
      else fetchCategories();
    }
  };

  // --- HANDLERS: PRODUCTS ---
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const type = formData.get('type') as any;
    const category_id = formData.get('category_id') as string;
    const price = parseFloat(formData.get('price') as string);
    const base_cost = parseFloat(formData.get('base_cost') as string);
    const stock = parseFloat(formData.get('stock') as string) || 0;
    const min_stock = parseFloat(formData.get('min_stock') as string) || 0;
    const image_url = formData.get('image_url') as string;
    const is_producible = formData.get('is_producible') === 'on';

    const productData = { name, type, category_id, price, base_cost, stock, min_stock, image_url, is_producible };

    // Validation: Recipe required for compound items
    if ((type === 'compuesto' || type === 'produccion') && recipeIngredients.length === 0) {
      alert("Los artículos compuestos o de producción deben tener al menos un ingrediente en su receta.");
      return;
    }

    let savedProductId = editingProduct?.id;

    if (editingProduct) {
      const { error } = await supabase.from('products').update(productData).eq('id', editingProduct.id);
      if (error) console.error('Error updating product:', error);
    } else {
      const { data, error } = await supabase.from('products').insert([productData]).select().single();
      if (error) console.error('Error creating product:', error);
      else savedProductId = data.id;
    }

    // Handle Recipes
    if (savedProductId && (type === 'compuesto' || type === 'produccion')) {
      await supabase.from('product_recipes').delete().eq('product_id', savedProductId);
      if (recipeIngredients.length > 0) {
        const recipeData = recipeIngredients.map(ri => ({
          product_id: savedProductId,
          ingredient_id: ri.ingredient_id,
          quantity: ri.quantity
        }));
        const { error: recipeError } = await supabase.from('product_recipes').insert(recipeData);
        if (recipeError) console.error('Error saving recipe:', recipeError);
      }
    }

    // Handle Modifiers (Step 7.2)
    if (savedProductId) {
      // Delete existing
      await supabase.from('product_modifiers').delete().eq('product_id', savedProductId);

      // Insert new
      if (productModifiers.length > 0) {
        const modifiersData = productModifiers.map(modId => ({
          product_id: savedProductId,
          modifier_id: modId
        }));
        const { error: modError } = await supabase.from('product_modifiers').insert(modifiersData);
        if (modError) console.error('Error saving modifiers:', modError);
      }
    }

    const { data: logResult, error: logError } = await supabase.from('product_logs').insert([{
      product_id: savedProductId,
      action: editingProduct ? 'update' : 'create',
      changed_fields: productData,
      previous_values: editingProduct ? editingProduct : null
    }]);
    if (logError) console.error('Error logging product action:', logError);

    // Step 10.2: Base Audit Registry
    await supabase.from('audit_logs').insert([{
      entity: 'product',
      entity_id: savedProductId,
      action: editingProduct ? 'update' : 'create',
      user_id: 'unknown', // Ideally from context
      old_value: editingProduct,
      new_value: productData
    }]);

    fetchProducts();
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setRecipeIngredients([]);
    setProductModifiers([]);
  };

  const toggleProductActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id);
    if (error) {
      console.error('Error toggling product status:', error);
    } else {
      await supabase.from('product_logs').insert([{
        product_id: id,
        action: !currentStatus ? 'activate' : 'deactivate',
        changed_fields: { is_active: !currentStatus }
      }]);
      fetchProducts();
    }
  };

  const handleRegisterMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementProduct || movementQuantity === 0) return;
    setIsProcessingMovement(true);

    const { error } = await supabase.from('inventory_movements').insert([{
      product_id: movementProduct.id,
      type: movementType,
      quantity: Math.abs(movementQuantity),
      reason: movementReason
    }]);

    if (error) {
      console.error('Error registering movement:', error);
      alert('Error al registrar el movimiento.');
    } else {
      fetchProducts();
      setIsMovementModalOpen(false);
      setMovementProduct(null);
      setMovementQuantity(0);
      setMovementReason('');
    }
    setIsProcessingMovement(false);
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    // Paso 2.7: Check dependencies
    const { data: dependencies, error: depError } = await supabase
      .from('product_recipes')
      .select('product_id')
      .eq('ingredient_id', id);

    if (depError) {
      console.error('Error checking dependencies:', depError);
      return;
    }

    if (dependencies && dependencies.length > 0) {
      alert(`No se puede eliminar "${name}" porque se está usando como ingrediente en otros artículos. Prueba a desactivarlo en su lugar.`);
      return;
    }

    if (confirm(`¿Eliminar "${name}" del catálogo?`)) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        console.error('Error deleting product:', error);
      } else {
        // Log deletion (Product ID might be null in log due to FK SET NULL, but we log the action)
        await supabase.from('product_logs').insert([{ action: 'delete', previous_values: { name } }]);
        fetchProducts();
      }
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 h-full bg-[#F8FAFC] overflow-y-auto relative">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header section */}
        <div className="flex items-center justify-between bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3">
              <Layout size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">Catálogo</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Gestión de Productos y Categorías</p>
              </div>
            </div>
          </div>
          <div className="flex gap-4 p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveTab('articles')}
              className={`px-8 py-3 rounded-xl font-black text-xs uppercase transition-all flex items-center gap-2 ${activeTab === 'articles' ? 'bg-white text-slate-800 shadow-sm border border-slate-200 translate-y-[-2px]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Package size={16} /> Artículos
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-8 py-3 rounded-xl font-black text-xs uppercase transition-all flex items-center gap-2 ${activeTab === 'categories' ? 'bg-white text-slate-800 shadow-sm border border-slate-200 translate-y-[-2px]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Grid size={16} /> Categorías
            </button>
            <button
              onClick={() => setActiveTab('modifiers')}
              className={`px-8 py-3 rounded-xl font-black text-xs uppercase transition-all flex items-center gap-2 ${activeTab === 'modifiers' ? 'bg-white text-slate-800 shadow-sm border border-slate-200 translate-y-[-2px]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List size={16} /> Modificadores
            </button>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'articles' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar artículos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-100 font-bold text-slate-700 bg-white transition-all shadow-sm"
                />
              </div>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setSelectedTypeModal('simple');
                  setRecipeIngredients([]);
                  setProductModifiers([]);
                  setIsProductModalOpen(true);
                }}
                className="flex items-center gap-2 bg-slate-800 hover:bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-xs transition-all shadow-xl active:scale-95 shadow-slate-200"
              >
                <Plus size={20} /> Nuevo Artículo
              </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Artículo</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Precios</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingProducts ? (
                    <tr><td colSpan={6} className="px-8 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">Cargando Catálogo...</td></tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr><td colSpan={6} className="px-8 py-12 text-center text-slate-400">No se encontraron artículos.</td></tr>
                  ) : (
                    filteredProducts.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-4">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-2xl object-cover shadow-sm ring-1 ring-slate-100" />
                            ) : (
                              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 ring-1 ring-slate-100">
                                <Layout size={18} />
                              </div>
                            )}
                            <div>
                              <p className="font-black text-slate-700 uppercase tracking-tight text-sm">{p.name}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {p.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${p.type === 'simple' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            p.type === 'compuesto' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                              'bg-orange-50 text-orange-600 border-orange-100'
                            }`}>
                            {p.type === 'simple' ? '✨ ' + p.type : p.type}
                          </span>
                        </td>
                        <td className="px-8 py-4">
                          <span className="text-xs font-black text-slate-500 uppercase tracking-tight">
                            {categories.find(c => c.id === p.category_id)?.name || 'Sin Categoría'}
                          </span>
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className={`font-black text-sm ${p.stock <= p.min_stock ? 'text-red-500 font-black' : 'text-slate-800'}`}>
                                {p.stock}
                              </span>
                              <span className="text-slate-400 text-[10px] font-bold">/ {p.min_stock}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Efectivo / Mín</span>
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-800 text-base">${p.price.toFixed(2)}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Costo: ${p.base_cost.toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => toggleProductActive(p.id, p.is_active)} className={`p-2.5 rounded-xl transition-all ${p.is_active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-50'}`}>
                              {p.is_active ? <CheckCircle size={18} /> : <X size={18} />}
                            </button>
                            <button
                              onClick={() => {
                                setMovementProduct(p);
                                setMovementType('entrada');
                                setIsMovementModalOpen(true);
                              }}
                              className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                              title="Ajustar Stock"
                            >
                              <Plus size={18} />
                            </button>
                            <button onClick={() => {
                              setEditingProduct(p);
                              setSelectedTypeModal(p.type);
                              fetchRecipe(p.id);
                              fetchProductModifiers(p.id);
                              setIsProductModalOpen(true);
                            }} className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all underline decoration-transparent hover:decoration-slate-200"><Edit2 size={18} /></button>
                            <button onClick={() => handleDeleteProduct(p.id, p.name)} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 'categories' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Categorías del Menú</h2>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Organiza la visualización del POS</p>
              </div>
              <button
                onClick={() => { setEditingCategory(null); setIsCategoryModalOpen(true); }}
                className="flex items-center gap-2 bg-slate-800 hover:bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-xs transition-all shadow-xl active:scale-95 shadow-slate-200"
              >
                <Plus size={20} /> Nueva Categoría
              </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Orden</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingCategories ? (
                    <tr><td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">Cargando Categorías...</td></tr>
                  ) : categories.length === 0 ? (
                    <tr><td colSpan={4} className="px-8 py-12 text-center text-slate-400">No hay categorías configuradas.</td></tr>
                  ) : (
                    categories.map(cat => (
                      <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <span className="font-black text-slate-700 uppercase tracking-tight text-sm">{cat.name}</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-black text-slate-500">{cat.sort_order}</span>
                        </td>
                        <td className="px-8 py-5">
                          <button
                            onClick={() => toggleCategoryVisibility(cat.id, cat.is_visible)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${cat.is_visible ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
                          >
                            {cat.is_visible ? <CheckCircle size={14} /> : <X size={14} />}
                            {cat.is_visible ? 'Visible en POS' : 'Oculto'}
                          </button>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingCategory(cat); setIsCategoryModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all"><Edit2 size={18} /></button>
                            <button onClick={() => handleDeleteCategory(cat.id)} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODIFIERS TAB CONTENT */}
        {activeTab === 'modifiers' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Modificadores Globales</h2>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Extras y opciones para los productos</p>
              </div>
              <button
                onClick={() => { setEditingModifier(null); setIsModifierModalOpen(true); }}
                className="flex items-center gap-2 bg-slate-800 hover:bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-xs transition-all shadow-xl active:scale-95 shadow-slate-200"
              >
                <Plus size={20} /> Nuevo Modificador
              </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio Extra</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo Extra</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingModifiers ? (
                    <tr><td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">Cargando Modificadores...</td></tr>
                  ) : modifiers.length === 0 ? (
                    <tr><td colSpan={5} className="px-8 py-12 text-center text-slate-400">No hay modificadores configurados.</td></tr>
                  ) : (
                    modifiers.map(mod => (
                      <tr key={mod.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <span className="font-black text-slate-700 uppercase tracking-tight text-sm">{mod.name}</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="font-bold text-slate-800">+${mod.price.toFixed(2)}</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-xs text-slate-500 font-bold">+${mod.cost.toFixed(2)}</span>
                        </td>
                        <td className="px-8 py-5">
                          <button
                            onClick={() => toggleModifierActive(mod.id, mod.is_active)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${mod.is_active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
                          >
                            {mod.is_active ? <CheckCircle size={14} /> : <X size={14} />}
                            {mod.is_active ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingModifier(mod); setIsModifierModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all"><Edit2 size={18} /></button>
                            <button onClick={() => handleDeleteModifier(mod.id)} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* Modifier Modal */}
      {isModifierModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-white/20">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-2xl text-slate-800 uppercase tracking-tighter">
                {editingModifier ? 'Editar Modificador' : 'Nuevo Modificador'}
              </h3>
              <button onClick={() => setIsModifierModalOpen(false)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:rotate-90 transition-all shadow-sm border border-slate-100">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveModifier} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Nombre del Modificador</label>
                <input
                  required
                  name="name"
                  defaultValue={editingModifier?.name}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all text-lg tracking-tight"
                  placeholder="Ej: Extra Queso, Sin Hielo..."
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Precio Adicional ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="price"
                    defaultValue={editingModifier?.price || 0}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Costo Adicional ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="cost"
                    defaultValue={editingModifier?.cost || 0}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
                  />
                </div>
              </div>

              {/* Inventory Connection Section */}
              <div className="pt-6 border-t border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2">
                  <Layers size={14} /> Conexión con Inventario (Opcional)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Insumo a Descontar</label>
                    <select
                      name="inventory_product_id"
                      defaultValue={editingModifier?.inventory_product_id || ''}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">-- Sin conexión --</option>
                      {products
                        .filter(p => p.is_active)
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Cantidad (Kg/L/U)</label>
                    <input
                      type="number"
                      step="0.001"
                      name="quantity_consumed"
                      defaultValue={editingModifier?.quantity_consumed || 0}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4 pt-4">
                <label className="flex items-center gap-4 cursor-pointer group bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-sm transition-all">
                  <div className="relative">
                    <input type="checkbox" name="is_active" defaultChecked={editingModifier?.is_active ?? true} className="sr-only peer" />
                    <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </div>
                  <span className="text-sm font-black text-slate-700 uppercase tracking-tight">Activo Disponible</span>
                </label>
              </div>
              <div className="justify-end flex gap-4 pt-10 border-t border-slate-100">
                <button type="button" onClick={() => setIsModifierModalOpen(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 hover:bg-slate-50 rounded-2xl transition-all">
                  Cancelar
                </button>
                <button type="submit" className="px-12 py-4 bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95 shadow-slate-200">
                  {editingModifier ? 'Guardar Cambios' : 'Crear Modificador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-white/20">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-black text-2xl text-slate-800 uppercase tracking-tighter">
                  {editingProduct ? 'Editar Artículo' : 'Nuevo Artículo'}
                </h3>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Configuración Detallada del Producto</p>
              </div>
              <button onClick={() => {
                setIsProductModalOpen(false);
                setSelectedTypeModal('simple');
                setRecipeIngredients([]);
                setProductModifiers([]);
              }} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:rotate-90 transition-all shadow-sm border border-slate-100">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-8 space-y-6 overflow-y-auto max-h-[70vh] scrollbar-hide">
              {selectedTypeModal === 'simple' && (
                <div className="bg-blue-50 border border-blue-100 p-5 rounded-3xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-200">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <p className="text-blue-800 font-black text-xs uppercase tracking-tight mb-1">Artículo Simple (Regla 2.2)</p>
                    <p className="text-blue-600/80 text-[11px] font-bold leading-relaxed">Este artículo no permite ingredientes ni recetas. Su costo es directo y no depende de otros artículos. Ideal para bebidas, insumos base o ventas directas.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-8">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Nombre del Artículo</label>
                  <input
                    required
                    name="name"
                    defaultValue={editingProduct?.name}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all text-lg tracking-tight"
                    placeholder="Ej: Hamburguesa Especial"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Tipo de Artículo</label>
                  <div className="relative">
                    <select
                      name="type"
                      value={selectedTypeModal}
                      onChange={(e) => setSelectedTypeModal(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="simple">Simple (Insumo/Venta)</option>
                      <option value="compuesto">Compuesto (Combo/Receta)</option>
                      <option value="produccion">En Producción (Requiere Cocina)</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ArrowRight size={16} className="rotate-90" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Categoría</label>
                  <div className="relative">
                    <select
                      name="category_id"
                      defaultValue={editingProduct?.category_id}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none transition-all appearance-none cursor-pointer"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ArrowRight size={16} className="rotate-90" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Precio de Venta ($)</label>
                  <div className="relative">
                    <DollarSign size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      name="price"
                      defaultValue={editingProduct?.price || 0}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Costo Base ($)</label>
                  <div className="relative">
                    <Banknote size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      name="base_cost"
                      defaultValue={editingProduct?.base_cost || 0}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Stock Actual</label>
                  <div className="relative">
                    <Layers size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      name="stock"
                      defaultValue={editingProduct?.stock || 0}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Stock Mínimo (Alerta)</label>
                  <div className="relative">
                    <AlertCircle size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      name="min_stock"
                      defaultValue={editingProduct?.min_stock || 0}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
                      required
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">URL de Imagen (Opcional)</label>
                  <input
                    name="image_url"
                    defaultValue={editingProduct?.image_url}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
                    placeholder="https://ejemplo.com/imagen.jpg"
                  />
                </div>

                {selectedTypeModal === 'produccion' && (
                  <div className="col-span-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="flex items-center gap-4 cursor-pointer group bg-purple-50 p-6 rounded-3xl border border-purple-100 hover:bg-white hover:shadow-xl transition-all h-full">
                      <div className="relative">
                        <input type="checkbox" name="is_producible" defaultChecked={editingProduct?.is_producible ?? true} className="sr-only peer" />
                        <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                      </div>
                      <div>
                        <span className="text-sm font-black text-slate-700 uppercase tracking-tight block">Habilitar para Producción</span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block mt-1">Este artículo podrá fabricarse desde el módulo de producción</span>
                      </div>
                    </label>
                  </div>
                )}

                {/* Recipe Editor (Paso 2.3) */}
                {selectedTypeModal !== 'simple' && (
                  <div className="col-span-2 space-y-4 border-t border-slate-100 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-white">
                          <ClipboardList size={14} />
                        </div>
                        Estructura de Receta
                      </h4>
                      <span className="text-[10px] font-black text-slate-400 uppercase bg-white border border-slate-100 px-3 py-1.5 rounded-xl shadow-sm">
                        {recipeIngredients.length} Insumos Vinculados
                      </span>
                    </div>

                    <div className="flex gap-4 p-6 bg-slate-50 rounded-[24px] border border-slate-100 shadow-inner">
                      <div className="flex-1">
                        <select
                          value={tempIngredientId}
                          onChange={(e) => setTempIngredientId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none shadow-sm"
                        >
                          <option value="">Seleccionar ingrediente...</option>
                          {products.filter(p => p.type === 'simple' && p.id !== editingProduct?.id).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={tempQuantity}
                          onChange={(e) => setTempQuantity(parseFloat(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-black text-slate-800 outline-none shadow-sm text-center"
                          placeholder="Cant."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddIngredient}
                        className="bg-slate-800 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-200"
                      >
                        Agregar
                      </button>
                    </div>

                    {recipeIngredients.length > 0 && (
                      <div className="bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Ingrediente</th>
                              <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Cant.</th>
                              <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {recipeIngredients.map(ri => {
                              const ing = products.find(p => p.id === ri.ingredient_id);
                              return (
                                <tr key={ri.ingredient_id} className="hover:bg-slate-50/30 transition-colors group">
                                  <td className="px-6 py-3 font-bold text-slate-700 uppercase tracking-tight">{ing?.name || 'Cargando...'}</td>
                                  <td className="px-6 py-3 font-black text-slate-800 text-sm">{ri.quantity}</td>
                                  <td className="px-6 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveIngredient(ri.ingredient_id)}
                                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="justify-end flex gap-4 pt-10 border-t border-slate-100">
                <button type="button" onClick={() => setIsProductModalOpen(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 hover:bg-slate-50 rounded-2xl transition-all">
                  Cancelar
                </button>
                <button type="submit" className="px-12 py-4 bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95 shadow-slate-200">
                  {editingProduct ? 'Guardar Cambios' : 'Crear Artículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-white/20">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-2xl text-slate-800 uppercase tracking-tighter">
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:rotate-90 transition-all shadow-sm border border-slate-100">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Nombre de Categoría</label>
                <input
                  required
                  name="name"
                  defaultValue={editingCategory?.name}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all text-lg tracking-tight"
                  placeholder="Ej: Postres, Ensaladas..."
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Orden (Posición POS)</label>
                <input
                  type="number"
                  name="sort_order"
                  defaultValue={editingCategory?.sort_order || 0}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
                />
              </div>
              <div className="space-y-4 pt-4">
                <label className="flex items-center gap-4 cursor-pointer group bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-sm transition-all">
                  <div className="relative">
                    <input type="checkbox" name="is_visible" defaultChecked={editingCategory?.is_visible ?? true} className="sr-only peer" />
                    <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </div>
                  <span className="text-sm font-black text-slate-700 uppercase tracking-tight">Visible en el POS</span>
                </label>
              </div>
              <div className="justify-end flex gap-4 pt-10 border-t border-slate-100">
                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 hover:bg-slate-50 rounded-2xl transition-all">
                  Cancelar
                </button>
                <button type="submit" className="px-12 py-4 bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95 shadow-slate-200">
                  {editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inventory Movement Modal */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-white/20">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-black text-2xl text-slate-800 uppercase tracking-tighter">Ajustar Inventario</h3>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">{movementProduct?.name}</p>
              </div>
              <button
                onClick={() => setIsMovementModalOpen(false)}
                className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:rotate-90 transition-all shadow-sm border border-slate-100"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleRegisterMovement} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Tipo de Movimiento</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['entrada', 'salida', 'ajuste'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMovementType(t)}
                      className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border ${movementType === t
                        ? 'bg-slate-800 text-white border-slate-800 shadow-lg'
                        : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                        }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Cantidad</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={movementQuantity}
                  onChange={(e) => setMovementQuantity(parseFloat(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all text-lg tracking-tight"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Motivo / Referencia</label>
                <textarea
                  name="reason"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all text-sm min-h-[100px]"
                  placeholder="Ej: Compra de insumos, Merma, Corrección..."
                />
              </div>
              <div className="justify-end flex gap-4 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 hover:bg-slate-50 rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessingMovement || movementQuantity === 0}
                  className="px-12 py-4 bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95 shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessingMovement ? 'Procesando...' : 'Confirmar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;