import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, CreditCard, Smartphone, CheckCircle, AlertTriangle, Save, Calculator, XCircle, Search, Banknote as BanknoteIcon, Users, Filter, ShieldCheck, LockKeyhole } from 'lucide-react';
import { PaymentMethod } from '../types';

import { supabase } from '../supabase';
import { useOrganization } from '../OrganizationContext';

const getMethodIcon = (type: string) => {
   switch (type) {
      case 'efectivo': return DollarSign;
      case 'digital': return Smartphone;
      default: return CreditCard;
   }
};

const getMethodColor = (type: string) => {
   switch (type) {
      case 'efectivo': return 'bg-green-100 text-green-700';
      case 'digital': return 'bg-purple-100 text-purple-700';
      default: return 'bg-blue-100 text-blue-700';
   }
};

const CashRegister: React.FC = () => {
   const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [declaredAmounts, setDeclaredAmounts] = useState<Record<string, string>>({});
   const [justifications, setJustifications] = useState<Record<string, string>>({});
   const [isSubmitting, setIsSubmitting] = useState(false);

   // Real system amounts from order_payments
   const [rawPayments, setRawPayments] = useState<any[]>([]);
   const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('Global');

   // Cash Register State
   const [currentRegister, setCurrentRegister] = useState<any | null>(null); // Use proper type if available
   const { organizationId } = useOrganization();
   const [openingAmountInput, setOpeningAmountInput] = useState('');

   useEffect(() => {
      fetchData();
   }, []);

   // STEP 8.3: Calculate theoretical system totals by method category
   // STEP 8.4: Recalculate component amounts based on employee filter
   // STEP 8.3: Calculate theoretical system totals by method category
   // Refactored to use RPC data instead of client-side calculation
   const [systemAmounts, setSystemAmounts] = useState<Record<string, number>>({});

   // Dynamically list employees who have sales in this session
   const availableEmployees = useMemo(() => {
      const emps = new Set(rawPayments.map(p => p.orders.user_id).filter(Boolean));
      return Array.from(emps) as string[];
   }, [rawPayments]);

   // Step 8.7: Global totals for audit (ignores employee filter)
   // Step 8.7: Global totals for audit (ignores employee filter)
   const globalSystemAmounts = useMemo(() => {
      // Since we now use RPC which returns global totals for the register, 
      // systemAmounts IS the global system amounts. 
      return systemAmounts;
   }, [systemAmounts]);

   const summary = useMemo(() => {
      let cash = 0;
      let digital = 0;
      let other = 0;
      let totalDeclared = 0;

      paymentMethods.forEach(m => {
         const amount = systemAmounts[m.id] || 0;
         if (m.type === 'efectivo') cash += amount;
         else if (m.type === 'digital') digital += amount;
         else other += amount;

         totalDeclared += parseFloat(declaredAmounts[m.id] || '0');
      });

      const totalTheoretical = cash + digital + other;
      return {
         cash,
         digital,
         other,
         total: totalTheoretical,
         totalDeclared,
         totalDiff: totalDeclared - totalTheoretical
      };
   }, [systemAmounts, paymentMethods, declaredAmounts]);

   const fetchData = async () => {
      setIsLoading(true);

      // 1. Fetch MOST RECENT register session (Step 8.8 support)
      const { data: registers } = await supabase
         .from('cash_registers')
         .select('*')
         .not('opening_time', 'is', null) // Filter out reset/wiped registers
         .order('opening_time', { ascending: false })
         .limit(1);

      if (registers && registers.length > 0) {
         const reg = registers[0];
         setCurrentRegister(reg);

         // 2. Fetch payment methods
         const { data: methods } = await supabase
            .from('payment_methods')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

         setPaymentMethods(methods || []);

         // 3a. Fetch raw payments for employee breakdown
         const { data: paymentsData } = await supabase
            .from('order_payments')
            .select('*, orders!inner(user_id, status, cash_register_id)')
            .eq('orders.cash_register_id', reg.id)
            .neq('orders.status', 'cancelled');
         if (paymentsData) setRawPayments(paymentsData);

         // 3. Fetch totals via RPC for ACCURACY
         const { data: totalsData, error: rpcError } = await supabase
            .rpc('get_cash_register_totals', { p_register_id: reg.id });

         if (rpcError) {
            console.error('RPC Error:', rpcError);
         } else if (totalsData) {
            console.log('RPC Totals:', totalsData);
            const totalsMap: Record<string, number> = {};
            totalsData.forEach((t: any) => {
               totalsMap[t.payment_method_id] = Number(t.total_amount);
            });
            setSystemAmounts(totalsMap);
         }

         // 4. If register is closed, load saved declared amounts from cash_register_counts
         if (reg.status === 'closed') {
            const { data: countsData } = await supabase
               .from('cash_register_counts')
               .select('payment_method_id, amount_declared')
               .eq('cash_register_id', reg.id);

            if (countsData && countsData.length > 0) {
               const savedAmounts: Record<string, string> = {};
               countsData.forEach((c: any) => {
                  savedAmounts[c.payment_method_id] = String(c.amount_declared);
               });
               setDeclaredAmounts(savedAmounts);
            }
         }
      } else {
         setCurrentRegister(null);
         setSystemAmounts({});
      }

      setIsLoading(false);
   };

   const handleDeclaredChange = (methodId: string, value: string) => {
      setDeclaredAmounts(prev => ({ ...prev, [methodId]: value }));
   };

   const handleJustificationChange = (methodId: string, value: string) => {
      setJustifications(prev => ({ ...prev, [methodId]: value }));
   };

   const calculateDiff = (system: number, methodId: string) => {
      const declared = parseFloat(declaredAmounts[methodId] || '0');
      return declared - system;
   };

   // STEP 8.7: Strict Validation Logic
   const validationErrors = useMemo(() => {
      const errors = [];
      const uncounted = paymentMethods.filter(m => declaredAmounts[m.id] === undefined || declaredAmounts[m.id] === '');

      if (uncounted.length > 0) {
         errors.push(`Falta contar: ${uncounted.map(m => m.name).join(', ')}`);
      }

      paymentMethods.forEach(method => {
         const systemAmount = globalSystemAmounts[method.id] || 0;
         const declared = parseFloat(declaredAmounts[method.id] || '0');
         const diff = declared - systemAmount;
         const isBalanced = Math.abs(diff) < 0.01;
         const reason = (justifications[method.id] || '').trim();

         if (!isBalanced && reason.length < 10) {
            errors.push(`Justificación insuficiente para ${method.name} (min. 10 caracteres)`);
         }
      });

      if (selectedEmployeeFilter !== 'Global') {
         errors.push("Debe cambiar a 'Total Global' para validar el arqueo final");
      }

      return errors;
   }, [paymentMethods, declaredAmounts, justifications, globalSystemAmounts, selectedEmployeeFilter]);

   const canCloseDay = paymentMethods.length > 0 && validationErrors.length === 0;

   // STEP 8.8: Immutability Logic
   const isLocked = currentRegister?.status === 'closed';

   const handleOpenRegister = async () => {
      if (!openingAmountInput) return;
      setIsSubmitting(true);

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('cash_registers').insert({
         opening_amount: parseFloat(openingAmountInput),
         status: 'open',
         opening_time: new Date().toISOString(),
         opened_by: user?.id,
         organization_id: organizationId
      });

      if (error) {
         alert('Error al abrir caja: ' + error.message);
      } else {
         // Step 10.6: Audit Log for Open Register
         await supabase.from('audit_logs').insert([{
            entity: 'cash_register',
            entity_id: 'new_session',
            action: 'open_register',
            user_id: user?.id || 'unknown',
            new_value: { opening_amount: parseFloat(openingAmountInput) },
            organization_id: organizationId
         }]);

         fetchData(); // Reload to see open state
      }
      setIsSubmitting(false);
   };

   const handleCloseDay = async () => {
      if (!canCloseDay || !currentRegister) return;
      setIsSubmitting(true);

      // Prepare notes summarizing differences
      const notes = paymentMethods.map(m => {
         const diff = calculateDiff(systemAmounts[m.id] || 0, m.id);
         if (Math.abs(diff) > 0.01) {
            return `${m.name}: ${diff > 0 ? '+' : ''}${diff.toFixed(2)} (${justifications[m.id]})`;
         }
         return null;
      }).filter(Boolean).join(' | ');

      // Calculate total closing amount (sum of declared cash + system digital)
      // Usually "Closing Amount" strictly refers to Cash in Drawer, but typically we store detailed reconciliation.
      // For this simple schema, let's sum all declared amounts.
      const totalDeclared = Object.values(declaredAmounts).reduce((acc, val) => acc + parseFloat(val || '0'), 0);

      // 1. Save individual breakdown (Step 8.5 - ConteoCaja Entity)
      const countsData = paymentMethods.map(m => ({
         cash_register_id: currentRegister.id,
         payment_method_id: m.id,
         amount_declared: parseFloat(declaredAmounts[m.id] || '0')
      }));

      const { error: countError } = await supabase
         .from('cash_register_counts')
         .insert(countsData);

      if (countError) {
         console.error("Error saving breakdown:", countError);
         // We continue but warn? Or strictly stop?
         // Let's warn but proceed with updating the main record to avoid getting stuck if breakdown fails.
      }

      const { data: { user } } = await supabase.auth.getUser();

      // 2. Update Main Register Record
      const { error } = await supabase
         .from('cash_registers')
         .update({
            closing_time: new Date().toISOString(),
            status: 'closed',
            closing_amount: totalDeclared,
            notes: notes,
            closed_by: user?.id
         })
         .eq('id', currentRegister.id);

      if (error) {
         alert('Error al cerrar: ' + error.message);
      } else {
         // Step 10.6: Audit Log for Close Register
         await supabase.from('audit_logs').insert([{
            entity: 'cash_register',
            entity_id: currentRegister.id,
            action: 'close_register',
            user_id: user?.id || 'unknown',
            new_value: {
               closing_amount: totalDeclared,
               notes: notes,
               system_totals: summary
            },
            organization_id: organizationId
         }]);

         alert("Caja cerrada correctamente.");
         setDeclaredAmounts({});
         setJustifications({});
         fetchData(); // Reset to closed state
      }
      setIsSubmitting(false);
   };


   if (isLoading) return <div className="p-12 text-center">Cargando...</div>;

   // OPEN REGISTER VIEW
   if (!currentRegister || (isLocked && openingAmountInput === 'reset')) {
      return (
         <div className="p-6 h-full flex items-center justify-center bg-slate-50">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-100 text-center">
               <div className="w-20 h-20 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <BanknoteIcon size={40} />
               </div>
               <h2 className="text-2xl font-bold text-slate-900 mb-2">Apertura de Caja</h2>
               <p className="text-slate-500 mb-8">Ingrese el monto de efectivo inicial en caja para comenzar el turno.</p>

               <div className="text-left mb-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Monto Inicial (Base)</label>
                  <div className="relative">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                     <input
                        type="number"
                        autoFocus
                        value={openingAmountInput}
                        onChange={e => setOpeningAmountInput(e.target.value)}
                        className="w-full pl-8 pr-4 py-4 rounded-xl border border-slate-200 text-2xl font-bold text-slate-800 focus:ring-4 focus:ring-brand-100 focus:border-brand-500 outline-none transition-all"
                        placeholder="0.00"
                     />
                  </div>
               </div>

               <button
                  onClick={handleOpenRegister}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2"
                  disabled={isSubmitting || !openingAmountInput}
               >
                  {isSubmitting ? 'Abriendo...' : 'Abrir Caja y Comenzar'}
               </button>
            </div>
         </div>
      );
   }

   // CLOSE REGISTER VIEW (Existing Logic)
   return (
      <div className="p-6 h-full overflow-y-auto bg-slate-50/50">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div className="text-left">
               <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold text-slate-900">Arqueo de Caja</h1>
                  {isLocked && (
                     <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-lg border border-slate-200 text-[10px] font-black uppercase tracking-widest">
                        <LockKeyhole size={14} /> Histórico Inmutable
                     </div>
                  )}
               </div>
               <p className="text-slate-500">Cierre de turno y conciliación de montos</p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-4">
               <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center gap-3">
                  <div className="flex items-center gap-2 text-slate-400">
                     <Users size={18} />
                     <span className="text-[10px] font-black uppercase">Responsabilidad</span>
                  </div>
                  <select
                     value={selectedEmployeeFilter}
                     onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                     className="bg-transparent border-none outline-none text-sm font-bold text-slate-800 cursor-pointer"
                  >
                     <option value="Global">Total Global</option>
                     {availableEmployees.map(emp => (
                        <option key={emp} value={emp}>{emp}</option>
                     ))}
                  </select>
               </div>

               <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center gap-2">
                  <Calculator size={18} className="text-brand-600" />
                  <span className="text-sm font-bold text-slate-600">
                     Abierto: <span className="text-slate-900">{new Date(currentRegister.opening_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
               </div>
               <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-700">
                     Base: <span className="text-emerald-900">${Number(currentRegister.opening_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </span>
               </div>
            </div>
         </div>

         {isLocked && (
            <div className="bg-slate-900 text-white p-6 rounded-2xl mb-8 flex items-center justify-between shadow-xl relative overflow-hidden text-left">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                  <ShieldCheck size={120} />
               </div>
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                     <ShieldCheck size={32} className="text-emerald-400" />
                  </div>
                  <div>
                     <h2 className="text-xl font-black uppercase tracking-tighter">Sello de Auditoría Activo</h2>
                     <p className="text-slate-400 text-sm max-w-md">Esta sesión ha sido finalizada y bloqueada. Los montos son históricos y ya no pueden ser modificados para garantizar la integridad de los reportes.</p>
                  </div>
               </div>
               <button
                  onClick={() => {
                     setCurrentRegister(null);
                     setOpeningAmountInput('reset');
                  }}
                  className="bg-brand-500 hover:bg-brand-400 text-white font-black py-3 px-8 rounded-xl transition-all active:scale-95 shadow-lg shadow-brand-500/20 z-10"
               >
                  NUEVA APERTURA
               </button>
            </div>
         )}

         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-brand-500"></div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
               <Calculator size={14} className="text-brand-500" />
               Resumen Teórico del Sistema
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-left">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Ventas</span>
                  <span className="block text-2xl font-black text-slate-900">
                     ${summary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
               </div>
               <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-left">
                  <span className="block text-xs font-bold text-emerald-600 mb-1 flex items-center gap-1">
                     <DollarSign size={14} /> EFECTIVO
                  </span>
                  <span className="block text-xl font-black text-emerald-800">
                     ${summary.cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
               </div>
               <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 text-left">
                  <span className="block text-xs font-bold text-purple-600 mb-1 flex items-center gap-1">
                     <Smartphone size={14} /> DIGITAL
                  </span>
                  <span className="block text-xl font-black text-purple-800">
                     ${summary.digital.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
               </div>
               <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-left">
                  <span className="block text-xs font-bold text-blue-600 mb-1 flex items-center gap-1">
                     <CreditCard size={14} /> OTROS
                  </span>
                  <span className="block text-xl font-black text-blue-800">
                     ${summary.other.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
               </div>
               <div className={`p-4 rounded-xl border-2 text-left ${Math.abs(summary.totalDiff) < 0.01
                  ? 'bg-slate-50 border-slate-200'
                  : summary.totalDiff < 0
                     ? 'bg-red-50 border-red-200 animate-pulse'
                     : 'bg-blue-50 border-blue-200'
                  }`}>
                  <span className="block text-[10px] font-black text-slate-500 uppercase mb-1">Diferencia Total</span>
                  <span className={`block text-2xl font-black ${Math.abs(summary.totalDiff) < 0.01
                     ? 'text-slate-400'
                     : summary.totalDiff < 0
                        ? 'text-red-700'
                        : 'text-blue-700'
                     }`}>
                     {summary.totalDiff > 0 ? '+' : ''}${summary.totalDiff.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-32">
            {paymentMethods.map((method) => {
               const systemAmount = systemAmounts[method.id] || 0;
               const diff = calculateDiff(systemAmount, method.id);
               const isBalanced = Math.abs(diff) < 0.01;
               const isNegative = diff < -0.01;
               const declaredValue = declaredAmounts[method.id] || '';
               const Icon = getMethodIcon(method.type);
               const colorClass = getMethodColor(method.type);
               const currency = method.type === 'efectivo' ? '$' : 'Bs';

               return (
                  <div key={method.id} className={`bg-white p-5 rounded-lg shadow-sm border transition-all text-left ${isBalanced ? 'border-slate-200' : isNegative ? 'border-red-300 ring-1 ring-red-100' : 'border-blue-300 ring-1 ring-blue-100'}`}>
                     <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                           <div className={`p-2 rounded ${colorClass}`}>
                              <Icon size={24} />
                           </div>
                           <div>
                              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{method.name}</span>
                              <span className="text-lg font-black text-slate-800">Sistema: {currency} {systemAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                           </div>
                        </div>
                        {!isBalanced && (
                           <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black uppercase border ${isNegative ? 'text-red-600 bg-red-50 border-red-100' : 'text-blue-600 bg-blue-50 border-blue-100'}`}>
                              {isNegative ? <XCircle size={14} /> : <AlertTriangle size={14} />}
                              {isNegative ? 'Faltante' : 'Sobrante'}
                           </div>
                        )}
                        {isBalanced && declaredValue !== '' && (
                           <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-[10px] font-black uppercase border border-emerald-100">
                              <CheckCircle size={14} /> Cuadrado
                           </div>
                        )}
                     </div>

                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Monto Declarado (Conteo Físico)</label>
                        <div className="relative">
                           <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black">{currency}</span>
                           <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              disabled={isLocked}
                              className={`w-full pl-8 pr-4 py-3 rounded-lg border-2 outline-none font-mono text-lg font-black transition-colors bg-white ${declaredValue === '' ? 'border-slate-200 text-slate-700' :
                                 isBalanced ? 'border-emerald-400 text-emerald-700' :
                                    'border-slate-300 text-slate-800 focus:border-brand-500'
                                 } ${isLocked ? 'grayscale opacity-50 cursor-not-allowed' : ''}`}
                              value={declaredValue}
                              onChange={(e) => handleDeclaredChange(method.id, e.target.value)}
                           />
                        </div>
                        <div className={`mt-3 flex justify-between items-center pt-3 border-t ${isBalanced ? 'border-slate-200' : 'border-slate-300'}`}>
                           <span className="text-[10px] text-slate-500 font-black uppercase">Diferencia</span>
                           <span className={`font-mono font-black text-xl ${isBalanced ? 'text-slate-400' : isNegative ? 'text-red-600' : 'text-blue-600'}`}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                           </span>
                        </div>
                     </div>

                     {!isBalanced && declaredValue !== '' && (
                        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                           <label className="flex items-center gap-2 text-[10px] font-black text-orange-600 uppercase mb-1.5">
                              <AlertTriangle size={12} className="text-orange-500" />
                              Justificación Obligatoria
                           </label>
                           <textarea
                              className={`w-full border border-orange-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none bg-white text-slate-700 min-h-[60px] ${isLocked ? 'grayscale opacity-50 cursor-not-allowed' : ''}`}
                              placeholder="Explique el motivo de la diferencia..."
                              disabled={isLocked}
                              value={justifications[method.id] || ''}
                              onChange={(e) => handleJustificationChange(method.id, e.target.value)}
                           />
                        </div>
                     )}
                  </div>
               );
            })}
         </div>

         <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-white border-t border-slate-200 p-6 shadow-2xl z-20 flex flex-col md:flex-row justify-between items-center px-12 gap-4">
            <div className="flex flex-col max-w-xl text-left">
               <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Estado de Auditoría</span>
               {isLocked ? (
                  <div className="flex items-center gap-2 text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                     <ShieldCheck size={18} />
                     <span>SESIÓN FINALIZADA Y BLOQUEADA</span>
                  </div>
               ) : canCloseDay ? (
                  <div className="flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                     <CheckCircle size={18} />
                     <span>LISTO PARA CIERRE DEFINITIVO</span>
                  </div>
               ) : (
                  <div className="flex flex-wrap gap-2">
                     {validationErrors.map((err, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-[10px] border border-red-100 italic">
                           <AlertTriangle size={12} /> {err}
                        </div>
                     ))}
                  </div>
               )}
            </div>
            {!isLocked && (
               <button
                  disabled={!canCloseDay || isSubmitting}
                  onClick={handleCloseDay}
                  className={`flex items-center gap-3 px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all ${canCloseDay
                     ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20 active:scale-95'
                     : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
                     }`}
               >
                  {isSubmitting ? 'Cerrando...' : <><Save size={20} /> Cerrar Día y Bloquear</>}
               </button>
            )}
         </div>


      </div>
   );
};

export default CashRegister;