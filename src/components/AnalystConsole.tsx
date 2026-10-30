'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Conversation {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userDepartment: string;
  state: 'agent' | 'aguardando_atendente' | 'com_analista' | 'encerrada';
  analystId?: number;
  analystName?: string;
  currentTicketId?: number;
  currentTicketNumber?: string;
  messageCount: number;
  sessionStartedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant' | 'system' | 'analyst';
  content: string;
  uiKind?: string;
  // Payloads de UI (ticket_card, options, etc.) e o trace de decisão do agent
  // têm shapes variados por uiKind/ação; tipar como union aqui duplicaria os
  // tipos já definidos em agent/trace.ts e agent/decision.ts sem ganho real
  // neste componente, que só repassa esses dados para renderização.
  uiData?: any;
  decisionTrace?: any;
  createdAt: string;
}

interface Ticket {
  id: number;
  number: string;
  title: string;
  type: string;
  category: string;
  priority: string;
  status: string;
  dueAt: string | null;
  isOverdue: boolean;
  businessHoursRemaining: number;
  createdAt: string;
  updatedAt: string;
}

type FilterType = 'all' | 'minhas' | 'com_agent' | 'aguardando' | 'com_analista';

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'Todas',
  minhas: 'Para você',
  com_agent: 'Com o agent',
  aguardando: 'Aguardando',
  com_analista: 'Minhas',
};

const STATE_LABELS: Record<Conversation['state'], { label: string; color: string }> = {
  agent: { label: 'Agent atendendo', color: 'bg-primary/10 text-primary border-primary/20' },
  aguardando_atendente: { label: 'Aguardando atendente', color: 'bg-warning/10 text-warning-text border-warning/20' },
  com_analista: { label: 'Com analista', color: 'bg-violet/10 text-violet-text border-violet/20' },
  encerrada: { label: 'Encerrada', color: 'bg-rule text-ink-3 border-rule' },
};

