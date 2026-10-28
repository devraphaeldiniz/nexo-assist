import { db } from '@/db';
import { helpArticles } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export interface HelpArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text).split(/\s+/).filter(t => t.length > 1);
}

function bm25Score(queryTokens: string[], docTitle: string, docContent: string, docTags: string[]): number {
  const titleTokens = tokenize(docTitle);
  const contentTokens = tokenize(docContent);
  const tagTokens = docTags.flatMap(tokenize);

  const allTokens = [...titleTokens, ...contentTokens, ...tagTokens];
  const docLength = allTokens.length;
  if (docLength === 0) return 0;

  const k1 = 1.2;
  const b = 0.75;
  const avgDocLength = 100;

  let score = 0;
  for (const qToken of queryTokens) {
    const tfTitle = titleTokens.filter(t => t === qToken).length;
    const tfContent = contentTokens.filter(t => t === qToken).length;
    const tfTags = tagTokens.filter(t => t === qToken).length;
    const tf = tfTitle * 3 + tfContent + tfTags * 2;

    if (tf === 0) continue;

    const idf = Math.log(1 + 1 / 1);
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
    score += idf * (numerator / denominator);
  }

  return score;
}

export async function searchHelpArticles(query: string, limit = 5): Promise<HelpArticle[]> {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const articles = await db
    .select()
    .from(helpArticles)
    .orderBy(desc(helpArticles.createdAt));

  const scored = articles
    .map(article => ({
      article,
      score: bm25Score(queryTokens, article.title, article.content, article.tags),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.article);

  return scored;
}

export async function getAllHelpArticles(): Promise<HelpArticle[]> {
  return db
    .select()
    .from(helpArticles)
    .orderBy(desc(helpArticles.createdAt));
}

export async function getHelpArticleById(id: number): Promise<HelpArticle | null> {
  const result = await db
    .select()
    .from(helpArticles)
    .where(eq(helpArticles.id, id))
    .limit(1);
  return result[0] || null;
}

export function createHelpdeskService() {
  return {
    search: searchHelpArticles,
    getAll: getAllHelpArticles,
    getById: getHelpArticleById,
  };
}