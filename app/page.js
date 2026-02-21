'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend
} from 'recharts';
import {
  LayoutDashboard, Users, Building2, Handshake, TrendingUp, Settings,
  Shield, LogOut, Plus, Search, Phone, Mail,
  Calendar, FileText, Brain, Sparkles, Target, DollarSign, Activity,
  AlertTriangle, CheckCircle2, Clock, Edit, Trash2,
  Copy, RefreshCw, ArrowUpRight, ArrowDownRight, ChevronLeft,
  BarChart3, Eye, MessageSquare, User, Zap, GripVertical
} from 'lucide-react';

// ─── API Helper ───
const api = {
  token: null,
  async fetch(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`/api${url}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  get(url) { return this.fetch(url); },
  post(url, body) { return this.fetch(url, { method: 'POST', body: JSON.stringify(body) }); },
  put(url, body) { return this.fetch(url, { method: 'PUT', body: JSON.stringify(body) }); },
  del(url) { return this.fetch(url, { method: 'DELETE' }); }
};

const STAGES = ['PROSPECTING', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
const STAGE_COLORS = {
  PROSPECTING: 'bg-blue-100 text-blue-800',
  QUALIFIED: 'bg-purple-100 text-purple-800',
  PROPOSAL: 'bg-amber-100 text-amber-800',
  NEGOTIATION: 'bg-orange-100 text-orange-800',
  WON: 'bg-emerald-100 text-emerald-800',
  LOST: 'bg-red-100 text-red-800'
};
const STAGE_DOT = {
  PROSPECTING: 'bg-blue-500',
  QUALIFIED: 'bg-purple-500',
  PROPOSAL: 'bg-amber-500',
  NEGOTIATION: 'bg-orange-500',
  WON: 'bg-emerald-500',
  LOST: 'bg-red-500'
};
const CHART_COLORS = ['#4f46e5', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];
const fmt = (n) => '$' + (n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

// ─── Main App ───
export default function App() {
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sub-view state
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [selectedDealId, setSelectedDealId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('fcrmToken');
    if (token) {
      api.token = token;
      api.get('/auth/me').then(data => {
        setUser(data.user);
        setView('dashboard');
      }).catch(() => {
        localStorage.removeItem('fcrmToken');
        api.token = null;
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (email, password) => {
    try {
      const data = await api.post('/auth/login', { email, password });
      api.token = data.token;
      localStorage.setItem('fcrmToken', data.token);
      setUser(data.user);
      setView('dashboard');
      toast.success('Welcome back, ' + data.user.name);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleRegister = async (name, email, password, role) => {
    try {
      const data = await api.post('/auth/register', { name, email, password, role });
      api.token = data.token;
      localStorage.setItem('fcrmToken', data.token);
      setUser(data.user);
      setView('dashboard');
      toast.success('Account created! Welcome, ' + data.user.name);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('fcrmToken');
    api.token = null;
    setUser(null);
    setView('login');
  };

  const navigate = (v, id) => {
    setView(v);
    if (v === 'accountDetail') setSelectedAccountId(id);
    if (v === 'dealDetail') setSelectedDealId(id);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
        <p className="text-muted-foreground">Loading ForecastCRM...</p>
      </div>
    </div>
  );

  if (!user) {
    return view === 'register'
      ? <RegisterView onRegister={handleRegister} onSwitch={() => setView('login')} />
      : <LoginView onLogin={handleLogin} onSwitch={() => setView('register')} />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-60'} bg-slate-900 text-white flex flex-col transition-all duration-200 flex-shrink-0`}>
        <div className="p-4 flex items-center gap-2 border-b border-slate-700">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && <span className="font-bold text-lg">ForecastCRM</span>}
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'accounts', icon: Building2, label: 'Accounts' },
            { id: 'deals', icon: Handshake, label: 'Deals' },
            { id: 'forecast', icon: TrendingUp, label: 'Forecast' },
            { id: 'settings', icon: Settings, label: 'Settings' },
            ...(user.role === 'ADMIN' || user.role === 'MANAGER'
              ? [{ id: 'adminUsers', icon: Shield, label: 'Users' }] : [])
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                view === item.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 text-xs font-bold">
              {user.name?.charAt(0)}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-slate-400">{user.role}</p>
              </div>
            )}
            <button onClick={handleLogout} className="text-slate-400 hover:text-white p-1">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          {view === 'dashboard' && <DashboardView user={user} navigate={navigate} />}
          {view === 'accounts' && <AccountsView user={user} navigate={navigate} />}
          {view === 'accountDetail' && <AccountDetailView accountId={selectedAccountId} navigate={navigate} />}
          {view === 'deals' && <DealsView user={user} navigate={navigate} />}
          {view === 'dealDetail' && <DealDetailView dealId={selectedDealId} navigate={navigate} user={user} />}
          {view === 'forecast' && <ForecastView user={user} />}
          {view === 'settings' && <SettingsView user={user} />}
          {view === 'adminUsers' && <AdminUsersView user={user} />}
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════
// LOGIN VIEW
// ═══════════════════════════════════════
function LoginView({ onLogin, onSwitch }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const data = await api.post('/seed', {});
      toast.success('Demo data loaded! You can now log in.');
    } catch (e) { toast.error(e.message); }
    setSeeding(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(email, password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/30">
            <Zap className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">ForecastCRM</h1>
          <p className="text-slate-400 mt-2">AI-Powered Revenue Intelligence</p>
        </div>
        <Card className="shadow-2xl border-0">
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@forecastcrm.com" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="password123" className="mt-1" />
              </div>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
            <Separator className="my-4" />
            <div className="space-y-2">
              <Button variant="outline" className="w-full" onClick={handleSeed} disabled={seeding}>
                {seeding ? 'Loading demo data...' : 'Load Demo Data'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Demo accounts: admin/manager/rep@forecastcrm.com (pw: password123)
              </p>
              <Button variant="ghost" className="w-full text-sm" onClick={onSwitch}>
                Create new account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// REGISTER VIEW
// ═══════════════════════════════════════
function RegisterView({ onRegister, onSwitch }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('REP');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onRegister(name, email, password, role);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/30">
            <Zap className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">ForecastCRM</h1>
          <p className="text-slate-400 mt-2">Create your account</p>
        </div>
        <Card className="shadow-2xl border-0">
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="mt-1" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="mt-1" />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" className="mt-1" />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REP">Sales Rep</SelectItem>
                    <SelectItem value="MANAGER">Sales Manager</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                {loading ? 'Creating...' : 'Create Account'}
              </Button>
            </form>
            <Button variant="ghost" className="w-full text-sm mt-3" onClick={onSwitch}>
              Already have an account? Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════
function DashboardView({ user, navigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats').then(setStats).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!stats) return <p>Failed to load dashboard</p>;

  const kpis = [
    { label: 'Total Pipeline', value: fmt(stats.totalPipeline), icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Won Revenue', value: fmt(stats.wonRevenue), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Win Rate', value: stats.winRate + '%', icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Active Deals', value: stats.activeDealsCount, icon: Handshake, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user.name}. Here is your pipeline overview.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                </div>
                <div className={`${kpi.bg} ${kpi.color} p-3 rounded-xl`}>
                  <kpi.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by Stage */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.pipelineByStage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v / 1000) + 'k'} />
                <ReTooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Revenue */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Won Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v / 1000) + 'k'} />
                <ReTooltip formatter={(v) => fmt(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Activities</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('deals')}>View All</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(stats.recentActivities || []).slice(0, 6).map(act => (
              <div key={act.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={`mt-0.5 p-1.5 rounded-lg ${
                  act.type === 'CALL' ? 'bg-blue-50 text-blue-600' :
                  act.type === 'EMAIL' ? 'bg-purple-50 text-purple-600' :
                  act.type === 'MEETING' ? 'bg-amber-50 text-amber-600' :
                  'bg-slate-50 text-slate-600'
                }`}>
                  {act.type === 'CALL' ? <Phone className="w-4 h-4" /> :
                   act.type === 'EMAIL' ? <Mail className="w-4 h-4" /> :
                   act.type === 'MEETING' ? <Calendar className="w-4 h-4" /> :
                   <FileText className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{act.content}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {act.type} · {new Date(act.occurredAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            {(!stats.recentActivities || stats.recentActivities.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activities</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════
// ACCOUNTS VIEW
// ═══════════════════════════════════════
function AccountsView({ user, navigate }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', domain: '', industry: '', country: '' });

  const loadAccounts = useCallback(() => {
    api.get('/accounts').then(d => setAccounts(d.accounts)).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const createAccount = async () => {
    if (!form.name) return toast.error('Account name required');
    try {
      await api.post('/accounts', form);
      toast.success('Account created');
      setShowCreate(false);
      setForm({ name: '', domain: '', industry: '', country: '' });
      loadAccounts();
    } catch (e) { toast.error(e.message); }
  };

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.industry?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">{accounts.length} total accounts</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" /> New Account
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts..." className="pl-10" />
        </div>
      </div>

      {loading ? <LoadingSkeleton /> : (
        <div className="grid gap-3">
          {filtered.map(acc => (
            <Card key={acc.id} className="border shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => navigate('accountDetail', acc.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                      {acc.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{acc.name}</p>
                      <p className="text-sm text-muted-foreground">{acc.industry} · {acc.country}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{acc.dealCount || 0} deals</p>
                    <p className="text-sm text-muted-foreground">{fmt(acc.totalValue)} pipeline</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No accounts found</p>}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Company Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div><Label>Domain</Label><Input value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="company.com" className="mt-1" /></div>
            <div><Label>Industry</Label><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} className="mt-1" /></div>
            <div><Label>Country</Label><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="mt-1" /></div>
            <Button onClick={createAccount} className="w-full bg-indigo-600 hover:bg-indigo-700">Create Account</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════
// ACCOUNT DETAIL VIEW
// ═══════════════════════════════════════
function AccountDetailView({ accountId, navigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', title: '' });

  useEffect(() => {
    api.get(`/accounts/${accountId}`).then(setData).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [accountId]);

  const addContact = async () => {
    if (!contactForm.name) return toast.error('Name required');
    try {
      await api.post('/contacts', { ...contactForm, accountId });
      toast.success('Contact added');
      setShowAddContact(false);
      setContactForm({ name: '', email: '', phone: '', title: '' });
      api.get(`/accounts/${accountId}`).then(setData);
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <LoadingSkeleton />;
  if (!data) return <p>Account not found</p>;
  const { account, contacts, deals } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('accounts')}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <p className="text-muted-foreground">{account.industry} · {account.country} · {account.domain}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contacts */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Contacts</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowAddContact(true)}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contacts.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium">{c.name?.charAt(0)}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.title} · {c.email}</p>
                  </div>
                </div>
              ))}
              {contacts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No contacts yet</p>}
            </div>
          </CardContent>
        </Card>

        {/* Deals */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deals.map(d => (
                <div key={d.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => navigate('dealDetail', d.id)}>
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <Badge variant="secondary" className={STAGE_COLORS[d.stage]}>{d.stage}</Badge>
                  </div>
                  <p className="text-sm font-medium">{fmt(d.amount)}</p>
                </div>
              ))}
              {deals.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No deals yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} className="mt-1" /></div>
            <div><Label>Email</Label><Input value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} className="mt-1" /></div>
            <div><Label>Phone</Label><Input value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} className="mt-1" /></div>
            <div><Label>Title</Label><Input value={contactForm.title} onChange={e => setContactForm({ ...contactForm, title: e.target.value })} className="mt-1" /></div>
            <Button onClick={addContact} className="w-full bg-indigo-600 hover:bg-indigo-700">Add Contact</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════
// DEALS VIEW (Pipeline Kanban)
// ═══════════════════════════════════════
function DealsView({ user, navigate }) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban');
  const [showCreate, setShowCreate] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ name: '', accountId: '', amount: '', stage: 'PROSPECTING', expectedCloseDate: '' });
  const [draggedDeal, setDraggedDeal] = useState(null);

  const loadDeals = useCallback(() => {
    api.get('/deals').then(d => setDeals(d.deals)).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDeals();
    api.get('/accounts').then(d => setAccounts(d.accounts)).catch(() => {});
  }, [loadDeals]);

  const createDeal = async () => {
    if (!form.name || !form.accountId) return toast.error('Deal name and account required');
    try {
      await api.post('/deals', form);
      toast.success('Deal created');
      setShowCreate(false);
      setForm({ name: '', accountId: '', amount: '', stage: 'PROSPECTING', expectedCloseDate: '' });
      loadDeals();
    } catch (e) { toast.error(e.message); }
  };

  const moveDeal = async (dealId, newStage) => {
    try {
      await api.put(`/deals/${dealId}/stage`, { stage: newStage });
      toast.success(`Deal moved to ${newStage}`);
      loadDeals();
    } catch (e) { toast.error(e.message); }
  };

  const handleDragStart = (e, deal) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, stage) => {
    e.preventDefault();
    if (draggedDeal && draggedDeal.stage !== stage) {
      moveDeal(draggedDeal.id, stage);
    }
    setDraggedDeal(null);
  };

  const handleDragOver = (e) => { e.preventDefault(); };

  const pipelineStages = STAGES.filter(s => s !== 'WON' && s !== 'LOST');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deal Pipeline</h1>
          <p className="text-muted-foreground">{deals.filter(d => !['WON', 'LOST'].includes(d.stage)).length} active deals</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-1">
            <button onClick={() => setViewMode('kanban')} className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm font-medium' : 'text-muted-foreground'}`}>
              <GripVertical className="w-4 h-4 inline mr-1" />Kanban
            </button>
            <button onClick={() => setViewMode('list')} className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm font-medium' : 'text-muted-foreground'}`}>
              <BarChart3 className="w-4 h-4 inline mr-1" />List
            </button>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> New Deal
          </Button>
        </div>
      </div>

      {loading ? <LoadingSkeleton /> : viewMode === 'kanban' ? (
        /* Kanban View */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipelineStages.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage);
            const stageTotal = stageDeals.reduce((s, d) => s + (d.amount || 0), 0);
            return (
              <div
                key={stage}
                className="min-w-[280px] flex-1 bg-muted/30 rounded-xl p-3"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${STAGE_DOT[stage]}`} />
                    <span className="text-sm font-semibold">{stage}</span>
                    <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{fmt(stageTotal)}</span>
                </div>
                <div className="space-y-2">
                  {stageDeals.map(deal => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal)}
                      className="bg-white rounded-lg p-3 shadow-sm border hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
                      onClick={() => navigate('dealDetail', deal.id)}
                    >
                      <p className="text-sm font-medium mb-1">{deal.name}</p>
                      <p className="text-xs text-muted-foreground mb-2">{deal.accountName}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-indigo-600">{fmt(deal.amount)}</span>
                        {deal.closeProbability !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(deal.closeProbability * 100)}%
                          </Badge>
                        )}
                      </div>
                      {deal.expectedCloseDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(deal.expectedCloseDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Deal</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Account</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Stage</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Amount</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Close Date</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map(deal => (
                    <tr key={deal.id} className="border-b hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => navigate('dealDetail', deal.id)}>
                      <td className="p-3 text-sm font-medium">{deal.name}</td>
                      <td className="p-3 text-sm text-muted-foreground">{deal.accountName}</td>
                      <td className="p-3"><Badge className={STAGE_COLORS[deal.stage]}>{deal.stage}</Badge></td>
                      <td className="p-3 text-sm font-medium text-right">{fmt(deal.amount)}</td>
                      <td className="p-3 text-sm text-muted-foreground">{deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : '-'}</td>
                      <td className="p-3 text-sm text-muted-foreground">{deal.ownerName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Won/Lost section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Won Deals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {deals.filter(d => d.stage === 'WON').slice(0, 5).map(d => (
                <div key={d.id} className="flex justify-between items-center p-2 rounded hover:bg-muted/50 cursor-pointer" onClick={() => navigate('dealDetail', d.id)}>
                  <span className="text-sm">{d.name}</span>
                  <span className="text-sm font-medium text-emerald-600">{fmt(d.amount)}</span>
                </div>
              ))}
              {deals.filter(d => d.stage === 'WON').length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No won deals</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Lost Deals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {deals.filter(d => d.stage === 'LOST').slice(0, 5).map(d => (
                <div key={d.id} className="flex justify-between items-center p-2 rounded hover:bg-muted/50 cursor-pointer" onClick={() => navigate('dealDetail', d.id)}>
                  <span className="text-sm">{d.name}</span>
                  <span className="text-sm font-medium text-red-500">{fmt(d.amount)}</span>
                </div>
              ))}
              {deals.filter(d => d.stage === 'LOST').length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No lost deals</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Deal Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Deal Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div>
              <Label>Account *</Label>
              <Select value={form.accountId} onValueChange={v => setForm({ ...form, accountId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount ($)</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="mt-1" /></div>
            <div>
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.filter(s => s !== 'WON' && s !== 'LOST').map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Expected Close Date</Label><Input type="date" value={form.expectedCloseDate} onChange={e => setForm({ ...form, expectedCloseDate: e.target.value })} className="mt-1" /></div>
            <Button onClick={createDeal} className="w-full bg-indigo-600 hover:bg-indigo-700">Create Deal</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════
// DEAL DETAIL VIEW
// ═══════════════════════════════════════
function DealDetailView({ dealId, navigate, user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [actForm, setActForm] = useState({ type: 'NOTE', content: '' });

  const loadDeal = useCallback(() => {
    api.get(`/deals/${dealId}`).then(setData).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [dealId]);

  useEffect(() => { loadDeal(); }, [loadDeal]);

  const addActivity = async () => {
    if (!actForm.content) return toast.error('Content required');
    try {
      await api.post(`/deals/${dealId}/activities`, actForm);
      toast.success('Activity added');
      setShowAddActivity(false);
      setActForm({ type: 'NOTE', content: '' });
      loadDeal();
    } catch (e) { toast.error(e.message); }
  };

  const generateInsights = async () => {
    setInsightLoading(true);
    try {
      await api.post(`/deals/${dealId}/insights`, {});
      toast.success('AI insights generated');
      loadDeal();
    } catch (e) { toast.error(e.message); }
    setInsightLoading(false);
  };

  const moveStage = async (newStage) => {
    try {
      await api.put(`/deals/${dealId}/stage`, { stage: newStage });
      toast.success(`Deal moved to ${newStage}`);
      loadDeal();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <LoadingSkeleton />;
  if (!data) return <p>Deal not found</p>;
  const { deal, activities, insight } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('deals')}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{deal.name}</h1>
            <p className="text-muted-foreground">{deal.accountName} · {deal.ownerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${STAGE_COLORS[deal.stage]} text-sm px-3 py-1`}>{deal.stage}</Badge>
          <span className="text-xl font-bold text-indigo-600">{fmt(deal.amount)}</span>
        </div>
      </div>

      {/* Stage Pipeline */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-1">
            {STAGES.map((stage, i) => (
              <button
                key={stage}
                onClick={() => moveStage(stage)}
                className={`flex-1 py-2 px-2 text-xs font-medium rounded-md transition-all ${
                  deal.stage === stage
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : STAGES.indexOf(deal.stage) > i
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {stage}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activities">Activities ({activities.length})</TabsTrigger>
          <TabsTrigger value="insights">
            <Brain className="w-4 h-4 mr-1" /> AI Insights
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Amount</span><span className="text-sm font-medium">{fmt(deal.amount)}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Stage</span><Badge className={STAGE_COLORS[deal.stage]}>{deal.stage}</Badge></div>
                <Separator />
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Close Date</span><span className="text-sm">{deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'Not set'}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Created</span><span className="text-sm">{new Date(deal.createdAt).toLocaleDateString()}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Close Probability</span><span className="text-sm font-medium">{deal.closeProbability ? Math.round(deal.closeProbability * 100) + '%' : 'Not calculated'}</span></div>
              </CardContent>
            </Card>

            {/* Quick Insight Card */}
            <Card className="border shadow-sm md:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" /> AI Summary
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={generateInsights} disabled={insightLoading}>
                    {insightLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4 mr-1" />}
                    {insightLoading ? 'Generating...' : 'Generate'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {insight ? (
                  <div className="space-y-4">
                    <p className="text-sm leading-relaxed">{insight.summary}</p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Probability:</span>
                        <span className="text-sm font-bold">{Math.round(insight.closeProbability * 100)}%</span>
                      </div>
                      <Badge className={
                        insight.riskLevel === 'LOW' ? 'bg-emerald-100 text-emerald-800' :
                        insight.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }>
                        {insight.riskLevel} RISK
                      </Badge>
                    </div>
                    <Progress value={insight.closeProbability * 100} className="h-2" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Click &quot;Generate&quot; to get AI-powered insights for this deal.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowAddActivity(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" /> Add Activity
            </Button>
          </div>
          <div className="space-y-3">
            {activities.map((act, i) => (
              <Card key={act.id} className="border shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-2 rounded-lg ${
                      act.type === 'CALL' ? 'bg-blue-50 text-blue-600' :
                      act.type === 'EMAIL' ? 'bg-purple-50 text-purple-600' :
                      act.type === 'MEETING' ? 'bg-amber-50 text-amber-600' :
                      'bg-slate-50 text-slate-600'
                    }`}>
                      {act.type === 'CALL' ? <Phone className="w-4 h-4" /> :
                       act.type === 'EMAIL' ? <Mail className="w-4 h-4" /> :
                       act.type === 'MEETING' ? <Calendar className="w-4 h-4" /> :
                       <FileText className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">{act.type}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(act.occurredAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm mt-2 leading-relaxed">{act.content}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {activities.length === 0 && (
              <Card className="border"><CardContent className="p-8 text-center text-muted-foreground">
                No activities logged yet. Add your first activity!
              </CardContent></Card>
            )}
          </div>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="mt-4">
          <div className="mb-4">
            <Button onClick={generateInsights} disabled={insightLoading} className="bg-indigo-600 hover:bg-indigo-700">
              {insightLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
              {insightLoading ? 'Generating Insights...' : 'Generate AI Insights'}
            </Button>
            <span className="text-xs text-muted-foreground ml-3">(Mock AI Mode)</span>
          </div>

          {insight ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Close Probability */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4" /> Close Probability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <div className="text-5xl font-bold text-indigo-600">{Math.round(insight.closeProbability * 100)}%</div>
                    <Badge className={`mt-2 ${
                      insight.riskLevel === 'LOW' ? 'bg-emerald-100 text-emerald-800' :
                      insight.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {insight.riskLevel} RISK
                    </Badge>
                    <Progress value={insight.closeProbability * 100} className="mt-4 h-3" />
                  </div>
                </CardContent>
              </Card>

              {/* Risk Factors */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Risk Factors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(insight.riskFactors || []).map((rf, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{rf}</span>
                      </div>
                    ))}
                    {(!insight.riskFactors || insight.riskFactors.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">No significant risk factors identified</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Next Best Actions */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-600" /> Recommended Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(insight.nextBestActions || []).map((action, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-indigo-50 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{action}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Email Draft */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Mail className="w-4 h-4 text-purple-600" /> Suggested Email
                    </CardTitle>
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard.writeText(`Subject: ${insight.emailDraft?.subject}\n\n${insight.emailDraft?.body}`);
                      toast.success('Email copied to clipboard');
                    }}>
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {insight.emailDraft && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Subject: {insight.emailDraft.subject}</p>
                      <Separator />
                      <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">{insight.emailDraft.body}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary */}
              <Card className="border shadow-sm lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Deal Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{insight.summary}</p>
                  <p className="text-xs text-muted-foreground mt-3">Model: {insight.modelVersion} · Generated: {new Date(insight.createdAt).toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border">
              <CardContent className="p-12 text-center">
                <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No AI Insights Generated Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Click the button above to generate AI-powered insights including close probability, risk factors, recommended actions, and a suggested follow-up email.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Activity Dialog */}
      <Dialog open={showAddActivity} onOpenChange={setShowAddActivity}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={actForm.type} onValueChange={v => setActForm({ ...actForm, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALL">Call</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="MEETING">Meeting</SelectItem>
                  <SelectItem value="NOTE">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Content</Label>
              <Textarea value={actForm.content} onChange={e => setActForm({ ...actForm, content: e.target.value })} rows={4} placeholder="Describe the activity..." className="mt-1" />
            </div>
            <Button onClick={addActivity} className="w-full bg-indigo-600 hover:bg-indigo-700">Save Activity</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════
// FORECAST VIEW
// ═══════════════════════════════════════
function ForecastView({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/forecast').then(setData).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!data) return <p>Failed to load forecast</p>;

  const { historical, forecast, summary } = data;

  // Combine for chart
  const chartData = [
    ...historical.map(h => ({ month: h.month, actual: h.actual })),
    ...forecast.map(f => ({ month: f.month, predicted: f.predicted, optimistic: f.optimistic, pessimistic: f.pessimistic }))
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Revenue Forecast</h1>
        <p className="text-muted-foreground">
          {user.role === 'REP' ? 'Your personal' : user.role === 'MANAGER' ? 'Team' : 'Organization'} revenue forecast
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Active Pipeline</p>
            <p className="text-2xl font-bold mt-1">{fmt(summary.totalPipeline)}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Weighted Pipeline</p>
            <p className="text-2xl font-bold mt-1 text-indigo-600">{fmt(summary.weightedPipeline)}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">6-Month Forecast</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{fmt(summary.totalForecast)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue: Historical vs Forecast</CardTitle>
          <CardDescription>Past 6 months actual revenue and next 6 months predicted</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v / 1000) + 'k'} />
              <ReTooltip formatter={(v) => fmt(v)} />
              <Legend />
              <Area type="monotone" dataKey="actual" stroke="#10b981" fill="#10b98120" strokeWidth={2} name="Actual Revenue" />
              <Area type="monotone" dataKey="optimistic" stroke="#4f46e520" fill="#4f46e508" strokeWidth={1} strokeDasharray="3 3" name="Optimistic" />
              <Area type="monotone" dataKey="predicted" stroke="#4f46e5" fill="#4f46e520" strokeWidth={2} name="Predicted Revenue" />
              <Area type="monotone" dataKey="pessimistic" stroke="#ef444420" fill="#ef444408" strokeWidth={1} strokeDasharray="3 3" name="Pessimistic" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Forecast Details */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly Forecast Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Month</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Predicted</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Optimistic</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Pessimistic</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map(f => (
                  <tr key={f.month} className="border-b">
                    <td className="p-3 text-sm font-medium">{f.month}</td>
                    <td className="p-3 text-sm text-right font-medium text-indigo-600">{fmt(f.predicted)}</td>
                    <td className="p-3 text-sm text-right text-emerald-600">{fmt(f.optimistic)}</td>
                    <td className="p-3 text-sm text-right text-red-500">{fmt(f.pessimistic)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress value={f.confidence} className="h-2 w-16" />
                        <span className="text-sm text-muted-foreground">{f.confidence}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Historical */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Historical Monthly Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={historical}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v / 1000) + 'k'} />
              <ReTooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="actual" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════
// SETTINGS VIEW
// ═══════════════════════════════════════
function SettingsView({ user }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);

  useEffect(() => {
    api.get('/settings').then(d => setSettings(d.settings)).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  const retrain = async () => {
    setRetraining(true);
    try {
      const data = await api.post('/ml/retrain', {});
      toast.success(data.message);
      api.get('/settings').then(d => setSettings(d.settings));
    } catch (e) { toast.error(e.message); }
    setRetraining(false);
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">AI model settings and configuration</p>
      </div>

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Brain className="w-4 h-4" /> AI Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium">AI Mode</p>
              <p className="text-xs text-muted-foreground">Currently using mock AI responses</p>
            </div>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">Mock Mode</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium">Model Version</p>
              <p className="text-xs text-muted-foreground">{settings?.modelVersion || '1.0.0'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium">Last Trained</p>
              <p className="text-xs text-muted-foreground">{settings?.lastTrainedAt ? new Date(settings.lastTrainedAt).toLocaleString() : 'Never'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Model Training</CardTitle>
          <CardDescription>Retrain the close probability model using historical WON/LOST deals</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={retrain} disabled={retraining || user.role === 'REP'} className="bg-indigo-600 hover:bg-indigo-700">
            {retraining ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {retraining ? 'Retraining...' : 'Retrain Model'}
          </Button>
          {user.role === 'REP' && <p className="text-xs text-muted-foreground mt-2">Only managers and admins can retrain the model</p>}
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> Your Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between"><span className="text-sm text-muted-foreground">Name</span><span className="text-sm font-medium">{user.name}</span></div>
          <Separator />
          <div className="flex justify-between"><span className="text-sm text-muted-foreground">Email</span><span className="text-sm">{user.email}</span></div>
          <Separator />
          <div className="flex justify-between"><span className="text-sm text-muted-foreground">Role</span><Badge variant="secondary">{user.role}</Badge></div>
          <Separator />
          <div className="flex justify-between"><span className="text-sm text-muted-foreground">Team</span><span className="text-sm">{user.teamId || 'None'}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════
// ADMIN USERS VIEW
// ═══════════════════════════════════════
function AdminUsersView({ user }) {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', role: '', teamId: '' });

  useEffect(() => {
    api.get('/admin/users').then(d => {
      setUsers(d.users);
      setTeams(d.teams || []);
    }).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  const startEdit = (u) => {
    setEditUser(u);
    setEditForm({ name: u.name, role: u.role, teamId: u.teamId || '' });
  };

  const saveUser = async () => {
    try {
      await api.put(`/admin/users/${editUser.id}`, editForm);
      toast.success('User updated');
      setEditUser(null);
      api.get('/admin/users').then(d => setUsers(d.users));
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-muted-foreground">{users.length} users in the system</p>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">User</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Email</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Role</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Team</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">{u.name?.charAt(0)}</div>
                      <span className="text-sm font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{u.email}</td>
                  <td className="p-3"><Badge variant="secondary" className={
                    u.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
                    u.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-100 text-slate-800'
                  }>{u.role}</Badge></td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {teams.find(t => t.id === u.teamId)?.name || '-'}
                  </td>
                  <td className="p-3 text-right">
                    {user.role === 'ADMIN' && (
                      <Button size="sm" variant="outline" onClick={() => startEdit(u)}>
                        <Edit className="w-3 h-3 mr-1" /> Edit
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="mt-1" /></div>
            <div>
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="REP">Sales Rep</SelectItem>
                  <SelectItem value="MANAGER">Sales Manager</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Team</Label>
              <Select value={editForm.teamId} onValueChange={v => setEditForm({ ...editForm, teamId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Team</SelectItem>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveUser} className="w-full bg-indigo-600 hover:bg-indigo-700">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 bg-muted rounded w-48 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
      </div>
      <div className="h-64 bg-muted rounded-lg animate-pulse" />
    </div>
  );
}