export function AnalystConsole() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userTickets, setUserTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<{ id: number; name: string; role: string } | null>(null);

  const loadUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (!data.user || data.user.role !== 'analyst') {
        router.push('/login');
        return;
      }
      setUser(data.user);
    } catch {
      router.push('/login');
    }
  };

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('filter', filter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/analyst/conversations?${params}`);
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  const loadConversationDetail = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    try {
      const res = await fetch(`/api/analyst/conversations/${conversation.id}`);
      const data = await res.json();
      if (data.conversation) {
        setSelectedConversation(data.conversation);
        setMessages(data.messages || []);
        setUserTickets(data.userTickets || []);
      }
    } catch (err) {
      console.error('Failed to load conversation detail:', err);
    }
  };

  const handleAssume = async () => {
    if (!selectedConversation) return;
    try {
      const res = await fetch(`/api/analyst/conversations/${selectedConversation.id}/assume`, { method: 'POST' });
      if (res.ok) {
        loadConversationDetail(selectedConversation);
        loadConversations();
      }
    } catch (err) {
      console.error('Failed to assume:', err);
    }
  };

  const handleReturn = async () => {
    if (!selectedConversation) return;
    try {
      const res = await fetch(`/api/analyst/conversations/${selectedConversation.id}/return`, { method: 'POST' });
      if (res.ok) {
        loadConversationDetail(selectedConversation);
        loadConversations();
      }
    } catch (err) {
      console.error('Failed to return:', err);
    }
  };

  const handleClose = async () => {
    if (!selectedConversation) return;
    try {
      const res = await fetch(`/api/analyst/conversations/${selectedConversation.id}/close`, { method: 'POST' });
      if (res.ok) {
        loadConversationDetail(selectedConversation);
        loadConversations();
      }
    } catch (err) {
      console.error('Failed to close:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/analyst/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      if (res.ok) {
        setNewMessage('');
        loadConversationDetail(selectedConversation);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) loadConversations();
  }, [user, loadConversations]);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critica': return 'bg-danger/10 text-danger-text border-danger/20';
      case 'alta': return 'bg-warning/10 text-warning-text border-warning/20';
      case 'media': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-rule text-ink-3 border-rule';
    }
  };

  const getTicketStatusColor = (status: string) => {
    switch (status) {
      case 'resolvido': return 'bg-success/10 text-success-text border-success/20';
      case 'em_andamento': return 'bg-primary/10 text-primary border-primary/20';
      case 'aguardando_usuario': return 'bg-warning/10 text-warning-text border-warning/20';
      case 'aguardando_aprovacao': return 'bg-violet/10 text-violet-text border-violet/20';
      case 'cancelado': return 'bg-rule text-ink-3 border-rule';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-desk">
        <div className="animate-pulse text-ink-3">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-desk" style={{ fontFamily: 'var(--font-schibsted-grotesk)' }}>
      <aside className="w-72 bg-white border-r border-rule flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-rule flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 24.388 20.639" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
              <path d="M21.763 0.24493l-3.374 1.687c-0.623 0.308-0.973 0.903-0.973 1.631l0 6.293-11.193-9.429c-0.623-0.469-1.372-0.553-2.03-0.245l-3.185 1.631c-0.651 0.322-1.008 0.924-1.008 1.673l0 15.218c0 1.477 1.526 2.289 2.716 1.785l3.073-1.617c0.693-0.322 1.057-0.952 1.057-1.722l0-7.7 11.732 10.591c0.602 0.546 1.421 0.679 2.086 0.364l2.786-1.505c0.602-0.315 0.938-0.931 0.938-1.68l0-15.288c0-1.463-1.505-2.275-2.625-1.687z" fill="currentColor" />
            </svg>
            <span className="font-display text-xl font-bold text-ink">Console</span>
          </div>
          <span className="text-xs text-ink-3">{user.name}</span>
        </div>

        <div className="p-4 border-b border-rule">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversas..."
            className="input text-sm mb-3"
          />
          <div className="flex gap-1 flex-wrap">
            {(['all', 'minhas', 'com_agent', 'aguardando', 'com_analista'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1.5 text-xs rounded-radius-6 transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-desk text-ink-3 hover:bg-rule'}`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center text-ink-3 py-8">Carregando...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-ink-3 py-8">Nenhuma conversa encontrada</div>
          ) : (
            conversations.map((conv) => {
              const stateInfo = STATE_LABELS[conv.state];
              let badgeText = '';
              if (conv.currentTicketNumber) {
                badgeText = conv.state === 'aguardando_atendente' ? `Transferida · ${conv.currentTicketNumber}` :
                  conv.state === 'com_analista' ? `Você está atendendo · ${conv.currentTicketNumber}` :
                  `Agent atendendo · ${conv.currentTicketNumber}`;
              } else if (conv.state === 'aguardando_atendente') {
                badgeText = 'Agent pediu ajuda';
              } else if (conv.state === 'encerrada') {
                badgeText = 'Resolvida pelo agent';
              } else {
                badgeText = 'Agent atendendo';
              }

              return (
                <button
                  key={conv.id}
                  onClick={() => loadConversationDetail(conv)}
                  className={`w-full text-left p-3 rounded-radius-10 transition-all border ${
                    selectedConversation?.id === conv.id
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:bg-desk'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink truncate">{conv.userName}</p>
                      <p className="text-xs text-ink-3">{conv.userEmail} · {conv.userDepartment}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-radius-6 ${stateInfo.color} flex-shrink-0`}>
                      {stateInfo.label}
                    </span>
                  </div>
                  <p className="text-xs text-ink-3 mb-1">{badgeText}</p>
                  <p className="text-xs text-ink-3">Atualizado: {formatTime(conv.updatedAt)} · {conv.messageCount} msgs</p>
                </button>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-rule">
          <button onClick={handleLogout} className="btn-ghost w-full text-sm">Sair</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {selectedConversation ? (
          <>
            <div className="bg-white border-b border-rule px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedConversation(null)} className="btn-ghost p-1.5 lg:hidden">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5"></path>
                    <path d="M12 19l-7-7 7-7"></path>
                  </svg>
                </button>
                <div>
                  <p className="font-medium text-ink">{selectedConversation.userName}</p>
                  <p className="text-sm text-ink-3">{selectedConversation.userEmail} · {selectedConversation.userDepartment}</p>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-radius-6 ${STATE_LABELS[selectedConversation.state].color}`}>
                  {STATE_LABELS[selectedConversation.state].label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedConversation.state === 'aguardando_atendente' && (
                  <button onClick={handleAssume} className="btn-primary text-sm">Assumir atendimento</button>
                )}
                {selectedConversation.state === 'com_analista' && selectedConversation.analystId === user.id && (
                  <>
                    <button onClick={handleReturn} className="btn-secondary text-sm">Devolver ao agent</button>
                    <button onClick={handleClose} className="btn-danger text-sm">Encerrar</button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      {!['user', 'analyst'].includes(msg.role) && (
                        <div className="w-7 h-7 rounded-full bg-desk flex items-center justify-center flex-shrink-0 text-xs text-ink-3">
                          {msg.role === 'assistant' ? 'IA' : '⚙'}
                        </div>
                      )}
                      {msg.role === 'analyst' && (
                        <div className="w-7 h-7 rounded-full bg-violet/10 flex items-center justify-center flex-shrink-0 text-violet-text text-xs font-medium">N2</div>
                      )}
                      <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                        <div className={`rounded-radius-14 px-3 py-2 ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-sm' : msg.role === 'analyst' ? 'bg-violet-50 border border-violet/20 rounded-tl-sm' : msg.role === 'system' ? 'bg-blue-50 border-2 border-primary rounded-radius-14' : 'bg-white border border-rule rounded-tl-sm'}`}>
                          <p className="text-sm" style={{ color: msg.role === 'user' ? 'white' : 'var(--ink)' }}>{msg.content}</p>
                        </div>
                        <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/70' : msg.role === 'analyst' ? 'text-violet-text' : 'text-ink-3'}`}>
                          {formatTime(msg.createdAt)}
                          {msg.role === 'analyst' && ' · Analista'}
                          {msg.role === 'assistant' && ' · IA'}
                          {msg.role === 'system' && ' · Sistema'}
                        </p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-white text-xs font-medium">{selectedConversation.userName.charAt(0)}</div>
                      )}
                    </div>
                  ))}
                  <div ref={(el) => { if (el) el.scrollIntoView({ behavior: 'smooth' }); }} />
                </div>

                {selectedConversation.state === 'com_analista' && selectedConversation.analystId === user.id && (
                  <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-rule">
                    <div className="flex gap-2">
                      <input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        className="flex-1 input"
                        disabled={sending}
                      />
                      <button type="submit" disabled={!newMessage.trim() || sending} className="btn-primary">
                        {sending ? 'Enviando...' : 'Enviar'}
                      </button>
                    </div>
                  </form>
                )}

                {selectedConversation.state !== 'com_analista' && (
                  <div className="p-4 bg-white border-t border-rule text-center text-ink-3 text-sm">
                    {selectedConversation.state === 'aguardando_atendente' ? 'Aguardando assumir atendimento...' : 'Conversa com o agent'}
                  </div>
                )}
              </div>

              <aside className="w-80 bg-white border-l border-rule hidden xl:block">
                <div className="p-4 border-b border-rule">
                  <h3 className="font-medium text-ink">Chamados de {selectedConversation.userName.split(' ')[0]}</h3>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                  {userTickets.length === 0 ? (
                    <p className="text-sm text-ink-3 text-center py-8">Nenhum chamado encontrado</p>
                  ) : (
                    userTickets.map((ticket) => (
                      <div key={ticket.id} className="ticket-card">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-mono text-sm font-medium text-ink">{ticket.number}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-radius-6 ${getTicketStatusColor(ticket.status)}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-ink mb-1">{ticket.title}</p>
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          <span className={`px-2 py-0.5 rounded-radius-6 ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                          <span className="px-2 py-0.5 rounded-radius-6 bg-desk text-ink-3">{ticket.category}</span>
                          <span className="px-2 py-0.5 rounded-radius-6 bg-desk text-ink-3">{ticket.type}</span>
                          {ticket.isOverdue && (
                            <span className="px-2 py-0.5 rounded-radius-6 bg-danger/10 text-danger-text border border-danger/20">Vencido</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </aside>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 text-rule">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <h2 className="font-display text-xl font-medium text-ink">Selecione uma conversa</h2>
              <p className="text-ink-3 mt-1">Clique em uma conversa na lista ao lado para começar</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}