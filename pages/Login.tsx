import React, { useState } from 'react';
import { supabase } from '../supabase';
import { LogIn, Mail, Lock, AlertCircle, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isRegistering, setIsRegistering] = useState(false);
    const navigate = useNavigate();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        if (isRegistering) {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) {
                setError(error.message);
            } else {
                setMessage('¡Cuenta creada! Revisa tu correo o intenta iniciar sesión.');
                setIsRegistering(false);
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) {
                setError(error.message);
            } else {
                navigate('/');
            }
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Abstract Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-800/20 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-900/40 rounded-full blur-[120px]"></div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-900 border border-slate-700 rounded-2xl mb-6 shadow-2xl">
                        <ShoppingCart className="text-slate-400" size={40} />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tighter mb-2 italic">OmniPOS</h1>
                    <p className="text-slate-500 font-medium tracking-wide border-t border-slate-800 pt-2 inline-block">SISTEMA DE GESTIÓN CORPORATIVO</p>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-md p-8 rounded-2xl border border-white/5 shadow-2xl">
                    <form onSubmit={handleAuth} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-xl flex items-start gap-3 animate-shake">
                                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}

                        {message && (
                            <div className="bg-green-500/20 border border-green-500/50 text-green-200 p-4 rounded-xl flex items-start gap-3">
                                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                                <p className="text-sm font-medium">{message}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-widest ml-1">Email</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-brand-500 transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all placeholder:text-slate-600"
                                    placeholder="usuario@ejemplo.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-widest ml-1">Contraseña</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-brand-500 transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all placeholder:text-slate-600"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-lg shadow-lg transition-all active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    <span className="tracking-widest uppercase text-sm">{isRegistering ? 'Crear Cuenta' : 'Acceder al Sistema'}</span>
                                </>
                            )}
                        </button>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => setIsRegistering(!isRegistering)}
                                className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
                            >
                                {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                            </button>
                        </div>
                    </form>
                </div>

                <p className="text-center mt-8 text-slate-500 text-sm">
                    &copy; 2026 OmniPOS. Todos los derechos reservados.
                </p>
            </div>
        </div>
    );
};

export default Login;
