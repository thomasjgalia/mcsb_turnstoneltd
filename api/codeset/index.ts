import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import {
  executeStoredProcedure,
  createErrorResponse,
} from '../lib/azuresql';

interface CodeSetRequest {
  concept_ids: number[];
  combo_filter?: 'ALL' | 'SINGLE' | 'COMBINATION';
  build_type?: 'hierarchical' | 'direct' | 'labtest';
}

interface CodeSetResult {
  root_concept_name: string;
  child_vocabulary_id: string;
  child_code: string;
  child_name: string;
  child_concept_id: number;
  concept_class_id: string;
  combinationyesno?: string;
  dose_form?: string;
  dfg_name?: string;
  concept_attribute?: string;
  value?: string;
  relationships_json?: string | null;
  relationships?: Array<{
    relationship_id: string;
    value_name: string;
  }>;
}

function deduplicateResults(results: CodeSetResult[]): CodeSetResult[] {
  const seen = new Map<string, CodeSetResult>();

  for (const result of results) {
    const key = `${result.child_vocabulary_id}|${result.child_code}|${result.child_name}|${result.child_concept_id}|${result.concept_class_id}`;

    if (!seen.has(key)) {
      seen.set(key, result);
    }
  }

  return Array.from(seen.values());
}

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    context.res = {
      status: 200,
      headers,
      body: { ok: true }
    };
    return;
  }

  if (req.method !== 'POST') {
    context.res = {
      status: 405,
      headers,
      body: createErrorResponse('Method not allowed', 405)
    };
    return;
  }

  try {
    const { concept_ids, combo_filter = 'ALL', build_type = 'hierarchical' } = req.body as CodeSetRequest;

    if (!concept_ids || !Array.isArray(concept_ids) || concept_ids.length === 0) {
      context.res = {
        status: 400,
        headers,
        body: {
          success: false,
          error: 'At least one concept ID is required',
        }
      };
      return;
    }

    const allResults: CodeSetResult[] = [];

    if (build_type === 'labtest') {
      const startTime = Date.now();
      context.log(`🧪 Lab Test Build: Using stored procedure for ${concept_ids.length} concepts`);

      const tvpRows = concept_ids.map(id => [id]);
      const results = await executeStoredProcedure<CodeSetResult>(
        'dbo.sp_BuildCodeSet_LabTest',
        {},
        {
          name: 'ConceptIds',
          typeName: 'dbo.ConceptIdList',
          rows: tvpRows
        }
      );

      const parsedResults = results.map((r: CodeSetResult) => ({
        ...r,
        relationships: r.relationships_json ? JSON.parse(r.relationships_json) : []
      }));

      allResults.push(...parsedResults);

      const duration = Date.now() - startTime;
      context.log(`✅ Lab Test Build: Completed in ${duration}ms - returned ${results.length} results`);

      const deduped = deduplicateResults(allResults);
      context.log(`🔄 Lab Test Build: Deduplicated from ${allResults.length} to ${deduped.length} unique concepts`);

      context.res = {
        status: 200,
        headers,
        body: {
          success: true,
          data: deduped,
        }
      };
      return;
    }

    if (build_type === 'direct') {
      const startTime = Date.now();
      context.log(`🚀 Direct Build: Using stored procedure for ${concept_ids.length} concepts`);

      const tvpRows = concept_ids.map(id => [id]);
      const results = await executeStoredProcedure<CodeSetResult>(
        'dbo.sp_BuildCodeSet_Direct',
        {},
        {
          name: 'ConceptIds',
          typeName: 'dbo.ConceptIdList',
          rows: tvpRows
        }
      );

      allResults.push(...results);

      const duration = Date.now() - startTime;
      context.log(`✅ Direct Build: Completed in ${duration}ms - returned ${results.length} results`);

      const deduped = deduplicateResults(allResults);
      context.log(`🔄 Direct Build: Deduplicated from ${allResults.length} to ${deduped.length} unique concepts`);

      context.res = {
        status: 200,
        headers,
        body: {
          success: true,
          data: deduped,
        }
      };
      return;
    }

    const startTime = Date.now();
    context.log(`🚀 Hierarchical Build: Using stored procedure for ${concept_ids.length} concepts`);

    const tvpRows = concept_ids.map(id => [id]);
    const results = await executeStoredProcedure<CodeSetResult>(
      'dbo.sp_BuildCodeSet_Hierarchical',
      { ComboFilter: combo_filter },
      {
        name: 'ConceptIds',
        typeName: 'dbo.ConceptIdList',
        rows: tvpRows
      }
    );

    allResults.push(...results);
    const duration = Date.now() - startTime;
    context.log(`✅ Stored procedure completed in ${duration}ms - returned ${results.length} results`);

    const deduped = deduplicateResults(allResults);
    context.log(`🔄 Hierarchical Build: Deduplicated from ${allResults.length} to ${deduped.length} unique concepts`);

    context.res = {
      status: 200,
      headers,
      body: {
        success: true,
        data: deduped,
      }
    };
  } catch (error) {
    context.log.error('Code set API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.res = {
      status: 500,
      headers,
      body: {
        success: false,
        error: message,
      }
    };
  }
};

export default httpTrigger;
