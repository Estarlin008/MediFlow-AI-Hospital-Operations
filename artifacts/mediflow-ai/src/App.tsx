import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import {
  Activity,
  BedDouble,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  HeartPulse,
  Home,
  Search,
  Stethoscope,
  UserRoundPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { MvpStoreProvider, useMvpStore } from '@/mvp/state';

const DashboardPage = lazy(() => import('@/mvp/dashboard-page').then((module) => ({ default: module.DashboardPage })));
const RegistrationPage = lazy(() => import('@/mvp/registration-page').then((module) => ({ default: module.RegistrationPage })));
const QueuePage = lazy(() => import('@/mvp/queue-page').then((module) => ({ default: module.QueuePage })));
const ReevaluationPage = lazy(() => import('@/mvp/reevaluation-page').then((module) => ({ default: module.ReevaluationPage })));
const ResourcesPage = lazy(() => import('@/mvp/resources-page').then((module) => ({ default: module.ResourcesPage })));

const navItems = [
  { href: '/', label: 'Panel de control', icon: Home },
  { href: '/registro', label: 'Registro de pacientes', icon: UserRoundPlus },
  { href: '/cola', label: 'Cola de atención', icon: ClipboardList },
  { href: '/reevaluacion', label: 'Reevaluación', icon: Stethoscope },
  { href: '/recursos', label: 'Gestión de recursos', icon: BedDouble },
];

function MvpApplication() {
  const [location, setLocation] = useLocation();
  const { state, demoMode } = useMvpStore();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = location.split('?')[0];

  useEffect(() => {
    setSearchOpen(false);
    setQuery('');
  }, [location]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return state.patients
      .filter((patient) =>
        patient.name.toLowerCase().includes(needle) ||
        patient.record.toLowerCase().includes(needle) ||
        patient.id.toLowerCase().includes(needle) ||
        (patient.identityNumber ?? '').toLowerCase().includes(needle),
      )
      .slice(0, 5);
  }, [query, state.patients]);

  function searchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const patient = matches[0];
    if (!patient) return;
    const hasActiveEpisode = state.episodes.some(
      (episode) => episode.patientId === patient.id && episode.status !== 'Atendido',
    );
    setLocation(hasActiveEpisode ? `/cola?patient=${encodeURIComponent(patient.id)}` : '/registro');
    setSearchOpen(false);
  }

  const pageName = navItems.find((item) => item.href === pathname)?.label ?? 'MediFlow';
  const dataStatus = demoMode
    ? { label: 'MODO DEMO', shortLabel: 'DEMO', detail: 'Datos ficticios, solo sesión', tone: 'demo' }
    : state.loading
      ? { label: 'CARGANDO API', shortLabel: 'API…', detail: 'Consultando la integración', tone: 'loading' }
      : state.loadErrors.length
        ? { label: 'API CON ERRORES', shortLabel: 'API', detail: 'Algunos datos no cargaron', tone: 'error' }
        : { label: 'API CONSULTADA', shortLabel: 'n8n', detail: 'Lecturas disponibles', tone: 'live' };
  const currentDate = new Intl.DateTimeFormat('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div className="mf-app-shell" lang="es-BO">
      <a className="mf-skip-link" href="#main-content">Saltar al contenido principal</a>
      <aside className="mf-app-sidebar" aria-label="Navegación principal">
        <Link href="/" className="mf-brand">
          <span className="mf-brand-mark"><HeartPulse size={20} strokeWidth={2.25} /></span>
          <span className="min-w-0">
            <span className="block text-[16px] font-extrabold tracking-[-0.04em]">MediFlow</span>
            <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-white/55">Emergencias</span>
          </span>
        </Link>
        <div className="mf-side-caption">OPERACIÓN</div>
        <nav className="mf-side-nav">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname === href || (href === '/cola' && pathname === '/emergencias') || (href === '/registro' && pathname === '/pacientes');
            return (
              <Link key={href} href={href} className={`mf-side-link ${active ? 'mf-side-link-active' : ''}`} aria-label={label} title={label} aria-current={active ? 'page' : undefined}>
                <Icon size={17} strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
                <span>{label}</span>
                {href === '/cola' && state.episodes.filter((episode) => episode.status !== 'Atendido').length > 0 && (
                  <span className="mf-nav-count">{state.episodes.filter((episode) => episode.status !== 'Atendido').length}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mf-sidebar-spacer" />
        <div className="mf-side-source">
          <span className="mf-source-led" />
          <span>
            <strong>{demoMode ? 'Entorno de demostración' : 'Integración n8n'}</strong>
            <small>{demoMode ? 'No conectado a IA externa' : 'Estado según respuestas de API'}</small>
          </span>
        </div>
        <div className="mf-sidebar-foot">
          <span className="flex items-center gap-1.5"><Activity size={12} /> MVP de emergencias</span>
          <span className="font-mono-ui text-[9px]">MEDIFLOW · 01</span>
        </div>
      </aside>

      <div className="mf-app-main">
        <header className="mf-topbar">
          <div className="min-w-0">
            <div className="hidden items-center gap-2 text-[10px] text-muted-foreground sm:flex">
              <span className="font-semibold">MediFlow</span><span className="text-[#b9c3c9]">/</span><span>{pageName}</span>
            </div>
            <p className="mt-0.5 hidden text-[10px] capitalize text-muted-foreground sm:block">{currentDate}</p>
            <h2 className="text-sm font-extrabold sm:hidden">{pageName}</h2>
          </div>

          <div className="mf-topbar-actions">
            <div className={`mf-data-status mf-data-status-${dataStatus.tone}`} title={dataStatus.detail} aria-live="polite">
              <span className="mf-status-dot" />
              <span className="mf-status-label">{dataStatus.label}</span>
              <span className="mf-status-short">{dataStatus.shortLabel}</span>
            </div>

            <form onSubmit={searchSubmit} className="mf-global-search" role="search">
              <Search size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              <label className="sr-only" htmlFor="mf-global-search">Buscar paciente o código</label>
              <input
                id="mf-global-search"
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                placeholder="Buscar paciente…"
                autoComplete="off"
              />
              {query && (
                <button type="button" onClick={() => { setQuery(''); setSearchOpen(false); }} className="mf-search-clear" aria-label="Limpiar búsqueda">
                  <X size={13} />
                </button>
              )}
              {searchOpen && query.trim().length >= 2 && (
                <div className="mf-search-popover">
                  {matches.length ? matches.map((patient) => (
                    <button
                      type="button"
                      key={patient.id}
                      className="mf-search-result"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        const active = state.episodes.some((episode) => episode.patientId === patient.id && episode.status !== 'Atendido');
                        setLocation(active ? `/cola?patient=${encodeURIComponent(patient.id)}` : '/registro');
                        setSearchOpen(false);
                      }}
                    >
                      <span className="mf-search-avatar">{patient.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                      <span className="min-w-0 flex-1 text-left">
                        <strong className="block truncate">{patient.name}</strong>
                        <small>{patient.record} · {patient.age === null ? 'edad no informada' : `${patient.age} años`}</small>
                      </span>
                      <ChevronDown size={13} className="rotate-[-90deg] text-muted-foreground" />
                    </button>
                  )) : (
                    <p className="px-4 py-3 text-xs text-muted-foreground">No hay coincidencias en los datos cargados.</p>
                  )}
                </div>
              )}
            </form>

            <Link href="/registro" className="mf-topbar-add" aria-label="Registrar paciente">
              <UserRoundPlus size={15} /><span>Registrar</span>
            </Link>
            <span className="mf-topbar-profile" aria-label="Área de operación">
              <span className="mf-profile-avatar">MF</span>
              <span className="hidden xl:block">
                <strong>Operación</strong>
                <small>Emergencias</small>
              </span>
            </span>
          </div>
        </header>

        <main id="main-content" className="mf-page-content" onClick={() => searchOpen && setSearchOpen(false)}>
          <Suspense fallback={<PageLoading />}>
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/registro" component={RegistrationPage} />
              <Route path="/pacientes" component={RegistrationPage} />
              <Route path="/cola" component={QueuePage} />
              <Route path="/emergencias" component={QueuePage} />
              <Route path="/triaje" component={QueuePage} />
              <Route path="/reevaluacion" component={ReevaluationPage} />
              <Route path="/recursos" component={ResourcesPage} />
              <Route component={OutOfScopePage} />
            </Switch>
          </Suspense>
        </main>

        <footer className="mf-app-footer">
          <span>MediFlow · Operación de emergencias</span>
          <span>La prioridad clínica requiere revisión profesional.</span>
        </footer>
      </div>

      <nav className="mf-mobile-nav" aria-label="Navegación móvil">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname === href || (href === '/registro' && pathname === '/pacientes') || (href === '/cola' && (pathname === '/triaje' || pathname === '/emergencias'));
          const mobileLabel = label === 'Registro de pacientes' ? 'Registro' : label === 'Cola de atención' ? 'Cola' : label === 'Gestión de recursos' ? 'Recursos' : label === 'Panel de control' ? 'Panel' : label;
          return (
            <Link key={href} href={href} className={`mf-mobile-link ${active ? 'mf-mobile-link-active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon size={19} aria-hidden="true" />
              <span>{mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function OutOfScopePage() {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-5 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef4f6] text-primary"><CircleHelp size={22} /></span>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-accent">Alcance MVP</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Esta sección no está incluida</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Esta versión de MediFlow se centra en el flujo de emergencias, el registro de pacientes, la cola, la reevaluación y los recursos asociados.</p>
      <Link className="mf-primary-link mt-5" href="/">Volver al panel</Link>
    </div>
  );
}

function PageLoading() {
  return (
    <div className="mf-panel flex min-h-60 flex-col items-center justify-center text-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#d9e7e9] border-t-accent" aria-hidden="true" />
      <p className="mt-3 text-xs font-semibold text-muted-foreground" role="status">Cargando pantalla…</p>
    </div>
  );
}

export default function App() {
  return (
    <MvpStoreProvider>
      <MvpApplication />
    </MvpStoreProvider>
  );
}
