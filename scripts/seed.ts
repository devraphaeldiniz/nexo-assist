import { db } from '@/db';
import { users, helpArticles, tickets, conversations, messages, ticketEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getClock, Clock } from '@/lib/clock';
import { calculateSLA, Priority } from '@/services/sla';
import { createTicketClient } from '@/services/tickets/client';

const clock = getClock();

function daysAgo(days: number): Date {
  const date = clock.now();
  date.setDate(date.getDate() - days);
  return date;
}

function hoursAgo(hours: number): Date {
  const date = clock.now();
  date.setHours(date.getHours() - hours);
  return date;
}

async function seedUsers() {
  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) return;

  const employees = [
    { email: 'ana.souza@nexo.com.br', name: 'Ana Souza', department: 'Financeiro', role: 'employee' as const, avatarInitials: 'AS' },
    { email: 'carla.mendes@nexo.com.br', name: 'Carla Mendes', department: 'Marketing', role: 'employee' as const, avatarInitials: 'CM' },
    { email: 'bruno.tavares@nexo.com.br', name: 'Bruno Tavares', department: 'Vendas', role: 'employee' as const, avatarInitials: 'BT' },
    { email: 'diego.ramos@nexo.com.br', name: 'Diego Ramos', department: 'RH', role: 'employee' as const, avatarInitials: 'DR' },
    { email: 'elisa.prado@nexo.com.br', name: 'Elisa Prado', department: 'Operações', role: 'employee' as const, avatarInitials: 'EP' },
    { email: 'fabio.nunes@nexo.com.br', name: 'Fábio Nunes', department: 'Jurídico', role: 'employee' as const, avatarInitials: 'FN' },
    { email: 'gabriela.rocha@nexo.com.br', name: 'Gabriela Rocha', department: 'Produto', role: 'employee' as const, avatarInitials: 'GR' },
    { email: 'helena.costa@nexo.com.br', name: 'Helena Costa', department: 'TI', role: 'employee' as const, avatarInitials: 'HC' },
  ];

  const analysts = [
    { email: 'rafael.lima@nexo.com.br', name: 'Rafael Lima', department: 'Suporte N2', role: 'analyst' as const, avatarInitials: 'RL' },
    { email: 'marina.silva@nexo.com.br', name: 'Marina Silva', department: 'Suporte N1', role: 'analyst' as const, avatarInitials: 'MS' },
  ];

  const allUsers = [...employees, ...analysts];

  for (const user of allUsers) {
    await db.insert(users).values({
      ...user,
      createdAt: clock.now(),
    });
  }

  console.log(`Seeded ${allUsers.length} users`);
}

async function seedHelpArticles() {
  const existing = await db.select().from(helpArticles).limit(1);
  if (existing.length > 0) return;

  const articles = [
    {
      title: 'Erro 809 na VPN - Apenas Windows 10',
      content: 'O erro 809 na VPN ocorre apenas em máquinas com Windows 10. No Windows 11, a VPN funciona normalmente. Se você usa Windows 10 e encontra este erro, abra um chamado do tipo Incidente na categoria Rede e VPN com prioridade Alta.',
      category: 'Rede e VPN',
      tags: ['vpn', 'erro 809', 'windows 10', 'rede'],
    },
    {
      title: 'Horário do Service Desk',
      content: 'O service desk funciona de segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24h. Fora do horário comercial, apenas chamados críticos recebem resposta imediata. Os demais são atendidos no próximo dia útil.',
      category: 'Geral',
      tags: ['horário', 'atendimento', 'plantão', 'sla'],
    },
    {
      title: 'Reset de Senha - Autosserviço',
      content: 'Para redefinir sua senha, acesse o portal de identidade da Nexo e clique em "Esqueci minha senha". Você receberá um e-mail com instruções. Se não receber em 5 minutos, verifique a caixa de spam ou abra um chamado.',
      category: 'Acesso',
      tags: ['senha', 'reset', 'autosserviço', 'identidade'],
    },
    {
      title: 'Configurar Wi-Fi Corporativo no Celular',
      content: '1. Vá em Configurações > Wi-Fi. 2. Selecione "Nexo-Corp". 3. Use seu e-mail corporativo e senha. 4. Confie no certificado se solicitado. Se não conectar, esqueça a rede e tente novamente.',
      category: 'Rede e VPN',
      tags: ['wi-fi', 'celular', 'corporativo', 'configuração'],
    },
    {
      title: 'Configurar E-mail Corporativo no Celular',
      content: 'Use as configurações: Servidor: outlook.office365.com, Porta: 993 (IMAP) / 587 (SMTP), SSL/TLS ativado. Usuário: seu e-mail completo. Senha: sua senha corporativa.',
      category: 'E-mail',
      tags: ['e-mail', 'celular', 'configuração', 'outlook'],
    },
    {
      title: 'Solicitar Software Corporativo',
      content: 'Acesse o catálogo de software no portal da TI. Softwares pré-aprovados instalam automaticamente. Para outros, abra um chamado do tipo Requisição na categoria Software. Aprovação do gestor é necessária.',
      category: 'Software',
      tags: ['software', 'instalação', 'catálogo', 'aprovação'],
    },
    {
      title: 'Solicitar Equipamento ou Monitor',
      content: 'Abra um chamado do tipo Requisição na categoria Hardware. Inclua justificativa e aprovação do gestor. Prazo de entrega: até 5 dias úteis após aprovação.',
      category: 'Hardware',
      tags: ['equipamento', 'monitor', 'hardware', 'requisição'],
    },
    {
      title: 'Problemas com Impressora',
      content: 'Verifique se a impressora está ligada e conectada à rede. Reinicie o spooler de impressão (services.msc > Print Spooler > Reiniciar). Se persistir, abra chamado na categoria Hardware.',
      category: 'Hardware',
      tags: ['impressora', 'impressão', 'spooler', 'hardware'],
    },
    {
      title: 'Desbloqueio de Conta e MFA',
      content: 'Após 5 tentativas incorretas, a conta é bloqueada por 15 minutos. Para desbloqueio imediato, abra chamado na categoria Acesso. Para reconfigurar MFA, use o portal de identidade ou abra chamado.',
      category: 'Acesso',
      tags: ['bloqueio', 'conta', 'mfa', 'autenticação', 'acesso'],
    },
  ];

  for (const article of articles) {
    await db.insert(helpArticles).values({
      ...article,
      createdAt: clock.now(),
      updatedAt: clock.now(),
    });
  }

  console.log(`Seeded ${articles.length} help articles`);
}

