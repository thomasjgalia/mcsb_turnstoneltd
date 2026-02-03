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
    context.log('=== user-codesets-detail called ===');

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

        const codeSetId = req.params.codeSetId;
        context.log('[DETAIL] GET Code Set Detail - codeSetId:', codeSetId);

        if (!codeSetId) {
            context.res = { 
                status: 400, 
                headers, 
                body: createErrorResponse('Code set ID is required', 400) 
            };
            return;
        }

        const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');
        const request = pool.request();

        const query = `
          SELECT
            id,
            supabase_user_id,
            code_set_name,
            description,
            concepts,
            total_concepts,
            source_type,
            source_metadata,
            build_type,
            anchor_concepts,
            build_parameters,
            is_materialized,
            created_at,
            updated_at
          FROM saved_code_sets
          WHERE id = @id;
        `;

        request.input('id', sql.Int, parseInt(codeSetId));
        const result = await request.query(query);

        if (result.recordset.length === 0) {
            context.log.warn('[ERROR] Code set not found:', codeSetId);
            context.res = { 
                status: 404, 
                headers, 
                body: createErrorResponse('Code set not found', 404) 
            };
            return;
        }

        const codeSet = result.recordset[0];

        if (codeSet.supabase_user_id.toLowerCase() !== user.id.toLowerCase()) {
            context.log.warn('[ERROR] User not authorized for code set:', codeSetId);
            context.res = { 
                status: 403, 
                headers, 
                body: createErrorResponse('Forbidden', 403) 
            };
            return;
        }

        context.log('[DETAIL] Retrieved code set from DB:', {
            id: codeSetId,
            name: codeSet.code_set_name,
            source_type: codeSet.source_type,
            total_concepts: codeSet.total_concepts,
            is_materialized: codeSet.is_materialized,
            build_type: codeSet.build_type,
            conceptsFieldLength: codeSet.concepts?.length || 0,
            conceptsPreview: codeSet.concepts?.substring(0, 200)
        });

        const parsedConcepts = codeSet.concepts ? JSON.parse(codeSet.concepts) : [];
        const parsedAnchorConcepts = codeSet.anchor_concepts ? JSON.parse(codeSet.anchor_concepts) : null;
        const parsedBuildParams = codeSet.build_parameters ? JSON.parse(codeSet.build_parameters) : null;

        const response = {
            ...codeSet,
            concepts: parsedConcepts,
            anchor_concept_ids: parsedAnchorConcepts,
            build_parameters: parsedBuildParams,
        };

        context.log('[SUCCESS] Retrieved code set detail:', codeSetId,
                    '- parsed concepts count:', parsedConcepts.length,
                    'DB total_concepts:', codeSet.total_concepts,
                    'is_materialized:', codeSet.is_materialized);
        context.res = { 
            status: 200, 
            headers, 
            body: createSuccessResponse(response) 
        };
    } catch (error) {
        context.log.error('user-codesets-detail error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        context.res = {
            status: 500,
            headers,
            body: createErrorResponse(message, 500)
        };
    }
};

export default httpTrigger;
