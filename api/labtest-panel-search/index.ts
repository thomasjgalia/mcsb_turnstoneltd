import { AzureFunction, Context, HttpRequest } from \"@azure/functions\";
import {
  executeStoredProcedure,
  createErrorResponse,
} from '../lib/azuresql';

interface LabTestPanelSearchRequest {
  labTestConceptIds: number[];
}

interface LabTestPanelSearchResult {
  lab_test_type: string;
  std_concept_id: number;
  panel_concept_id: number;
  search_result: string;
  searched_code: string;
  searched_concept_class_id: string;
  vocabulary_id: string;
  property: null;
  scale: null;
  system: null;
  time: null;
}

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  context.log('=== Lab Test Panel Search API called ===');
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
    const { labTestConceptIds } = req.body as LabTestPanelSearchRequest;
    context.log('Lab Test Panel Search params:', { labTestConceptIds });

    if (!labTestConceptIds || !Array.isArray(labTestConceptIds) || labTestConceptIds.length === 0) {
      context.res = {
        status: 400,
        headers,
        body: createErrorResponse('labTestConceptIds array is required', 400)
      };
      return;
    }

    const labTestIds = labTestConceptIds.join(',');

    context.log('🚀 Lab Test Panel Search: Using stored procedure sp_LabTestPanelSearch');
    const results = await executeStoredProcedure<LabTestPanelSearchResult>(
      'dbo.sp_LabTestPanelSearch',
      {
        LabTestIds: labTestIds,
      }
    );

    context.log('📤 Sending lab test panel search response with', results.length, 'results');
    context.res = {
      status: 200,
      headers,
      body: {
        success: true,
        data: results,
      }
    };
  } catch (error) {
    context.log.error('Lab Test Panel Search API error:', error);
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
