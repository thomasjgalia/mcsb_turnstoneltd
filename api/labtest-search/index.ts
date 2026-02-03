import { AzureFunction, Context, HttpRequest } from \"@azure/functions\";
import {
  executeStoredProcedure,
  createErrorResponse,
} from '../lib/azuresql';

interface LabTestSearchRequest {
  searchterm: string;
}

interface LabTestSearchResult {
  lab_test_type: string;
  std_concept_id: number;
  search_result: string;
  searched_code: string;
  searched_concept_class_id: string;
  vocabulary_id: string;
  property: string | null;
  scale: string | null;
  system: string | null;
  time: string | null;
  panel_count: number;
}

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  context.log('=== Lab Test Search API called ===');
  context.log('Method:', req.method);

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
    const { searchterm } = req.body as LabTestSearchRequest;
    context.log('Lab Test Search params:', { searchterm });

    const searchValue = searchterm?.trim() || '';

    context.log('🚀 Lab Test Search: Using stored procedure sp_LabTestSearch');
    const results = await executeStoredProcedure<LabTestSearchResult>(
      'dbo.sp_LabTestSearch',
      {
        SearchTerm: searchValue,
      }
    );

    context.log('📤 Sending lab test search response with', results.length, 'results');
    context.res = {
      status: 200,
      headers,
      body: {
        success: true,
        data: results,
      }
    };
  } catch (error) {
    context.log.error('Lab Test Search API error:', error);
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
