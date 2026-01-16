// ============================================================================
// API Client for Oracle OMOP Queries
// ============================================================================
import axios, { AxiosError } from 'axios';
import type {
  SearchRequest,
  SearchResult,
  HierarchyRequest,
  HierarchyResult,
  CodeSetRequest,
  CodeSetResult,
  ApiResponse,
} from './types';

// In development with Vercel Dev, API routes are served on the same origin
// In production, API routes are also on the same origin
const API_BASE_URL = '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 95000, // 95 seconds (allows for 90s backend timeout + 5s buffer)
});

// ============================================================================
// Error Handling
// ============================================================================
const handleApiError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    const message =
      axiosError.response?.data?.error ||
      axiosError.response?.data?.message ||
      axiosError.message ||
      'An unexpected error occurred';
    throw new Error(message);
  }
  throw error;
};

// ============================================================================
// Health Check / Database Warmup
// ============================================================================
export const checkHealth = async (): Promise<{
  success: boolean;
  duration_ms?: number;
  message?: string;
}> => {
  try {
    const response = await apiClient.get('/api/health');
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// ============================================================================
// Step 1: Search Query
// ============================================================================
export const searchConcepts = async (
  request: SearchRequest
): Promise<SearchResult[]> => {
  try {
    const response = await apiClient.post<ApiResponse<SearchResult[]>>(
      '/api/search',
      request
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Search failed');
    }

    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// ============================================================================
// Step 2: Hierarchy Query
// ============================================================================
export const getHierarchy = async (
  request: HierarchyRequest
): Promise<HierarchyResult[]> => {
  try {
    const response = await apiClient.post<ApiResponse<HierarchyResult[]>>(
      '/api/hierarchy',
      request
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Hierarchy query failed');
    }

    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// ============================================================================
// Step 3: Build Code Set Query
// ============================================================================
export const buildCodeSet = async (
  request: CodeSetRequest
): Promise<CodeSetResult[]> => {
  try {
    const response = await apiClient.post<ApiResponse<CodeSetResult[]>>(
      '/api/codeset',
      request
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Code set build failed');
    }

    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// ============================================================================
// Export Helper Functions
// ============================================================================

/**
 * Export code set results as tab-delimited TXT file
 */
export const exportToTxt = (data: CodeSetResult[]): void => {
  const headers = ['CHILD_VOCABULARY_ID', 'CHILD_CODE', 'CHILD_NAME'].join('\t');
  const rows = data.map((row) =>
    [row.child_vocabulary_id, row.child_code, row.child_name].join('\t')
  );

  const content = [headers, ...rows].join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `codeset_${timestamp}.txt`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generate SQL snippet and copy to clipboard
 */
export const exportToSql = async (data: CodeSetResult[]): Promise<void> => {
  // Group codes by vocabulary
  const grouped = data.reduce((acc, row) => {
    if (!acc[row.child_vocabulary_id]) {
      acc[row.child_vocabulary_id] = [];
    }
    acc[row.child_vocabulary_id].push(row.child_code);
    return acc;
  }, {} as Record<string, string[]>);

  // Build SQL snippet
  const sqlParts = Object.entries(grouped).map(([vocab, codes]) => {
    const codeList = codes.map((code) => `'${code}'`).join(',');
    return `VOCABULARY_ID = '${vocab}' AND CODE IN (${codeList})`;
  });

  const sql = sqlParts.join('\nOR ');

  // Copy to clipboard
  try {
    await navigator.clipboard.writeText(sql);
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = sql;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      throw new Error('Failed to copy to clipboard');
    }
    document.body.removeChild(textArea);
  }
};
