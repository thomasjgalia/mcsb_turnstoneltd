// ============================================================================
// Oracle Database Connection Utility for Vercel Serverless Functions
// ============================================================================
import oracledb from 'oracledb';
import fs from 'fs';
import path from 'path';

// Prevent thick mode initialization - use thin mode only (no Instant Client required)
// This must be done before any connection attempts
try {
  // Ensure we're using thin mode by NOT calling initOracleClient()
  // Thin mode is the default if initOracleClient() is never called
} catch (err) {
  console.error('Oracle initialization:', err);
}

// Configure oracledb for thin mode
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

// Read wallet files for thin mode
function getWalletConfig() {
  const walletLocation = process.env.ORACLE_WALLET_LOCATION;
  const walletPassword = process.env.ORACLE_WALLET_PASSWORD;

  if (!walletLocation || !walletPassword) {
    return null;
  }

  try {
    // Read wallet files
    const cwalletPath = path.join(walletLocation, 'cwallet.sso');
    const tnsAdminPath = path.join(walletLocation, 'tnsnames.ora');

    if (!fs.existsSync(cwalletPath)) {
      console.warn('cwallet.sso not found in wallet location');
      return null;
    }

    return {
      walletLocation,
      walletPassword,
    };
  } catch (error) {
    console.error('Error reading wallet files:', error);
    return null;
  }
}

/**
 * Get Oracle database connection
 * Uses thin mode for easier deployment
 */
export async function getConnection() {
  try {
    console.log('🔌 Attempting Oracle connection...');

    // Validate required environment variables
    const user = process.env.ORACLE_USER || 'ADMIN';
    const password = process.env.ORACLE_PASSWORD;
    const connectString = process.env.ORACLE_CONNECTION_STRING;

    console.log('Connection details:', { user, connectString, hasPassword: !!password });

    if (!password || !connectString) {
      throw new Error(
        'Missing required Oracle environment variables. Please set ORACLE_PASSWORD and ORACLE_CONNECTION_STRING.'
      );
    }

    // Get wallet configuration
    const walletConfig = getWalletConfig();
    console.log('Wallet config:', walletConfig ? 'Found' : 'Not found');

    // For Oracle Autonomous Database with wallet, set TNS_ADMIN
    if (walletConfig) {
      process.env.TNS_ADMIN = walletConfig.walletLocation;
      console.log('TNS_ADMIN set to:', process.env.TNS_ADMIN);
    }

    // Connection configuration
    const config: any = {
      user,
      password,
      connectString,
    };

    // Add wallet configuration if available
    if (walletConfig) {
      config.walletLocation = walletConfig.walletLocation;
      config.walletPassword = walletConfig.walletPassword;
    }

    console.log('Final config (password hidden):', {
      user: config.user,
      connectString: config.connectString,
      walletLocation: config.walletLocation,
      hasWalletPassword: !!config.walletPassword,
    });

    console.log('Calling oracledb.getConnection()...');
    const connection = await oracledb.getConnection(config);
    console.log('✅ Connection successful!');
    return connection;
  } catch (error) {
    console.error('❌ Oracle connection error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code,
      offset: (error as any)?.offset,
    });
    throw error;
  }
}

/**
 * Execute a query and return results
 * Automatically closes connection after query
 */
export async function executeQuery<T = any>(
  sql: string,
  binds: Record<string, any> = {},
  options: oracledb.ExecuteOptions = {}
): Promise<T[]> {
  let connection;

  try {
    console.log('📊 Executing query with binds:', binds);
    connection = await getConnection();

    console.log('🔍 Running SQL query...');
    console.log('SQL (first 200 chars):', sql.substring(0, 200));

    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...options,
    });

    console.log('✅ Query executed successfully');
    console.log('📈 Rows returned:', result.rows?.length || 0);

    // Log first row to see column names
    if (result.rows && result.rows.length > 0) {
      console.log('First row keys:', Object.keys(result.rows[0]));
      console.log('First row sample:', JSON.stringify(result.rows[0]).substring(0, 200));
    }

    return (result.rows as T[]) || [];
  } catch (error) {
    console.error('❌ Query execution error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code,
      offset: (error as any)?.offset,
    });
    throw error;
  } finally {
    if (connection) {
      try {
        console.log('🔒 Closing connection...');
        await connection.close();
        console.log('✅ Connection closed');
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

/**
 * Build vocabulary list SQL fragment based on domain
 */
export function buildVocabularySQL(domain: string): string {
  const vocabularies: Record<string, string[]> = {
    Condition: ['ICD10CM', 'SNOMED', 'ICD9CM'],
    Observation: ['ICD10CM', 'SNOMED', 'LOINC', 'CPT4', 'HCPCS'],
    Drug: ['RxNorm', 'NDC', 'CPT4', 'CVX', 'HCPCS', 'ATC'],
    Measurement: ['LOINC', 'CPT4', 'SNOMED', 'HCPCS'],
    Procedure: ['CPT4', 'HCPCS', 'SNOMED', 'ICD09PCS', 'LOINC', 'ICD10PCS'],
    Device: ['SNOMED', 'HCPCS'],
  };

  const vocabList = vocabularies[domain] || [];

  if (vocabList.length === 0) {
    return "SELECT 'INVALID_DOMAIN' AS vocabulary_id FROM DUAL WHERE 1=0";
  }

  return vocabList
    .map((v) => `SELECT '${v}' AS vocabulary_id FROM DUAL`)
    .join(' UNION ALL ');
}

/**
 * Error response helper
 */
export function createErrorResponse(message: string, status = 500) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify({
      success: false,
      error: message,
    }),
  };
}

/**
 * Success response helper
 */
export function createSuccessResponse<T>(data: T) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify({
      success: true,
      data,
    }),
  };
}
