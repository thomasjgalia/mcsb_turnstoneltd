// ============================================================================
// API Endpoint: OpenAI Chat Assistant
// ============================================================================
// Vercel Serverless Function
// Endpoint: POST /api/chat
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createErrorResponse, createSuccessResponse } from './lib/azuresql.js';
import { verifySupabaseToken } from './lib/supabase-auth.js';
import OpenAI from 'openai';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

const SYSTEM_PROMPT = `You are the Medical Code Set Builder Assistant.
You ONLY help users identify good starting points for creating clinical code sets.
You support:
- interpreting medical terms or codes
- suggesting related concepts to search
- choosing likely vocabularies/domains
- recommending refined or alternative search terms

You MUST stay strictly on medical code–related topics.
If a user asks anything unrelated (weather, politics, jokes, personal advice, etc.), reply:
"I can only help with medical code set questions. Please provide a clinical term or code."

Do NOT provide medical advice, diagnoses, or treatment recommendations.

You work only with these OMOP vocabularies and domains:

• Condition — ICD10CM, ICD9CM, SNOMED
• Drug — NDC, RxNorm, ATC
• Procedure — CPT4, HCPCS
• Measurement — LOINC
• Observation — SNOMED

IMPORTANT: When identifying medical codes, ALWAYS specify which OMOP domain they belong to (Condition, Drug, Procedure, Measurement, or Observation).

Whenever possible, include medical code(s)/domain(s) in your response.

When input is unclear, ask focused clarifying questions ONLY about medical terminology.
Keep responses concise, neutral, and domain‑specific.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Chat API called ===', req.method);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    // Verify Supabase JWT token
    const user = await verifySupabaseToken(req);
    if (!user) {
      return res.status(401).json(createErrorResponse('Unauthorized', 401));
    }

    const { messages } = req.body as ChatRequest;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json(createErrorResponse('Messages array is required', 400));
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Add system prompt if not already present
    const messagesWithSystem: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.filter(m => m.role !== 'system'), // Remove any existing system messages
    ];

    console.log('📤 Sending request to OpenAI with', messagesWithSystem.length, 'messages');

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-effective model for this use case
      messages: messagesWithSystem,
      temperature: 0.7,
      max_tokens: 500, // Keep responses concise
    });

    const assistantMessage = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

    console.log('✅ OpenAI response received:', assistantMessage.substring(0, 100) + '...');

    return res.status(200).json(createSuccessResponse({
      message: assistantMessage,
      usage: completion.usage,
    }));
  } catch (error) {
    console.error('Chat API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json(createErrorResponse(message, 500));
  }
}
