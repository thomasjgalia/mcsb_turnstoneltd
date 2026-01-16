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
import chatHandler from './api/chat.js';
import profileHandler from './api/user/profile.js';
import codesetsHandler from './api/user/codesets.js';
import searchHistoryHandler from './api/user/search-history.js';

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
app.post('/api/chat', vercelToExpress(chatHandler));

// User API Routes
app.post('/api/user/profile', vercelToExpress(profileHandler));
app.get('/api/user/profile/:userId', vercelToExpress(profileHandler));
app.post('/api/user/codesets', vercelToExpress(codesetsHandler));
app.get('/api/user/codesets/:userId', vercelToExpress(codesetsHandler));
app.get('/api/user/codesets/detail/:codeSetId', vercelToExpress(codesetsHandler));
app.delete('/api/user/codesets/:codeSetId', vercelToExpress(codesetsHandler));
app.post('/api/user/search-history', vercelToExpress(searchHistoryHandler));
app.get('/api/user/search-history/:userId', vercelToExpress(searchHistoryHandler));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Development API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health\n`);
  console.log('Environment variables loaded:');
  console.log('  AZURE_SQL_SERVER:', process.env.AZURE_SQL_SERVER);
  console.log('  AZURE_SQL_DATABASE:', process.env.AZURE_SQL_DATABASE);
  console.log('  AZURE_SQL_USER:', process.env.AZURE_SQL_USER);
  console.log('  AZURE_SQL_PASSWORD:', process.env.AZURE_SQL_PASSWORD ? '✓ Set' : '✗ Not set');
  console.log('  AZURE_SQL_CONNECTION_STRING:', process.env.AZURE_SQL_CONNECTION_STRING ? '✓ Set' : '✗ Not set');
  console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Not set');
  console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not set');
  console.log('\n');
});
