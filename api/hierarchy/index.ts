import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import {
  executeStoredProcedure,
  createErrorResponse,
} from '../lib/azuresql';

interface HierarchyRequest {
  concept_id: number;
}

interface HierarchyResult {
  steps_away: number;
  concept_name: string;
  hierarchy_concept_id: number;
  concept_code: string;
  vocabulary_id: string;
  concept_class_id: string;
  root_term: string;
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
    const { concept_id } = req.body as HierarchyRequest;

    if (!concept_id || typeof concept_id !== 'number') {
      context.res = {
        status: 400,
        headers,
        body: {
          success: false,
          error: 'Valid concept ID is required',
        }
      };
      return;
    }

    context.log('🚀 Hierarchy: Using stored procedure sp_GetConceptHierarchy');
    const results = await executeStoredProcedure<HierarchyResult>(
      'dbo.sp_GetConceptHierarchy',
      { ConceptId: concept_id }
    );

    context.res = {
      status: 200,
      headers,
      body: {
        success: true,
        data: results,
      }
    };
  } catch (error) {
    context.log.error('Hierarchy API error:', error);
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
