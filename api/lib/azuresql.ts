// ============================================================================
// Azure SQL Database Connection Module
// ============================================================================
// Provides connection pooling and query execution for Azure SQL Server
// ============================================================================

import sql from 'mssql';

// Connection pool (reused across function invocations)
let pool: sql.ConnectionPool | null = null;

/**
 * Get or create Azure SQL connection pool
 */
async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  const config: sql.config = {
    server: (process.env.AZURE_SQL_SERVER || '').trim(),
    database: (process.env.AZURE_SQL_DATABASE || '').trim(),
    user: (process.env.AZURE_SQL_USER || '').trim(),
    password: (process.env.AZURE_SQL_PASSWORD || '').trim(),
    options: {
      encrypt: true, // Required for Azure
      trustServerCertificate: true, // Required for Azure SQL with mssql library
      connectTimeout: 90000, // 90 seconds to allow for Azure SQL auto-resume from pause
      requestTimeout: 90000, // 90 seconds for query execution
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  console.log('Creating Azure SQL connection pool...', {
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER,
    passwordLength: process.env.AZURE_SQL_PASSWORD?.length,
  });

  try {
    pool = await sql.connect(config);
    console.log('✅ Azure SQL connection pool created');
    return pool;
  } catch (error) {
    console.error('❌ Azure SQL connection error:', error);
    throw error;
  }
}

/**
 * Execute a query with parameters
 */
export async function executeQuery<T>(
  query: string,
  params?: Record<string, any>
): Promise<T[]> {
  try {
    console.log('📊 Executing query with params:', params);

    const pool = await getPool();
    const request = pool.request();

    // Add parameters to request
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        // Determine SQL type based on value type
        if (typeof value === 'number') {
          request.input(key, sql.Int, value);
        } else if (typeof value === 'string') {
          request.input(key, sql.NVarChar, value);
        } else {
          request.input(key, value);
        }
      }
    }

    const result = await request.query(query);
    console.log(`✅ Query returned ${result.recordset.length} rows`);

    return result.recordset as T[];
  } catch (error) {
    console.error('❌ Query execution error:', error);
    console.error('Query:', query);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * Build vocabulary filter SQL for different domains
 * Converts Oracle's sys.odcivarchar2list to SQL Server IN clause
 */
export function buildVocabularySQL(domain: string): string {
  const vocabularies: Record<string, string[]> = {
    Condition: ['ICD10CM', 'SNOMED', 'ICD9CM'],
    Observation: ['ICD10CM', 'SNOMED', 'LOINC', 'CPT4', 'HCPCS'],
    Drug: ['RxNorm', 'NDC', 'CPT4', 'CVX', 'HCPCS', 'ATC'],
    Measurement: ['LOINC', 'CPT4', 'SNOMED', 'HCPCS'],
    Procedure: ['CPT4', 'HCPCS', 'SNOMED', 'ICD09PCS', 'LOINC', 'ICD10PCS'],
  };

  const vocabList = vocabularies[domain] || [];

  if (vocabList.length === 0) {
    return "('')"; // Empty IN clause
  }

  // Create SQL Server IN clause: ('value1', 'value2', 'value3')
  return `(${vocabList.map(v => `'${v}'`).join(', ')})`;
}

/**
 * Create error response
 */
export function createErrorResponse(message: string, code?: number) {
  return {
    success: false,
    error: message,
    code,
  };
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(data: T) {
  return {
    success: true,
    data,
  };
}

/**
 * Close connection pool (for cleanup)
 */
export async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('Azure SQL connection pool closed');
  }
}
