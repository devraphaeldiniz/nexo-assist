'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  email: string;
  name: string;
  department: string;
  role: 'employee' | 'analyst';
  avatarInitials: string;
}

export function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (!data.user) {
        router.push('/login');
        return;
      }
      setUser(data.user);
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Preencha todos os campos' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não conferem' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres' });
      return;
    }

    // Simulated password change
    setMessage({ type: 'success', text: 'Senha alterada com sucesso! (simulado)' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-desk">
        <div className="animate-pulse text-ink-3">Carregando...</div>
      </div>
    );
  }

  if (!user) return null;

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-desk" style={{ fontFamily: 'var(--font-schibsted-grotesk)' }}>
      <header className="bg-white border-b border-rule px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24.388 20.639" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
            <path d="M21.763 0.24493l-3.374 1.687c-0.623 0.308-0.973 0.903-0.973 1.631l0 6.293-11.193-9.429c-0.623-0.469-1.372-0.553-2.03-0.245l-3.185 1.631c-0.651 0.322-1.008 0.924-1.008 1.673l0 15.218c0 1.477 1.526 2.289 2.716 1.785l3.073-1.617c0.693-0.322 1.057-0.952 1.057-1.722l0-7.7 11.732 10.591c0.602 0.546 1.421 0.679 2.086 0.364l2.786-1.505c0.602-0.315 0.938-0.931 0.938-1.68l0-15.288c0-1.463-1.505-2.275-2.625-1.687z" fill="currentColor" />
          </svg>
          <span className="font-display text-xl font-bold text-ink">Nexo Assist</span>
        </div>
        <button onClick={handleLogout} className="btn-ghost text-sm">Sair</button>
      </header>

      <main className="max-w-2xl mx-auto py-8 px-4">
        <div className="card">
          <div className="p-6 border-b border-rule">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white font-bold text-2xl">
                {user.avatarInitials || getInitials(user.name)}
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-ink">{user.name}</h1>
                <p className="text-ink-3">{user.email}</p>
                <p className="text-sm text-ink-3">{user.department}</p>
              </div>
            </div>
          </div>

          <div className="p-6 border-b border-rule">
            <h2 className="font-medium text-ink mb-4">E-mail</h2>
            <p className="text-ink-3">{user.email}</p>
            <p className="text-xs text-ink-3 mt-1">Gerenciado pela TI</p>
          </div>

          <div className="p-6 border-b border-rule">
            <h2 className="font-medium text-ink mb-4">Senha</h2>
            <p className="text-ink-3 mb-4">Alterada há 42 dias</p>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-ink-2 mb-1.5">
                  Senha atual
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input"
                  placeholder="Senha atual"
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-ink-2 mb-1.5">
                  Nova senha
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input"
                  placeholder="Nova senha (mín. 6 caracteres)"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink-2 mb-1.5">
                  Confirmar nova senha
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="Confirme a nova senha"
                />
              </div>
              <button type="submit" className="btn-primary">Alterar senha</button>
            </form>
          </div>

          {message && (
            <div className="p-4 mx-6 rounded-radius-10" style={{
              backgroundColor: message.type === 'success' ? '#ECFDF3' : '#FEF3F2',
              borderColor: message.type === 'success' ? '#10B981' : '#EF4444',
              color: message.type === 'success' ? '#027A48' : '#B42318',
            }}>
              {message.text}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}