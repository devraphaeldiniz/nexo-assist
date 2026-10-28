import { scenarios, EvalScenario } from './cenarios';
import { runAgent } from '@/agent/nexo-agent';
import { db } from '@/db';
import { users, conversations, messages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getClock } from '@/lib/clock';
import { createLogger } from '@/lib/logger';

const logger = createLogger();

interface EvalResult {
  scenario: string;
  passed: boolean;
  actualIntent: string;
  expectedIntent: string;
  confidence: number;
  minConfidence: number | undefined;
  errors: string[];
  costUsd: number;
  latencyMs: number;
}

async function getUserByName(name: string) {
  const user = await db.select().from(users).where(eq(users.name, name)).limit(1);
  return user[0];
}

async function getOrCreateConversationForUser(userId: number) {
  const existing = await db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(conversations.createdAt).limit(1);
  if (existing[0]) return existing[0];
  
  const [conv] = await db.insert(conversations).values({
    userId,
    state: 'agent',
    messageCount: 0,
    sessionStartedAt: getClock().now(),
  }).returning();
  if (!conv) {
    throw new Error('Falha ao criar conversa para usuário');
  }
  return conv;
}

async function runScenario(scenario: EvalScenario): Promise<EvalResult> {
  const errors: string[] = [];
  let totalCost = 0;
  let totalLatency = 0;
  let lastIntent = '';
  let lastConfidence = 0;

  const userMap: Record<string, string> = {
    ana: 'Ana Souza',
    carla: 'Carla Mendes',
    bruno: 'Bruno Tavares',
    diego: 'Diego Ramos',
    elisa: 'Elisa Prado',
    fabio: 'Fábio Nunes',
    gabriela: 'Gabriela Rocha',
    helena: 'Helena Costa',
  };

  const userName = userMap[scenario.user];
  const user = await getUserByName(userName);
  if (!user) {
    return {
      scenario: scenario.name,
      passed: false,
      actualIntent: 'ERROR',
      expectedIntent: scenario.expectedIntent,
      confidence: 0,
      minConfidence: scenario.minConfidence,
      errors: [`User ${userName} not found`],
      costUsd: 0,
      latencyMs: 0,
    };
  }

  const conversation = await getOrCreateConversationForUser(user.id);

  for (const message of scenario.messages) {
    const start = Date.now();
    try {
      const result = await runAgent(message, {
        conversationId: conversation.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userDepartment: user.department,
        conversationState: 'agent',
        recentMessages: [],
        currentDate: getClock().now().toISOString(),
      });

      if (!result) {
        throw new Error('Agent returned undefined response');
      }
      
      const latency = Date.now() - start;
      totalLatency += latency;
      lastIntent = result.decision.intent;
      lastConfidence = result.decision.confidence;
      
      // Estimar custo (Haiku: ~$0.25/M in, $1.25/M out)
      const tokensIn = message.length / 4;
      const tokensOut = result.message.length / 4;
      totalCost += (tokensIn / 1_000_000) * 0.25 + (tokensOut / 1_000_000) * 1.25;
      
      // Persistir mensagem para manter contexto
      await db.insert(messages).values({
        conversationId: conversation.id,
        role: 'user',
        content: message,
      });
      await db.insert(messages).values({
        conversationId: conversation.id,
        role: 'assistant',
        content: result.message,
        decisionTrace: result.decision,
      });
    } catch (error) {
      errors.push(`Agent error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  // Verificações
  if (lastIntent !== scenario.expectedIntent) {
    errors.push(`Intent: expected "${scenario.expectedIntent}", got "${lastIntent}"`);
  }

  if (scenario.expectedActionContains && !scenario.messages.join(' ').toLowerCase().includes(scenario.expectedActionContains.toLowerCase())) {
    // Verificar na última resposta do agent
    const lastMessages = await db.select().from(messages).where(eq(messages.conversationId, conversation.id)).orderBy(messages.createdAt).limit(2);
    const lastAssistantMsg = lastMessages.find(m => m.role === 'assistant');
    if (lastAssistantMsg && !lastAssistantMsg.content.toLowerCase().includes(scenario.expectedActionContains.toLowerCase())) {
      errors.push(`Action should contain "${scenario.expectedActionContains}"`);
    }
  }

  if (scenario.minConfidence && lastConfidence < scenario.minConfidence) {
    errors.push(`Confidence ${lastConfidence.toFixed(2)} below minimum ${scenario.minConfidence}`);
  }

  if (scenario.mustNotOpenTicket && lastIntent === 'abrir_chamado') {
    errors.push('Should not open ticket for this scenario');
  }

  if (scenario.mustTransfer && lastIntent !== 'falar_com_analista') {
    errors.push('Should transfer to analyst');
  }

  return {
    scenario: scenario.name,
    passed: errors.length === 0,
    actualIntent: lastIntent,
    expectedIntent: scenario.expectedIntent,
    confidence: lastConfidence,
    minConfidence: scenario.minConfidence,
    errors,
    costUsd: totalCost,
    latencyMs: totalLatency,
  };
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║              NEXO ASSIST - AGENT EVALUATION                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`\nRunning ${scenarios.length} scenarios...\n`);

  const results: EvalResult[] = [];
  let totalCost = 0;
  let totalLatency = 0;
  let passedCount = 0;

  for (const scenario of scenarios) {
    process.stdout.write(`  ${scenario.name}... `);
    const result = await runScenario(scenario);
    results.push(result);
    
    totalCost += result.costUsd;
    totalLatency += result.latencyMs;
    
    if (result.passed) {
      passedCount++;
      console.log('✅ PASS');
    } else {
      console.log('❌ FAIL');
      result.errors.forEach(e => console.log(`    → ${e}`));
    }
  }

  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                        SUMMARY                                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`\n  Total scenarios: ${scenarios.length}`);
  console.log(`  Passed: ${passedCount} (${((passedCount / scenarios.length) * 100).toFixed(1)}%)`);
  console.log(`  Failed: ${scenarios.length - passedCount}`);
  console.log(`  Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`  Estimated cost: $${totalCost.toFixed(6)}`);
  console.log(`  Total latency: ${totalLatency}ms`);
  console.log(`  Avg latency per scenario: ${Math.round(totalLatency / scenarios.length)}ms`);

  console.log('\n  Per-scenario breakdown:');
  results.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    console.log(`    ${status} ${r.scenario}: intent=${r.actualIntent} (exp: ${r.expectedIntent}), conf=${(r.confidence*100).toFixed(0)}%, $${r.costUsd.toFixed(6)}`);
  });

  // Salvar relatório
  const report = {
    timestamp: new Date().toISOString(),
    model: process.env.LLM_MODEL || 'claude-3-haiku-20240307',
    totalScenarios: scenarios.length,
    passed: passedCount,
    failed: scenarios.length - passedCount,
    avgConfidence,
    totalCostUsd: totalCost,
    totalLatencyMs: totalLatency,
    results,
  };

  const fs = await import('fs');
  const path = await import('path');
  const reportPath = path.join(process.cwd(), 'eval-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to ${reportPath}`);

  process.exit(passedCount === scenarios.length ? 0 : 1);
}

main().catch(console.error);