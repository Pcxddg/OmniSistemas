import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';

interface AppSetting {
   key: string;
   value: any;
}

const Settings: React.FC = () => {
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);

   // Settings State
   const [exchangeRate, setExchangeRate] = useState<number>(36.5);
   const [taxRate, setTaxRate] = useState<number>(16);
   const [storeName, setStoreName] = useState<string>('Mi Restaurante');
   const [storeAddress, setStoreAddress] = useState<string>('Dirección Local');
   const [storeRif, setStoreRif] = useState<string>('J-00000000-0');

   useEffect(() => {
      fetchSettings();
   }, []);

   const fetchSettings = async () => {
      setLoading(true);
      try {
         const { data, error } = await supabase
            .from('app_settings')
            .select('*');

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
            const { error } = await supabase
               .from('app_settings')
               .upsert(update, { onConflict: 'key' });

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

   if (loading) return <div className="p-8">Cargando configuración...</div>;

   return (
      <div className="p-6 max-w-4xl mx-auto">
         <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-black text-slate-800">Configuración del Sistema</h1>
            <button
               onClick={fetchSettings}
               className="p-2 hover:bg-slate-100 rounded-full transition-colors"
               title="Recargar configuración"
            >
               <RefreshCw size={20} />
            </button>
         </div>

         <div className="space-y-6">
            {/* Financial Settings */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
               <h2 className="text-xl font-bold mb-4 text-slate-700 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center font-black">$</span>
                  Finanzas
               </h2>
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
               <h2 className="text-xl font-bold mb-4 text-slate-700 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-black">@</span>
                  Información del Local
               </h2>
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

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
               <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
               <p className="text-sm text-amber-800">
                  <strong>Nota:</strong> Los cambios en la tasa de cambio e impuestos afectarán inmediatamente a las nuevas ventas procesadas en el POS.
               </p>
            </div>
         </div>
      </div>
   );
};

export default Settings;