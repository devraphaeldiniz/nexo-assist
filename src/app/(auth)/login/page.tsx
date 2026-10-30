import { LoginForm } from '@/components/LoginForm';
import { newsreader, schibstedGrotesk } from '@/app/layout';

const NEXO_MARK = (
  <svg width="24" height="24" viewBox="0 0 24.388 20.639" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M21.763 0.24493l-3.374 1.687c-0.623 0.308-0.973 0.903-0.973 1.631l0 6.293-11.193-9.429c-0.623-0.469-1.372-0.553-2.03-0.245l-3.185 1.631c-0.651 0.322-1.008 0.924-1.008 1.673l0 15.218c0 1.477 1.526 2.289 2.716 1.785l3.073-1.617c0.693-0.322 1.057-0.952 1.057-1.722l0-7.7 11.732 10.591c0.602 0.546 1.421 0.679 2.086 0.364l2.786-1.505c0.602-0.315 0.938-0.931 0.938-1.68l0-15.288c0-1.463-1.505-2.275-2.625-1.687z"
      fill="#FFFFFF"
    />
  </svg>
);

export default function LoginPage() {
  return (
    <div className="min-h-screen flex" style={{ fontFamily: `${schibstedGrotesk.variable}, ${newsreader.variable}` }}>
      <div className="w-full lg:w-5/12 bg-ink flex flex-col justify-between p-8 lg:p-16 hidden lg:flex">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6">{NEXO_MARK}</div>
          <span className="font-ui text-lg font-bold text-white tracking-tight">Nexo Assist</span>
        </div>

        <div className="space-y-8 max-w-md">
          <div className="space-y-4">
            <span className="text-white/55 text-sm font-medium uppercase tracking-wide">Service desk de TI da Nexo</span>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight">
              Seu problema de TI, resolvido em uma conversa.
            </h2>
          </div>

          <div className="bg-white/5 rounded-radius-14 p-6 border border-white/10 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-medium">AS</span>
              </div>
              <div className="space-y-1">
                <p className="text-white font-medium">Ana Souza</p>
                <p className="text-white/70 text-sm">Financeiro</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/10 space-y-3 text-white/80 text-sm">
              <p><span className="font-medium">Você:</span> Minha VPN dá erro 809 no Windows 10</p>
              <p><span className="font-medium">Nexo Assist:</span> Encontrei um artigo sobre isso. O erro 809 ocorre só no Windows 10. No Windows 11 funciona normal. Quer que eu abra um chamado?</p>
              <p><span className="font-medium">Você:</span> Sim, por favor</p>
              <p><span className="font-medium">Nexo Assist:</span> ✓ Chamado INC-20345 criado com prioridade Alta. Prazo: 4h úteis.</p>
            </div>
          </div>
        </div>

        <p className="text-white/40 text-xs">Beyond the Bytes · Processo seletivo</p>
      </div>

      <div className="w-full lg:w-7/12 flex items-center justify-center p-8 bg-desk">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}