async function seedTickets() {
  const existing = await db.select().from(tickets).limit(1);
  if (existing.length > 0) return;

  const allUsers = await db.select().from(users);
  const userMap = new Map(allUsers.map(u => [u.email, u]));

  const ana = userMap.get('ana.souza@nexo.com.br')!;
  const carla = userMap.get('carla.mendes@nexo.com.br')!;
  const bruno = userMap.get('bruno.tavares@nexo.com.br')!;
  const diego = userMap.get('diego.ramos@nexo.com.br')!;
  const elisa = userMap.get('elisa.prado@nexo.com.br')!;
  const fabio = userMap.get('fabio.nunes@nexo.com.br')!;
  const gabriela = userMap.get('gabriela.rocha@nexo.com.br')!;
  const helena = userMap.get('helena.costa@nexo.com.br')!;
  const rafael = userMap.get('rafael.lima@nexo.com.br')!;
  const marina = userMap.get('marina.silva@nexo.com.br')!;

  const ticketData = [
    {
      number: 'INC-20311',
      title: 'Notebook lento',
      description: 'Meu notebook está muito lento desde a última atualização do Windows. Leva mais de 5 minutos para iniciar e os programas travam constantemente.',
      type: 'INC' as const,
      category: 'Hardware',
      priority: 'media' as Priority,
      status: 'aguardando_usuario' as const,
      requesterId: ana.id,
      assigneeId: rafael.id,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(1),
    },
    {
      number: 'INC-20298',
      title: 'Acesso à pasta Financeiro no SharePoint',
      description: 'Preciso de acesso à pasta "Financeiro 2024" no SharePoint para o fechamento mensal. Meu gestor já aprovou.',
      type: 'INC' as const,
      category: 'Acesso',
      priority: 'alta' as Priority,
      status: 'em_andamento' as const,
      requesterId: ana.id,
      assigneeId: marina.id,
      createdAt: daysAgo(2),
      updatedAt: hoursAgo(3),
    },
    {
      number: 'REQ-10442',
      title: 'Segundo monitor',
      description: 'Gostaria de solicitar um segundo monitor para aumentar produtividade. Meu gestor (Carlos) já aprovou por e-mail.',
      type: 'REQ' as const,
      category: 'Hardware',
      priority: 'baixa' as Priority,
      status: 'aprovado' as const,
      requesterId: ana.id,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(8),
    },
    {
      number: 'INC-19877',
      title: 'VPN erro 809 - Windows 10',
      description: 'Não consigo conectar na VPN, dá erro 809. Uso Windows 10.',
      type: 'INC' as const,
      category: 'Rede e VPN',
      priority: 'alta' as Priority,
      status: 'resolvido' as const,
      requesterId: carla.id,
      resolvedAt: daysAgo(3),
      createdAt: daysAgo(7),
      updatedAt: daysAgo(3),
    },
    {
      number: 'INC-19410',
      title: 'E-mail não sincroniza no celular',
      description: 'Meu e-mail corporativo parou de sincronizar no celular há 2 dias. Já tentei remover e adicionar a conta novamente.',
      type: 'INC' as const,
      category: 'E-mail',
      priority: 'media' as Priority,
      status: 'resolvido' as const,
      requesterId: carla.id,
      resolvedAt: daysAgo(10),
      createdAt: daysAgo(15),
      updatedAt: daysAgo(10),
    },
    {
      number: 'INC-19555',
      title: 'Wi-Fi corporativo não conecta',
      description: 'Não consigo conectar no Wi-Fi Nexo-Corp. Outros colegas conseguem normal.',
      type: 'INC' as const,
      category: 'Rede e VPN',
      priority: 'alta' as Priority,
      status: 'resolvido' as const,
      requesterId: bruno.id,
      resolvedAt: daysAgo(2),
      createdAt: daysAgo(5),
      updatedAt: daysAgo(2),
    },
    {
      number: 'REQ-10200',
      title: 'Acesso ao sistema de CRM',
      description: 'Preciso de acesso ao CRM para a equipe de vendas. Gestora aprovou.',
      type: 'REQ' as const,
      category: 'Acesso',
      priority: 'media' as Priority,
      status: 'em_andamento' as const,
      requesterId: bruno.id,
      assigneeId: marina.id,
      createdAt: daysAgo(1),
      updatedAt: hoursAgo(2),
    },
    {
      number: 'INC-19300',
      title: 'Notebook não liga',
      description: 'Meu notebook não liga de jeito nenhum. Luz do carregador acende mas nada acontece.',
      type: 'INC' as const,
      category: 'Hardware',
      priority: 'critica' as Priority,
      status: 'resolvido' as const,
      requesterId: diego.id,
      resolvedAt: daysAgo(1),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      number: 'REQ-10150',
      title: 'Licença Adobe Creative Cloud',
      description: 'Preciso de licença do Adobe Creative Cloud para trabalho de design. Aprovação do gestor anexada.',
      type: 'REQ' as const,
      category: 'Software',
      priority: 'baixa' as Priority,
      status: 'aguardando_aprovacao' as const,
      requesterId: diego.id,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      number: 'INC-19200',
      title: 'Impressora da sala 302 não imprime',
      description: 'A impressora da sala de reunião 302 não imprime. Já reiniciamos e nada.',
      type: 'INC' as const,
      category: 'Hardware',
      priority: 'media' as Priority,
      status: 'resolvido' as const,
      requesterId: elisa.id,
      resolvedAt: daysAgo(4),
      createdAt: daysAgo(8),
      updatedAt: daysAgo(4),
    },
    {
      number: 'INC-19100',
      title: 'Conta bloqueada - muitas tentativas',
      description: 'Minha conta foi bloqueada após várias tentativas de senha errada. Preciso de desbloqueio urgente.',
      type: 'INC' as const,
      category: 'Acesso',
      priority: 'alta' as Priority,
      status: 'resolvido' as const,
      requesterId: elisa.id,
      resolvedAt: daysAgo(5),
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      number: 'REQ-10050',
      title: 'Novo headset para call center',
      description: 'Headset atual está com mau contato. Solicito substituição.',
      type: 'REQ' as const,
      category: 'Hardware',
      priority: 'baixa' as Priority,
      status: 'aberto' as const,
      requesterId: fabio.id,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      number: 'INC-19000',
      title: 'VPN conecta mas sem acesso a servidores',
      description: 'A VPN conecta normalmente mas não consigo acessar os servidores internos. Colegas conseguem.',
      type: 'INC' as const,
      category: 'Rede e VPN',
      priority: 'alta' as Priority,
      status: 'em_andamento' as const,
      requesterId: gabriela.id,
      assigneeId: rafael.id,
      createdAt: hoursAgo(4),
      updatedAt: hoursAgo(1),
    },
    {
      number: 'INC-18900',
      title: 'Erro ao abrir Excel - arquivo corrompido',
      description: 'Todos os arquivos Excel da pasta compartilhada dão erro de arquivo corrompido. Outros formatos abrem normal.',
      type: 'INC' as const,
      category: 'Software',
      priority: 'media' as Priority,
      status: 'aberto' as const,
      requesterId: helena.id,
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(2),
    },
    {
      number: 'INC-18800',
      title: 'Notebook da Carla - VPN erro 809 (OUTRO USUÁRIO)',
      description: 'VPN erro 809 no notebook da Carla. Windows 10.',
      type: 'INC' as const,
      category: 'Rede e VPN',
      priority: 'alta' as Priority,
      status: 'aberto' as const,
      requesterId: fabio.id,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  ];

  for (const data of ticketData) {
    const priority = data.priority as Priority;
    const dueAt = calculateSLA(data.createdAt, priority, clock).dueAt;

    const [ticket] = await db.insert(tickets).values({
      ...data,
      dueAt,
    }).returning();

    if (!ticket) {
      throw new Error('Failed to create ticket');
    }

    await db.insert(ticketEvents).values({
      ticketId: ticket.id,
      actorId: data.requesterId,
      type: 'created',
      payload: {},
    });

    if (data.assigneeId) {
      await db.insert(ticketEvents).values({
        ticketId: ticket.id,
        actorId: data.assigneeId,
        type: 'assigned',
        payload: { assigneeId: data.assigneeId },
      });
    }

    if (data.status === 'resolvido' && data.resolvedAt) {
      await db.insert(ticketEvents).values({
        ticketId: ticket.id,
        actorId: data.assigneeId || data.requesterId,
        type: 'resolved',
        payload: {},
      });
    }
  }

  console.log(`Seeded ${ticketData.length} tickets`);
}

async function seedConversations() {
  const existing = await db.select().from(conversations).limit(1);
  if (existing.length > 0) return;

  const allUsers = await db.select().from(users);
  const userMap = new Map(allUsers.map(u => [u.email, u]));

  const ana = userMap.get('ana.souza@nexo.com.br')!;
  const carla = userMap.get('carla.mendes@nexo.com.br')!;
  const bruno = userMap.get('bruno.tavares@nexo.com.br')!;
  const diego = userMap.get('diego.ramos@nexo.com.br')!;
  const elisa = userMap.get('elisa.prado@nexo.com.br')!;
  const fabio = userMap.get('fabio.nunes@nexo.com.br')!;
  const gabriela = userMap.get('gabriela.rocha@nexo.com.br')!;
  const rafael = userMap.get('rafael.lima@nexo.com.br')!;
  const marina = userMap.get('marina.silva@nexo.com.br')!;

  const ticketsList = await db.select().from(tickets);
  const ticketMap = new Map(ticketsList.map(t => [t.number, t]));

  const convData = [
    {
      userId: carla.id,
      state: 'aguardando_atendente' as const,
      analystId: marina.id,
      currentTicketId: ticketMap.get('INC-19555')?.id,
      messageCount: 8,
      sessionStartedAt: daysAgo(1),
    },
    {
      userId: bruno.id,
      state: 'aguardando_atendente' as const,
      analystId: rafael.id,
      currentTicketId: ticketMap.get('REQ-10200')?.id,
      messageCount: 5,
      sessionStartedAt: hoursAgo(3),
    },
    {
      userId: diego.id,
      state: 'agent' as const,
      currentTicketId: ticketMap.get('INC-19300')?.id,
      messageCount: 12,
      sessionStartedAt: hoursAgo(5),
    },
    {
      userId: elisa.id,
      state: 'agent' as const,
      currentTicketId: ticketMap.get('INC-19100')?.id,
      messageCount: 7,
      sessionStartedAt: hoursAgo(2),
    },
    {
      userId: fabio.id,
      state: 'encerrada' as const,
      currentTicketId: ticketMap.get('REQ-10050')?.id,
      messageCount: 6,
      sessionStartedAt: daysAgo(1),
    },
    {
      userId: gabriela.id,
      state: 'encerrada' as const,
      currentTicketId: ticketMap.get('INC-19000')?.id,
      messageCount: 9,
      sessionStartedAt: hoursAgo(6),
    },
    {
      userId: ana.id,
      state: 'aguardando_atendente' as const,
      analystId: rafael.id,
      currentTicketId: ticketMap.get('INC-20311')?.id,
      messageCount: 15,
      sessionStartedAt: daysAgo(2),
    },
  ];

  for (const data of convData) {
    const [conv] = await db.insert(conversations).values({
      ...data,
      createdAt: data.sessionStartedAt,
      updatedAt: clock.now(),
    }).returning();

    if (!conv) {
      throw new Error('Failed to create conversation');
    }

    await db.insert(messages).values({
      conversationId: conv.id,
      role: 'system',
      content: `Conversa iniciada em ${data.sessionStartedAt.toLocaleString('pt-BR')}`,
      createdAt: data.sessionStartedAt,
    });
  }

  console.log(`Seeded ${convData.length} conversations`);
}

export async function seed() {
  console.log('Starting seed...');
  await seedUsers();
  await seedHelpArticles();
  await seedTickets();
  await seedConversations();
  console.log('Seed completed!');
}

if (require.main === module) {
  seed().catch(console.error);
}