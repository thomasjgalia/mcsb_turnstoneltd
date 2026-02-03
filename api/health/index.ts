import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { testConnection } from '../lib/azuresql';

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    try {
        await testConnection();
        
        context.res = {
            status: 200,
            headers,
            body: {
                status: 'healthy',
                database: 'connected',
                timestamp: new Date().toISOString()
            }
        };
    } catch (error) {
        context.log.error('Health check failed:', error);
        
        context.res = {
            status: 503,
            headers,
            body: {
                status: 'unhealthy',
                database: 'disconnected',
                error: error instanceof Error ? error.message : 'Database connection failed',
                timestamp: new Date().toISOString()
            }
        };
    }
};

export default httpTrigger;
