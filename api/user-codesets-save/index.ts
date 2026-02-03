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
    context.log('=== user-codesets-save called ===');

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

        const {
            supabase_user_id,
            code_set_name,
            description,
            concepts,
            total_concepts: providedTotalConcepts,
            source_type,
            source_metadata,
            build_type,
            anchor_concept_ids,
            build_parameters,
        } = req.body as SaveCodeSetRequest;

        if (supabase_user_id !== user.id) {
            context.res = { 
                status: 403, 
                headers, 
                body: createErrorResponse('Forbidden', 403) 
            };
            return;
        }

        if (!code_set_name || !concepts || concepts.length === 0) {
            context.res = { 
                status: 400, 
                headers, 
                body: createErrorResponse('Code set name and concepts are required', 400) 
            };
            return;
        }

        if (!source_type || (source_type !== 'OMOP' && source_type !== 'UMLS')) {
            context.res = { 
                status: 400, 
                headers, 
                body: createErrorResponse('Valid source_type is required (OMOP or UMLS)', 400) 
            };
            return;
        }

        const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');
        const request = pool.request();

        const totalConcepts = providedTotalConcepts || concepts.length;
        const LARGE_CODESET_THRESHOLD = 500;
        const isLargeCodeSet = totalConcepts >= LARGE_CODESET_THRESHOLD;
        const isMaterialized = !isLargeCodeSet;

        let conceptsJson: string;
        let anchorConceptsJson: string | null = null;
        let buildParamsJson: string | null = null;

        if (isLargeCodeSet) {
            context.log(`[SAVE] Saving LARGE ${source_type} code set (anchor-only):`, {
                name: code_set_name,
                totalConcepts,
                anchorConceptIds: anchor_concept_ids,
                buildType: build_type,
                buildParameters: build_parameters
            });

            if (!anchor_concept_ids || anchor_concept_ids.length === 0) {
                context.res = { 
                    status: 400, 
                    headers, 
                    body: createErrorResponse('anchor_concept_ids required for large code sets', 400) 
                };
                return;
            }
            if (!build_type) {
                context.res = { 
                    status: 400, 
                    headers, 
                    body: createErrorResponse('build_type required for large code sets', 400) 
                };
                return;
            }

            conceptsJson = JSON.stringify(concepts);
            anchorConceptsJson = JSON.stringify(anchor_concept_ids);
            buildParamsJson = JSON.stringify(build_parameters || {});
        } else {
            conceptsJson = JSON.stringify(concepts);
            context.log(`[SAVE] Saving SMALL ${source_type} code set (materialized):`, {
                name: code_set_name,
                conceptsCount: totalConcepts,
                conceptsJsonLength: conceptsJson.length,
                firstConcept: concepts[0],
                lastConcept: concepts[concepts.length - 1]
            });
        }

        const query = `
          INSERT INTO saved_code_sets
            (supabase_user_id, code_set_name, description, concepts, total_concepts, source_type, source_metadata,
             build_type, anchor_concepts, build_parameters, is_materialized)
          VALUES
            (@supabase_user_id, @code_set_name, @description, @concepts, @total_concepts, @source_type, @source_metadata,
             @build_type, @anchor_concepts, @build_parameters, @is_materialized);

          SELECT SCOPE_IDENTITY() AS id;
        `;

        request.input('supabase_user_id', sql.UniqueIdentifier, supabase_user_id);
        request.input('code_set_name', sql.NVarChar(200), code_set_name);
        request.input('description', sql.NVarChar(sql.MAX), description || null);
        request.input('concepts', sql.NVarChar(sql.MAX), conceptsJson);
        request.input('total_concepts', sql.Int, totalConcepts);
        request.input('source_type', sql.VarChar(10), source_type);
        request.input('source_metadata', sql.NVarChar(sql.MAX), source_metadata || null);
        request.input('build_type', sql.VarChar(20), build_type || null);
        request.input('anchor_concepts', sql.NVarChar(sql.MAX), anchorConceptsJson);
        request.input('build_parameters', sql.NVarChar(sql.MAX), buildParamsJson);
        request.input('is_materialized', sql.Bit, isMaterialized);

        const result = await request.query(query);
        const id = result.recordset[0].id;

        context.log(`[SUCCESS] ${source_type} code set saved:`, id, `with ${totalConcepts} concepts`,
                    isLargeCodeSet ? '(anchor-only, needs rebuild on load)' : '(fully materialized)');
        context.res = { 
            status: 200, 
            headers, 
            body: createSuccessResponse({ id }) 
        };
    } catch (error) {
        context.log.error('user-codesets-save error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        context.res = {
            status: 500,
            headers,
            body: createErrorResponse(message, 500)
        };
    }
};

export default httpTrigger;
