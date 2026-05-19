import { Link } from 'wouter';
import { BarChart3, DollarSign, Shield, Users, AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';

interface NavCard {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}

const adminNav: NavCard[] = [
  {
    href: '/app/admin/token-usage',
    icon: BarChart3,
    title: 'Uso de Tokens',
    description: 'Analiza el consumo de tokens por usuario, operación y período de tiempo.',
  },
  {
    href: '/app/admin/token-costs',
    icon: DollarSign,
    title: 'Costos de Tokens',
    description: 'Gasto estimado en OpenAI: totales 7d/30d, desglose por función y plan, top 20 usuarios.',
  },
  {
    href: '/app/admin/users',
    icon: Users,
    title: 'Usuarios',
    description: 'Gestiona perfiles de usuario, límites de tokens y configuración de cuentas.',
  },
  {
    href: '/app/admin/crisis-events',
    icon: AlertTriangle,
    title: 'Eventos de Crisis',
    description: 'Registros de señales de angustia detectadas por los modelos de IA en chat, diario e insights.',
  },
  {
    href: '/app/admin/plan-limits',
    icon: SlidersHorizontal,
    title: 'Límites de Plan',
    description: 'Configura los presupuestos diarios y mensuales de tokens por plan (Starter, Pro, Power) sin SQL.',
  },
];

export function AdminPage() {
  const { data: isAdmin } = useAdmin();

  if (!isAdmin) {
    return (
      <div className="bg-app-bg p-5 flex items-center justify-center" style={{ minHeight: 'calc(100dvh - var(--chrome-total))' }}>
        <div className="text-center space-y-2">
          <Shield size={32} className="text-app-muted mx-auto" />
          <p className="text-sm font-semibold text-app-text">Acceso restringido</p>
          <p className="text-xs text-app-muted">No tienes permisos para ver esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{
        minHeight: 'calc(100dvh - var(--chrome-total))',
        paddingBottom: 'calc(var(--nav-total) + 1.5rem)',
      }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-12 bg-sage-strong/10 flex items-center justify-center">
            <Shield size={18} className="text-sage-strong" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-app-text">Panel de Administración</h1>
            <p className="text-sm text-app-muted">Herramientas exclusivas para administradores</p>
          </div>
        </div>

        <div className="grid gap-3">
          {adminNav.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group block bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 hover:border-sage-strong transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-12 bg-app-bg border border-app-border flex items-center justify-center flex-shrink-0 group-hover:border-sage-strong transition-colors">
                  <item.icon size={18} className="text-app-muted group-hover:text-sage-strong transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[15px] font-semibold text-app-text">{item.title}</span>
                  </div>
                  <p className="text-sm text-app-muted leading-snug">{item.description}</p>
                </div>
                <svg
                  className="w-4 h-4 text-app-muted group-hover:text-sage-strong transition-colors flex-shrink-0 mt-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
