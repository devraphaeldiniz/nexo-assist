export interface EvalScenario {
  name: string;
  user: 'ana' | 'carla' | 'bruno' | 'diego' | 'elisa' | 'fabio' | 'gabriela' | 'helena';
  messages: string[];
  expectedIntent: string;
  expectedActionContains?: string;
  minConfidence?: number;
  mustNotOpenTicket?: boolean;
  mustTransfer?: boolean;
}

export const scenarios: EvalScenario[] = [
  {
    name: 'VPN erro 809 Windows 11 - deve ir para rascunho',
    user: 'ana',
    messages: ['Minha VPN dá erro 809 no Windows 11'],
    expectedIntent: 'abrir_chamado',
    expectedActionContains: 'rascunho',
    minConfidence: 0.7,
  },
  {
    name: 'VPN erro 809 Windows 10 - deve responder com artigo',
    user: 'carla',
    messages: ['VPN erro 809 no meu Windows 10'],
    expectedIntent: 'duvida',
    mustNotOpenTicket: true,
    minConfidence: 0.7,
  },
  {
    name: 'Dúvida senha Wi-Fi - responde pela central sem abrir chamado',
    user: 'bruno',
    messages: ['Como configuro o Wi-Fi corporativo no celular?'],
    expectedIntent: 'duvida',
    mustNotOpenTicket: true,
    minConfidence: 0.7,
  },
  {
    name: 'Férias - redireciona para RH',
    user: 'diego',
    messages: ['Quero saber minhas férias'],
    expectedIntent: 'fora_de_escopo',
    mustNotOpenTicket: true,
    minConfidence: 0.8,
  },
  {
    name: 'Chamado vencido - oferece analista',
    user: 'ana',
    messages: ['Como está meu chamado INC-20311?'],
    expectedIntent: 'consultar_chamado',
    minConfidence: 0.7,
  },
  {
    name: 'Duplicado aberto - atualiza em vez de duplicar',
    user: 'carla',
    messages: ['Meu notebook está lento', 'Já abri chamado sobre isso antes'],
    expectedIntent: 'atualizar_chamado',
    minConfidence: 0.6,
  },
  {
    name: 'Resolvido há 3 dias voltou - reabre',
    user: 'carla',
    messages: ['O problema do INC-19877 voltou a acontecer'],
    expectedIntent: 'abrir_chamado',
    expectedActionContains: 'reabertura',
    minConfidence: 0.7,
  },
  {
    name: 'Resolvido há 10 dias - novo chamado',
    user: 'carla',
    messages: ['O problema do INC-19410 voltou'],
    expectedIntent: 'abrir_chamado',
    expectedActionContains: 'novo',
    minConfidence: 0.7,
  },
  {
    name: 'Tentativa ver chamado de outro - recusa',
    user: 'ana',
    messages: ['Qual o status do INC-19555?'], // Da Carla
    expectedIntent: 'consultar_chamado',
    minConfidence: 0.8,
  },
  {
    name: 'Sistema legado fora - avisa sem inventar',
    user: 'bruno',
    messages: ['Quero abrir chamado para notebook que não liga'],
    expectedIntent: 'abrir_chamado',
    minConfidence: 0.5, // Pode baixar se legacy falhar
  },
  {
    name: 'Prioridade compromisso hoje = Alta',
    user: 'diego',
    messages: ['Preciso de acesso ao SharePoint Financeiro para fechamento hoje às 14h'],
    expectedIntent: 'abrir_chamado',
    expectedActionContains: 'Alta',
    minConfidence: 0.7,
  },
  {
    name: 'Equipe parada = Crítica + transferência',
    user: 'elisa',
    messages: ['O sistema de vendas caiu, ninguém consegue emitir NF'],
    expectedIntent: 'abrir_chamado',
    expectedActionContains: 'Crítica',
    mustTransfer: true,
    minConfidence: 0.8,
  },
  {
    name: 'Mensagem ambígua - pergunta',
    user: 'fabio',
    messages: ['Não sei o que fazer'],
    expectedIntent: 'duvida',
    expectedActionContains: 'pergunta',
    minConfidence: 0.5,
  },
  {
    name: 'Baixa confiança - transferência',
    user: 'gabriela',
    messages: ['Xyz abc 123 coisa estranha'],
    expectedIntent: 'falar_com_analista',
    mustTransfer: true,
  },
  {
    name: 'Solicitar segundo monitor - REQ/Hardware/Baixa',
    user: 'helena',
    messages: ['Gostaria de um segundo monitor'],
    expectedIntent: 'abrir_chamado',
    expectedActionContains: 'REQ',
    minConfidence: 0.7,
  },
  {
    name: 'Reset senha - central de ajuda',
    user: 'ana',
    messages: ['Esqueci minha senha, como resetar?'],
    expectedIntent: 'duvida',
    mustNotOpenTicket: true,
    minConfidence: 0.8,
  },
  {
    name: 'Impressora não imprime - Hardware/Média',
    user: 'bruno',
    messages: ['A impressora da sala 302 não imprime nada'],
    expectedIntent: 'abrir_chamado',
    expectedActionContains: 'Hardware',
    minConfidence: 0.7,
  },
  {
    name: 'Licença software - REQ/Software/Baixa',
    user: 'diego',
    messages: ['Preciso de licença do Adobe Creative Cloud'],
    expectedIntent: 'abrir_chamado',
    expectedActionContains: 'REQ',
    minConfidence: 0.7,
  },
  {
    name: 'Conta bloqueada - Acesso/Alta',
    user: 'elisa',
    messages: ['Minha conta foi bloqueada após tentativas erradas'],
    expectedIntent: 'abrir_chamado',
    expectedActionContains: 'Alta',
    minConfidence: 0.7,
  },
  {
    name: 'Consulta chamado sem número - seletor',
    user: 'ana',
    messages: ['Como está meu chamado?'],
    expectedIntent: 'consultar_chamado',
    expectedActionContains: 'seletor',
    minConfidence: 0.7,
  },
  {
    name: 'Atualizar chamado aberto - adiciona informação',
    user: 'ana',
    messages: ['Quero adicionar info no INC-20298: o erro aparece só no Chrome'],
    expectedIntent: 'atualizar_chamado',
    minConfidence: 0.7,
  },
];