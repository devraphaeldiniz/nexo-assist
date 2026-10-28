'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system' | 'analyst';
  content: string;
  ui?: {
    kind: 'options' | 'ticket_selector' | 'ticket_card' | 'draft';
    question?: string;
    options?: string[];
    ticketNumbers?: string[];
    ticketNumber?: string;
    draftId?: string;
  };
  decision?: {
    intent: string;
    understood: string;
    action: string;
    confidence: number;
    reasoning: string;
    rulesApplied: string[];
  };
  createdAt: string;
}

interface User {
  id: number;
  email: string;
  name: string;
  department: string;
  role: 'employee' | 'analyst';
  avatarInitials: string;
}

export function ChatInterface() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messageCount, setMessageCount] = useState(0);
  const [conversationState, setConversationState] = useState<'agent' | 'aguardando_atendente' | 'com_analista' | 'encerrada'>('agent');
  const [showDecisionPanel, setShowDecisionPanel] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<number | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (!data.user) {
        router.push('/login');
        return;
      }
      setUser(data.user);
      loadConversation();
    } catch {
      router.push('/login');
    }
  };

  const loadConversation = async () => {
    try {
      const res = await fetch('/api/chat/history');
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
        setMessageCount(data.messageCount || 0);
        setConversationState(data.state || 'agent');
        conversationIdRef.current = data.conversationId;
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao enviar mensagem');
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      const assistantMessage: Message = {
        id: data.turnId ? parseInt(data.turnId, 10) : Date.now() + 1,
        role: 'assistant',
        content: data.message,
        ui: data.ui,
        decision: data.decision,
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setMessageCount(data.messageCount || 0);
      setConversationState(data.state || 'agent');
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleOptionClick = (option: string) => {
    sendMessage(option);
  };

  const handleDraftConfirm = async (draftId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/drafts/${draftId}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const systemMessage: Message = {
          id: Date.now(),
          role: 'system',
          content: data.message,
          ui: { kind: 'ticket_card', ticketNumber: data.ticketNumber },
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, systemMessage]);
      } else {
        setError(data.error || 'Erro ao confirmar');
      }
    } catch {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleDraftCancel = async (draftId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/drafts/${draftId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const systemMessage: Message = {
          id: Date.now(),
          role: 'system',
          content: data.message,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    } catch {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleNewSession = async () => {
    setMessages([]);
    setMessageCount(0);
    setConversationState('agent');
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'text-success-text';
    if (conf >= 0.6) return 'text-warning-text';
    return 'text-danger-text';
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-desk">
        <div className="animate-pulse text-ink-3">Carregando...</div>
      </div>
    );
  }

  const isAnalystChat = conversationState === 'com_analista' || conversationState === 'aguardando_atendente';

  return (
    <div className="min-h-screen flex flex-col bg-desk" style={{ fontFamily: 'var(--font-schibsted-grotesk)' }}>
      <header className="bg-white border-b border-rule px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24.388 20.639" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
            <path d="M21.763 0.24493l-3.374 1.687c-0.623 0.308-0.973 0.903-0.973 1.631l0 6.293-11.193-9.429c-0.623-0.469-1.372-0.553-2.03-0.245l-3.185 1.631c-0.651 0.322-1.008 0.924-1.008 1.673l0 15.218c0 1.477 1.526 2.289 2.716 1.785l3.073-1.617c0.693-0.322 1.057-0.952 1.057-1.722l0-7.7 11.732 10.591c0.602 0.546 1.421 0.679 2.086 0.364l2.786-1.505c0.602-0.315 0.938-0.931 0.938-1.68l0-15.288c0-1.463-1.505-2.275-2.625-1.687z" fill="currentColor" />
          </svg>
          <div>
            <h1 className="font-display text-xl font-bold text-ink">Nexo Assist</h1>
            <p className="text-xs text-ink-3">Service desk de TI</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right text-sm">
            <p className="font-medium text-ink">{user.name}</p>
            <p className="text-ink-3">{user.department}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-medium text-sm">
            {user.avatarInitials}
          </div>
          <button onClick={handleLogout} className="btn-ghost text-sm px-3 py-1.5">Sair</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-white border-r border-rule flex flex-col hidden lg:flex">
          <nav className="p-4 space-y-1">
            <button className="w-full text-left px-3 py-2 rounded-radius-10 hover:bg-desk transition-colors font-medium text-ink flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-3">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Atendimento
            </button>
            <button className="w-full text-left px-3 py-2 rounded-radius-10 hover:bg-desk transition-colors font-medium text-ink-3 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-3">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Meu perfil
            </button>
          </nav>
          <div className="mt-auto p-4 border-t border-rule">
            <div className="flex items-center gap-3 p-2 rounded-radius-10 bg-desk">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-medium text-sm">
                {user.avatarInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink truncate">{user.name}</p>
                <p className="text-xs text-ink-3">{user.email}</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="bg-white border-b border-rule px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-ink-3">Service desk de TI</span>
              <span className="text-rule">›</span>
              <span className="font-medium text-ink">Atendimento</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success"></span>
              <span className="text-sm text-success-text font-medium">Assistente online</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {messages.length === 0 && (
              <div className="text-center text-ink-3 py-12">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 text-rule">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <p className="font-display text-lg font-medium text-ink">Olá, {user.name.split(' ')[0]}!</p>
                <p className="mt-1 text-sm">Como posso ajudar você hoje?</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                index={idx}
                userInitials={user.avatarInitials}
                onOptionClick={handleOptionClick}
                onDraftConfirm={handleDraftConfirm}
                onDraftCancel={handleDraftCancel}
                onToggleDecision={setShowDecisionPanel}
                isExpanded={showDecisionPanel === msg.id}
                formatTime={formatTime}
                getConfidenceColor={getConfidenceColor}
              />
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-ink-3 text-sm animate-pulse">
                <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                <span>Digitando...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="px-4 py-2 bg-danger/10 border-t border-danger/20">
              <div className="flex items-center justify-between text-sm text-danger-text">
                <span>{error}</span>
                <button onClick={() => setError('')} className="text-danger hover:text-danger-text">×</button>
              </div>
            </div>
          )}

          <div className="p-4 bg-white border-t border-rule">
            {isAnalystChat ? (
              <div className="p-3 rounded-radius-10 bg-warning/10 border border-warning/20 text-warning-text text-sm">
                {conversationState === 'aguardando_atendente' ? (
                  'Aguardando um analista assumir...'
                ) : (
                  'Você está conversando com um analista. Suas mensagens vão direto para ele.'
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-ink-3">
                    {messageCount}/30 mensagens nesta sessão
                  </span>
                  {messageCount >= 25 && (
                    <span className="text-xs text-warning-text font-medium">⚠ Perto do limite</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        sendMessage(input);
                      }
                    }}
                    placeholder={isAnalystChat ? 'Aguardando analista...' : 'Descreva seu problema ou faça uma pergunta...'}
                    className="flex-1 input resize-none min-h-[44px] max-h-32"
                    rows={1}
                    disabled={isAnalystChat || loading}
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || loading || isAnalystChat}
                    className="btn-primary self-end mb-1"
                  >
                    {loading ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
                <p className="text-xs text-ink-3 mt-1">⌘+Enter para enviar | Limite: 30 mensagens/sessão</p>
              </>
            )}

            {messageCount >= 30 && !isAnalystChat && (
              <div className="mt-3 p-3 rounded-radius-10 bg-warning/10 border border-warning/20 text-warning-text text-sm">
                Limite de 30 mensagens atingido.
                <button onClick={handleNewSession} className="ml-2 text-warning underline">Iniciar nova sessão</button>
                ou
                <button onClick={() => sendMessage('Quero falar com um analista')} className="ml-2 text-warning underline">Falar com analista</button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  index: number;
  userInitials: string;
  onOptionClick: (option: string) => void;
  onDraftConfirm: (draftId: string) => void;
  onDraftCancel: (draftId: string) => void;
  onToggleDecision: (id: number | null) => void;
  isExpanded: boolean;
  formatTime: (iso: string) => string;
  getConfidenceColor: (conf: number) => string;
}

function MessageBubble({
  message,
  index: _index,
  userInitials,
  onOptionClick,
  onDraftConfirm,
  onDraftCancel,
  onToggleDecision,
  isExpanded,
  formatTime,
  getConfidenceColor,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isAnalyst = message.role === 'analyst';
  const isAssistant = message.role === 'assistant';

  const actionChips = message.decision?.rulesApplied?.map((rule, i) => (
    <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
      {rule}
    </span>
  ));

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
          {isAssistant ? (
            <svg width="16" height="16" viewBox="0 0 24.388 20.639" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
              <path d="M21.763 0.24493l-3.374 1.687c-0.623 0.308-0.973 0.903-0.973 1.631l0 6.293-11.193-9.429c-0.623-0.469-1.372-0.553-2.03-0.245l-3.185 1.631c-0.651 0.322-1.008 0.924-1.008 1.673l0 15.218c0 1.477 1.526 2.289 2.716 1.785l3.073-1.617c0.693-0.322 1.057-0.952 1.057-1.722l0-7.7 11.732 10.591c0.602 0.546 1.421 0.679 2.086 0.364l2.786-1.505c0.602-0.315 0.938-0.931 0.938-1.68l0-15.288c0-1.463-1.505-2.275-2.625-1.687z" fill="currentColor" />
            </svg>
          ) : isAnalyst ? (
            <span className="text-sm font-medium text-violet-text">N2</span>
          ) : (
            <span className="text-xs font-medium text-ink-3">⚙</span>
          )}
        </div>
      )}

      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        {!isUser && message.decision && (
          <div className="flex flex-wrap gap-1.5 mb-1.5" style={{ justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
            {actionChips}
            <button
              onClick={() => onToggleDecision(isExpanded ? null : message.id)}
              className="px-2 py-0.5 text-xs rounded-full bg-violet/10 text-violet-text border border-violet/20 hover:bg-violet/20 transition-colors"
            >
              {isExpanded ? 'Ocultar decisão' : 'Ver decisão'}
            </button>
          </div>
        )}

        <div
          className={`
            rounded-radius-14 px-4 py-3 ${isUser ? 'bg-primary text-white rounded-tr-sm' : 'bg-white border border-rule rounded-tl-sm'}
            ${isSystem ? 'bg-blue-50 border-2 border-primary rounded-radius-14' : ''}
            ${isAnalyst ? 'bg-violet-50 border-2 border-violet rounded-radius-14' : ''}
          `}
        >
          <p className={isUser ? 'text-white' : 'text-ink'} style={{ fontFamily: 'var(--font-schibsted-grotesk)' }}>
            {message.content}
          </p>

          {message.ui && (
            <div className="mt-3" style={{ fontFamily: 'var(--font-schibsted-grotesk)' }}>
              {message.ui.kind === 'options' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium" style={{ color: isUser ? 'rgba(255,255,255,0.9)' : 'var(--ink-2)' }}>
                    {message.ui.question}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {message.ui.options?.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => onOptionClick(opt)}
                        className="btn-secondary text-sm px-3 py-1.5"
                      >
                        {i + 1}. {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {message.ui.kind === 'ticket_card' && (
                <TicketCard ticketNumber={message.ui.ticketNumber!} />
              )}

              {message.ui.kind === 'draft' && (
                <ConfirmationCard
                  draftId={message.ui.draftId!}
                  onConfirm={onDraftConfirm}
                  onCancel={onDraftCancel}
                />
              )}
            </div>
          )}

          <p className={`mt-2 text-xs ${isUser ? 'text-white/70' : 'text-ink-3'}`}>
            {formatTime(message.createdAt)}
            {isAnalyst && ' · Analista'}
          </p>
        </div>

        {isExpanded && message.decision && (
          <DecisionPanel decision={message.decision} getConfidenceColor={getConfidenceColor} />
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-medium">{userInitials}</span>
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticketNumber }: { ticketNumber: string }) {
  return (
    <div className="ticket-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-medium text-primary">{ticketNumber}</span>
            <span className="px-2 py-0.5 text-xs rounded-radius-6 bg-primary/10 text-primary">Aberto</span>
          </div>
          <p className="text-sm text-ink-2">Chamado criado com sucesso. Um analista irá analisar em breve.</p>
        </div>
      </div>
    </div>
  );
}

function ConfirmationCard({
  draftId,
  onConfirm,
  onCancel,
}: { draftId: string; onConfirm: (id: string) => void; onCancel: (id: string) => void }) {
  return (
    <div className="confirmation-card">
      <div className="flex items-center gap-2 mb-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
          <path d="M9 12l2 2 4-4"></path>
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
        <span className="font-medium text-primary">Confirmar abertura do chamado?</span>
      </div>
      <p className="text-sm text-ink-2 mb-4">Revise os dados abaixo antes de confirmar. O chamado será criado no sistema legado.</p>
      <div className="flex gap-2">
        <button onClick={() => onConfirm(draftId)} className="btn-primary flex-1">
          Confirmar e criar chamado
        </button>
        <button onClick={() => onCancel(draftId)} className="btn-secondary flex-1">
          Cancelar
        </button>
      </div>
      <p className="text-xs text-ink-3 mt-2 text-center">Atalho: ⌘+Enter para confirmar</p>
    </div>
  );
}

function DecisionPanel({
  decision,
  getConfidenceColor,
}: { decision: Message['decision']; getConfidenceColor: (conf: number) => string }) {
  if (!decision) return null;

  return (
    <div className="mt-3 p-3 rounded-radius-10 bg-desk border border-rule" style={{ fontFamily: 'var(--font-schibsted-grotesk)' }}>
      <div className="space-y-3 text-sm">
        <div>
          <p className="font-medium text-ink-2 mb-1">O que entendi</p>
          <p className="text-ink">{decision.understood}</p>
        </div>
        <div>
          <p className="font-medium text-ink-2 mb-1">Ação</p>
          <p className="text-ink">{decision.action}</p>
        </div>
        <div>
          <p className="font-medium text-ink-2 mb-1">Confiança</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-rule rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${decision.confidence * 100}%`,
                  backgroundColor: getConfidenceColor(decision.confidence),
                }}
              />
            </div>
            <span className={getConfidenceColor(decision.confidence)} font-mono font-medium>
              {(decision.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        <div>
          <p className="font-medium text-ink-2 mb-1">Por quê</p>
          <p className="text-ink">{decision.reasoning}</p>
        </div>
        {decision.rulesApplied.length > 0 && (
          <div>
            <p className="font-medium text-ink-2 mb-1">Regras aplicadas</p>
            <ul className="list-disc list-inside space-y-1 text-ink-2">
              {decision.rulesApplied.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}