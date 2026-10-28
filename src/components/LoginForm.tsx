'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login');
        return;
      }

      router.push(data.redirectTo);
      router.refresh();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl font-bold text-ink">Entrar no Nexo Assist</h1>
        <p className="text-ink-3 mt-2">Use seu e-mail corporativo</p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-radius-10 bg-danger/10 border border-danger/20 text-danger-text text-sm" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink-2 mb-1.5">
            E-mail corporativo
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="seu.nome@nexo.com.br"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink-2 mb-1.5">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="Qualquer senha"
            required
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="mt-6 p-3 rounded-radius-10 bg-desk border border-rule text-sm text-ink-3">
        <p className="font-medium mb-1">Funcionários de teste:</p>
        <ul className="space-y-1 text-left">
          <li>ana.souza@nexo.com.br (Financeiro)</li>
          <li>carla.mendes@nexo.com.br (Marketing)</li>
          <li>bruno.tavares@nexo.com.br (Vendas)</li>
          <li>rafael.lima@nexo.com.br (Analista - Suporte N2)</li>
          <li>marina.silva@nexo.com.br (Analista - Suporte N1)</li>
        </ul>
        <p className="mt-2 text-xs text-ink-3">Qualquer senha funciona</p>
      </div>
    </div>
  );
}