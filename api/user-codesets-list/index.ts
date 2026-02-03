import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { createErrorResponse, createSuccessResponse } from '../lib/azuresql';
import { verifySupabaseToken } from '../lib/supabase-auth';
import sql from 'mssql';

interface SavedCodeSetConcept {
  hierarchy_concept_id: number;
  concept_name: string;
  vocabulary_id: string;
  concept_class_id: string;
  root_term: string;
  domain_id: string;
}

interface SavedUMLSConcept {
  code: string;
  vocabulary: string;
  term: string;
  sourceConcept: string;
}

interface SaveCodeSetRequest {
  supabase_user_id: string;
  code_set_name: string;
  description?: string;
  concepts: SavedCodeSetConcept[] | SavedUMLSConcept[];
  total_concepts?: number;
  source_type: 'OMOP' | 'UMLS';
  source_metadata?: string;
  build_type?: 'hierarchical' | 'direct' | 'labtest';
  anchor_concept_ids?: number[];
  build_parameters?: {
    combo_filter?: 'ALL' | 'SINGLE' | 'COMBINATION';
    domain_id?: string;
  };
}

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('=== user-codesets-list called ===');

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 200, headers, body: { ok: true } };
        return;
    }

    try {
        const user = await verifySupabaseToken(req);
        if (!user) {
            context.res = {
                status: 401,
                headers,
                body: createErrorResponse('Unauthorized', 401)
            };
            return;
        }

        const userId = user.id;
        context.log('📋 GET Code Sets - userId:', userId);

        const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');
        const request = pool.request();

        const query = \
          SELECT
            id,
            code_set_name,
            description,
            total_concepts,
            source_type,
            source_metadata,
            is_materialized,
            created_at,
            updated_at
          FROM saved_code_sets
          WHERE supabase_user_id = @supabase_user_id
          ORDER BY created_at DESC;
        \;

        request.input('supabase_user_id', sql.UniqueIdentifier, userId);
        const result = await request.query(query);

        context.log('✅ Retrieved', result.recordset.length, 'code sets for user:', userId);
        context.res = { 
            status: 200, 
            headers, 
            body: createSuccessResponse(result.recordset) 
        };
    } catch (error) {
        context.log.error('user-codesets-list error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        context.res = {
            status: 500,
            headers,
            body: createErrorResponse(message, 500)
        };
    }
};

export default httpTrigger;
