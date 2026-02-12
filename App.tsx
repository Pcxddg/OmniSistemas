import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import CashRegister from './pages/CashRegister';
import Products from './pages/Products';
import Suppliers from './pages/Suppliers';
import HistoryPage from './pages/History';
import SettingsPage from './pages/Settings';
import Kitchen from './pages/Kitchen';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './AuthContext';
import { OrganizationProvider, useOrganization } from './OrganizationContext';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, Settings as SettingsIcon, History, Menu, DollarSign, Archive, ChefHat, LogOut, Building2 } from 'lucide-react';

const SidebarItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
  <Link
    to={to}
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 mb-1 ${active
      ? 'bg-slate-800 text-white border-r-4 border-slate-400'
      : 'text-slate-500 hover:bg-slate-800/20 hover:text-slate-200'
      }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </Link>
);

const Layout = ({ children }: { children?: React.ReactNode }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { currentOrg } = useOrganization();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 text-white transform transition-transform duration-500 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-white/5 shadow-2xl shadow-black/50`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded bg-brand-500 flex items-center justify-center font-bold text-white">OP</div>
            <span className="text-xl font-bold tracking-tight">OmniPOS</span>
          </div>

          <nav className="h-[calc(100vh-180px)] overflow-y-auto scrollbar-hide">
            <p className="text-xs font-bold text-slate-500 uppercase mb-4 px-4">Menu Principal</p>
            <SidebarItem to="/" icon={LayoutDashboard} label="Resultados" active={location.pathname === '/'} />
            <SidebarItem to="/pos" icon={ShoppingCart} label="Ventas POS" active={location.pathname === '/pos'} />
            <SidebarItem to="/kitchen" icon={ChefHat} label="Cocina (KDS)" active={location.pathname === '/kitchen'} />
            <SidebarItem to="/products" icon={Archive} label="Catálogo" active={location.pathname === '/products'} />
            <SidebarItem to="/inventory" icon={Package} label="Inv. & Producción" active={location.pathname === '/inventory'} />
            <SidebarItem to="/cash" icon={DollarSign} label="Cuadre de Caja" active={location.pathname === '/cash'} />

            <p className="text-xs font-bold text-slate-500 uppercase mt-8 mb-4 px-4">Administración</p>
            <SidebarItem to="/suppliers" icon={Users} label="Proveedores" active={location.pathname === '/suppliers'} />
            <SidebarItem to="/history" icon={History} label="Historial" active={location.pathname === '/history'} />
            <SidebarItem to="/settings" icon={SettingsIcon} label="Configuración" active={location.pathname === '/settings'} />
          </nav>
        </div>

        {/* User Profile Snippet & Logout */}
        <div className="absolute bottom-0 left-0 w-full bg-slate-900/50 border-t border-white/5">
          <div className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold uppercase ring-1 ring-white/10">
              {user?.email?.substring(0, 2) || 'AD'}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium text-white truncate">{user?.email || 'Admin User'}</p>
              <p className="text-xs text-slate-400 truncate">{currentOrg?.name || 'Sin organización'}</p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-6 py-3 text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors border-t border-slate-700"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div className="font-bold text-brand-900">OmniPOS</div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600">
            <Menu />
          </button>
        </div>

        {/* Backdrop for mobile */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {children}
      </main>
    </div>
  );
};

const OnboardingScreen = () => {
  const { createOrganization } = useOrganization();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    await createOrganization(name.trim());
    setCreating(false);
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">¡Bienvenido a OmniPOS!</h1>
          <p className="text-slate-500 mt-2">Crea tu negocio para comenzar</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Negocio</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Mi Restaurante"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creando...' : 'Crear mi Negocio'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading: authLoading } = useAuth();
  const { currentOrg, loading: orgLoading } = useOrganization();

  if (authLoading || orgLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // User is logged in but has no organization — show onboarding
  if (!currentOrg) {
    return <OnboardingScreen />;
  }

  return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
            <Route path="/kitchen" element={<ProtectedRoute><Kitchen /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/cash" element={<ProtectedRoute><CashRegister /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </OrganizationProvider>
    </AuthProvider>
  );
};

export default App;