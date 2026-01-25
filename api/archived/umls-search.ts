// ============================================================================
// API Endpoint: UMLS Search
// ============================================================================
// Vercel Serverless Function
// Endpoint: POST /api/umls-search
// Handles UMLS ticket-based authentication and search
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createErrorResponse, createSuccessResponse } from './lib/azuresql.js';
import { verifySupabaseToken } from './lib/supabase-auth.js';

interface UMLSSearchRequest {
  searchTerm: string;
  vocabularies?: string[];
  pageSize?: number;
}

interface UMLSSearchResult {
  ui: string;
  name: string;
  uri: string;
  rootSource: string;
  semanticTypes?: string[];
  sources?: SourceAtom[];
}

interface SourceAtom {
  code: string;
  sourceConcept: string;
  vocabulary: string;
  term: string;
}

// Simple in-memory cache for service tickets (valid for 8 hours)
let cachedTicket: { ticket: string; expiresAt: number } | null = null;

/**
 * Get a UMLS Service Ticket for API authentication
 * Uses TGT (Ticket Granting Ticket) to obtain a service ticket
 */
async function getServiceTicket(): Promise<string> {
  // Check if we have a valid cached ticket (with 5 min buffer)
  const now = Date.now();
  if (cachedTicket && cachedTicket.expiresAt > now + 5 * 60 * 1000) {
    console.log('✅ Using cached UMLS service ticket');
    return cachedTicket.ticket;
  }

  const apiKey = process.env.UMLS_API_KEY;
  if (!apiKey) {
    throw new Error('UMLS_API_KEY not configured');
  }

  console.log('🔑 Requesting new UMLS service ticket');

  // Step 1: Get TGT (Ticket Granting Ticket)
  const tgtResponse = await fetch('https://utslogin.nlm.nih.gov/cas/v1/api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `apikey=${encodeURIComponent(apiKey)}`,
  });

  if (!tgtResponse.ok) {
    throw new Error(`UMLS TGT request failed: ${tgtResponse.statusText}`);
  }

  const tgtText = await tgtResponse.text();

  // Extract TGT URL from the response (it's in the form action attribute)
  const tgtUrlMatch = tgtText.match(/action="([^"]+)"/);
  if (!tgtUrlMatch) {
    throw new Error('Failed to parse TGT URL from UMLS response');
  }
  const tgtUrl = tgtUrlMatch[1];

  // Step 2: Get Service Ticket using TGT
  const serviceTicketResponse = await fetch(tgtUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'service=http://umlsks.nlm.nih.gov',
  });

  if (!serviceTicketResponse.ok) {
    throw new Error(`UMLS service ticket request failed: ${serviceTicketResponse.statusText}`);
  }

  const ticket = await serviceTicketResponse.text();

  // Cache the ticket (expires in 8 hours, but we'll use 7.5 hours to be safe)
  cachedTicket = {
    ticket: ticket.trim(),
    expiresAt: now + 7.5 * 60 * 60 * 1000, // 7.5 hours
  };

  console.log('✅ New UMLS service ticket obtained and cached');
  return cachedTicket.ticket;
}

/**
 * Search UMLS API for medical terms with source codes
 */
async function searchUMLS(
  searchTerm: string,
  vocabularies?: string[],
  pageSize: number = 25
): Promise<{ results: UMLSSearchResult[]; pageCount: number; pageNumber: number; ticket: string }> {
  const ticket = await getServiceTicket();

  // Build search URL - use returnIdType=code to get source codes directly
  const params = new URLSearchParams({
    string: searchTerm,
    ticket: ticket,
    pageSize: pageSize.toString(),
    returnIdType: 'code', // Return source codes instead of CUIs
  });

  // Add vocabulary filters if specified
  if (vocabularies && vocabularies.length > 0) {
    params.append('sabs', vocabularies.join(','));
  }

  const searchUrl = `https://uts-ws.nlm.nih.gov/rest/search/current?${params.toString()}`;

  console.log('🔍 Searching UMLS:', searchTerm, vocabularies ? `(vocabularies: ${vocabularies.join(', ')})` : '');

  const response = await fetch(searchUrl);

  if (!response.ok) {
    // If ticket is invalid, clear cache and try once more
    if (response.status === 401 && cachedTicket) {
      console.warn('⚠️ UMLS ticket invalid, clearing cache and retrying');
      cachedTicket = null;
      return searchUMLS(searchTerm, vocabularies, pageSize); // Retry once
    }
    throw new Error(`UMLS search failed: ${response.statusText}`);
  }

  const data = await response.json();

  // Parse UMLS response structure
  // When returnIdType=code, results contain source codes with their vocabularies
  const results: UMLSSearchResult[] = (data.result?.results || []).map((item: any) => {
    // Create a source atom from the search result itself
    const sourceAtom: SourceAtom = {
      code: item.ui, // When returnIdType=code, ui contains the actual code
      sourceConcept: item.ui,
      vocabulary: item.rootSource,
      term: item.name,
    };

    return {
      ui: item.ui, // This is now the source code, not CUI
      name: item.name,
      uri: item.uri,
      rootSource: item.rootSource,
      semanticTypes: item.semanticTypes || [],
      sources: [sourceAtom], // Single source with the code from this vocabulary
    };
  });

  // Filter to only include specific vocabularies (using UMLS source abbreviations)
  const allowedVocabularies = [
    'ICD10CM',
    'SNOMEDCT_US',
    'ICD9CM',
    'RXNORM',
    'NDC',
    'ATC',
    'CPT',
    'HCPCS',
    'LNC'  // LOINC is abbreviated as LNC in UMLS
  ];

  // Only apply backend vocabulary filter if user didn't specify vocabularies
  // When user selects specific vocabularies, the UMLS API 'sabs' parameter handles filtering
  const filteredResults = vocabularies && vocabularies.length > 0
    ? results  // User selected specific vocabularies, trust UMLS API filtering
    : results.filter(result => allowedVocabularies.includes(result.rootSource));  // No selection, filter to allowed list

  // Sort by vocabulary (rootSource) then by code (ui)
  filteredResults.sort((a, b) => {
    if (a.rootSource !== b.rootSource) {
      return a.rootSource.localeCompare(b.rootSource);
    }
    return a.ui.localeCompare(b.ui);
  });

  console.log('✅ UMLS search returned', filteredResults.length, 'results with source codes');

  return {
    results: filteredResults,
    pageCount: data.result?.pageCount || 1,
    pageNumber: data.result?.pageNumber || 1,
    ticket, // Include ticket for authenticated links
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== UMLS Search API called ===', req.method);

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

    const { searchTerm, vocabularies, pageSize } = req.body as UMLSSearchRequest;

    if (!searchTerm || searchTerm.trim().length === 0) {
      return res.status(400).json(createErrorResponse('Search term is required', 400));
    }

    // Perform UMLS search
    const searchResults = await searchUMLS(searchTerm.trim(), vocabularies, pageSize || 25);

    return res.status(200).json(createSuccessResponse(searchResults));
  } catch (error) {
    console.error('UMLS Search API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json(createErrorResponse(message, 500));
  }
}
