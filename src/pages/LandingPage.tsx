import { Link } from 'wouter';
import { Leaf, MessageCircle, BookOpen, TrendingUp, Heart, Lock, Moon } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-app-bg font-sans">

      <header className="sticky top-0 z-50 bg-app-bg/95 backdrop-blur-sm border-b border-app-border">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-sage-soft rounded-full flex items-center justify-center">
              <Leaf className="w-3.5 h-3.5 text-sage-strong" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-app-text">
              Tu Ánimo
            </span>
          </div>
          <nav className="flex items-center gap-1.5">
            <Link
              href="/app"
              className="px-4 py-2 text-sm font-medium text-app-muted hover:text-app-text transition-colors rounded-12"
            >
              Abrir app
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-white bg-sage-strong hover:bg-[#4e7260] rounded-12 transition-colors"
            >
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6">

        <section className="pt-20 pb-20 text-center">
          <h1 className="text-[2.25rem] sm:text-[2.75rem] font-semibold tracking-tight text-app-text leading-[1.15] mb-5">
            Un lugar para lo que sientes
          </h1>
          <p className="text-[1.05rem] text-app-muted leading-relaxed max-w-sm mx-auto mb-10">
            Escribe lo que llevas dentro. Habla con Elena cuando lo necesites. Sin prisa, sin juicios.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto px-7 py-3.5 text-sm font-semibold text-white bg-sage-strong hover:bg-[#4e7260] rounded-12 transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/app"
              className="w-full sm:w-auto px-7 py-3.5 text-sm font-semibold text-app-muted hover:text-app-text border border-app-border bg-app-surface hover:border-sage-strong/50 rounded-12 transition-colors"
            >
              Abrir app
            </Link>
          </div>
        </section>

        <section className="pb-20">
          <div className="border-t border-app-border">
            {[
              {
                icon: BookOpen,
                heading: 'Escribe lo que sientes',
                body: 'A veces poner las cosas en palabras ya ayuda. Tu diario está aquí para eso.',
              },
              {
                icon: MessageCircle,
                heading: 'Habla cuando tu mente está cargada',
                body: 'Elena escucha con calma. No da consejos vacíos. Solo acompaña.',
              },
              {
                icon: TrendingUp,
                heading: 'Entiéndete con el tiempo',
                body: 'Poco a poco emergen patrones. Ver cómo estás evolucionando puede ser revelador.',
              },
            ].map(({ icon: Icon, heading, body }) => (
              <div key={heading} className="flex items-start gap-5 py-7 border-b border-app-border">
                <div className="w-9 h-9 bg-sage-soft rounded-12 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={16} className="text-sage-strong" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-app-text mb-1">{heading}</p>
                  <p className="text-sm text-app-muted leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-20">
          <p className="text-xs font-semibold text-app-muted uppercase tracking-widest mb-6">
            Lo que encontrarás
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                icon: BookOpen,
                title: 'Diario guiado',
                desc: 'Sugerencias suaves para cuando no sabes por dónde empezar.',
              },
              {
                icon: MessageCircle,
                title: 'Chat de apoyo',
                desc: 'Habla con Elena cuando algo te pesa. Disponible siempre.',
              },
              {
                icon: TrendingUp,
                title: 'Seguimiento emocional',
                desc: 'Una mirada semanal a cómo has estado.',
              },
              {
                icon: Heart,
                title: 'Patrones personales',
                desc: 'Con el tiempo, comienzas a entenderte mejor.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-app-surface border border-app-border rounded-[16px] p-5"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <Icon size={15} className="text-sage-strong flex-shrink-0" />
                  <span className="text-[14px] font-semibold text-app-text">{title}</span>
                </div>
                <p className="text-sm text-app-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-20">
          <div className="bg-app-surface border border-app-border rounded-[16px] px-6 py-7 space-y-5">
            {[
              {
                icon: Lock,
                text: 'Lo que escribes es tuyo. Cifrado, privado, sin acceso de terceros.',
              },
              {
                icon: Moon,
                text: 'Tu espacio personal. No una red social, no una plataforma de datos.',
              },
              {
                icon: Leaf,
                text: 'Elena es un acompañamiento emocional, no un servicio médico ni terapia profesional.',
              },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3.5">
                <Icon size={15} className="text-app-muted flex-shrink-0 mt-[3px]" />
                <p className="text-sm text-app-muted leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-24 text-center">
          <p className="text-[15px] text-app-muted mb-7 leading-relaxed">
            Cuando estés listo, aquí está tu espacio.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto px-7 py-3.5 text-sm font-semibold text-white bg-sage-strong hover:bg-[#4e7260] rounded-12 transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/app"
              className="w-full sm:w-auto px-7 py-3.5 text-sm font-semibold text-app-muted hover:text-app-text border border-app-border bg-app-surface hover:border-sage-strong/50 rounded-12 transition-colors"
            >
              Abrir app
            </Link>
          </div>
        </section>

      </main>

      <footer className="border-t border-app-border">
        <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-sage-soft rounded-full flex items-center justify-center">
              <Leaf className="w-2.5 h-2.5 text-sage-strong" />
            </div>
            <span className="text-sm text-app-muted font-medium">Tu Ánimo</span>
          </div>
          <p className="text-xs text-app-muted">
            &copy; {new Date().getFullYear()} Tu Ánimo. Todos los derechos reservados.
          </p>
        </div>
      </footer>

    </div>
  );
}
