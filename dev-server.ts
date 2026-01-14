// ============================================================================
// Local Development Server for API Endpoints
// Run this with: npm run dev:api
// ============================================================================
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Import API handlers
import searchHandler from './api/search.js';
import hierarchyHandler from './api/hierarchy.js';
import codesetHandler from './api/codeset.js';

// Wrapper to convert Vercel handlers to Express handlers
const vercelToExpress = (handler: any) => {
  return async (req: express.Request, res: express.Response) => {
    try {
      // Create a Vercel-compatible response object
      const vercelRes: any = {
        status: (code: number) => {
          res.status(code);
          return {
            json: (data: any) => {
              res.json(data);
              return res;
            },
          };
        },
        json: (data: any) => {
          res.json(data);
          return res;
        },
      };

      await handler(req, vercelRes);
    } catch (error) {
      console.error('=== HANDLER ERROR ===');
      console.error('Error type:', error instanceof Error ? 'Error' : typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('Full error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  };
};

// API Routes
app.post('/api/search', vercelToExpress(searchHandler));
app.post('/api/hierarchy', vercelToExpress(hierarchyHandler));
app.post('/api/codeset', vercelToExpress(codesetHandler));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Development API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health\n`);
  console.log('Environment variables loaded:');
  console.log('  ORACLE_USER:', process.env.ORACLE_USER);
  console.log('  ORACLE_PASSWORD:', process.env.ORACLE_PASSWORD ? '✓ Set' : '✗ Not set');
  console.log('  ORACLE_CONNECTION_STRING:', process.env.ORACLE_CONNECTION_STRING);
  console.log('  ORACLE_WALLET_LOCATION:', process.env.ORACLE_WALLET_LOCATION);
  console.log('  ORACLE_WALLET_PASSWORD:', process.env.ORACLE_WALLET_PASSWORD ? '✓ Set' : '✗ Not set');
  console.log('\n');
});
