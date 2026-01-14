Medical Code Set Builder - Oracle Cloud Edition
Requirements Document
Project Overview
A web-based OMOP vocabulary code set builder with a "shopping cart" workflow that allows users to select multiple hierarchy root concepts and generate comprehensive code sets. This version uses Oracle Cloud Autonomous Database for OMOP vocabulary data and Supabase for user authentication and saved work.

Technical Stack
Frontend

React 18 + TypeScript + Vite
Tailwind CSS for styling
Axios for HTTP requests
React Router v6 for navigation
Lucide React for icons

Backend

Oracle Cloud Autonomous Database (19c) - OMOP vocabulary tables (read-only)
Supabase - User authentication (magic links) and user data storage
Node.js serverless functions (Vercel) OR simple REST API - minimal backend layer

Database Schema
Oracle Cloud (Read-Only OMOP Vocabulary):

CONCEPT table (~1GB, pipe-delimited CSV)
CONCEPT_ANCESTOR table (~2GB, pipe-delimited CSV)
CONCEPT_RELATIONSHIP table (~2GB, pipe-delimited CSV)

Supabase (User Data):

user_preferences - UI preferences, default domain
saved_code_sets - User's saved shopping carts and code sets
search_history - Recent searches per user


User Workflow
Step 1: Search & Select
Input:

Search term (text input)
Medical domain dropdown: Condition, Drug, Measurement, Procedure, Observation, Device

Query: Step_1_TermSearch.sql
Output Table Columns:

Standard_NAME
STD_CONCEPT_ID (primary key for Step 2)
STANDARD_CODE
STANDARD_VOCABULARY
concept_class_id
Search_Result
Searched_Code
Searched_Concept_CLASS_ID
VOCABULARY_ID

User Actions:

Click row to select
Click "Select Concept" button → passes STD_CONCEPT_ID to Step 2


Step 2: Explore Hierarchy & Build Shopping Cart
Input:

STD_CONCEPT_ID from Step 1

Query: Step_2_ExploreHierarchy.sql
Output Table Columns:

STEPS_AWAY (positive = parent, negative = child, 0 = selected)
CONCEPT_NAME
HIERARCHY_CONCEPT_ID (primary key for shopping cart)
VOCABULARY_ID
concept_class_id
ROOT_TERM

Shopping Cart Component (Always Visible):

Displays selected hierarchy concepts as cards/chips
Shows: CONCEPT_NAME, HIERARCHY_CONCEPT_ID, VOCABULARY_ID
"Remove" button on each card
"Clear Cart" button to empty all
"Build Code Set (Step 3)" button (enabled when cart has ≥1 item)

User Actions:

Click "Add to Cart" button on any row → adds HIERARCHY_CONCEPT_ID to shopping cart
Cart persists as user navigates back to Step 1 to add more concepts
Can "Go Back to Step 1" to search for additional concepts
When ready, click "Build Code Set" → passes ALL cart items to Step 3


Step 3: Build Code Set
Input:

Array of HIERARCHY_CONCEPT_ID values from shopping cart
comboFilter (for Drug domain only): ALL, SINGLE, COMBINATION

Query: Step_3_Build_Code_Set.sql executed once per HIERARCHY_CONCEPT_ID, results combined
Output Table Columns:

ROOT_CONCEPT_NAME
CHILD_VOCABULARY_ID
CHILD_CODE
CHILD_NAME
CHILD_CONCEPT_ID
CONCEPT_CLASS_ID
COMBINATIONYESNO (Drug only)
DOSE_FORM (Drug only)
dfg_name (Drug only)

Export Options:
1. Tab-Delimited TXT File:
CHILD_VOCABULARY_ID	CHILD_CODE	CHILD_NAME
SNOMED	15989271000119107	Conjunctivitis of right eye caused by herpes zoster virus
ICD10CM	B02.30	Zoster ocular disease, unspecified
Filename: codeset_YYYYMMDD_HHmmss.txt
2. SQL Snippet (Clipboard Copy):
sqlVOCABULARY_ID = 'SNOMED' AND CODE IN ('15989271000119107','15989351000119108')
OR VOCABULARY_ID = 'ICD9CM' AND CODE IN ('053.8','053')
OR VOCABULARY_ID = 'ICD10CM' AND CODE IN ('B02.8','B02','B02.3','B02.30')
User Actions:

Click "Export to TXT" → downloads file
Click "Copy SQL" → copies formatted SQL to clipboard
Click "Back to Step 2" → returns to hierarchy (cart preserved)
Click "Start Over" → clears cart and returns to Step 1


Data Loading Requirements
Oracle Cloud Database Setup
Source Files:

Location: C:\OMOP_VOCAB\
Format: Pipe-delimited (|) CSV files
Files:

CONCEPT.csv (1.08 GB)
CONCEPT_ANCESTOR.csv (1.99 GB)
CONCEPT_RELATIONSHIP.csv (2.24 GB)



Loading Strategy:

Use Oracle SQL Developer or SQLcl to load CSVs
Create tables with appropriate data types matching OMOP CDM
Create indexes on frequently queried columns:

CONCEPT: concept_id (PK), vocabulary_id, concept_code, concept_name
CONCEPT_RELATIONSHIP: concept_id_1, concept_id_2, relationship_id
CONCEPT_ANCESTOR: ancestor_concept_id, descendant_concept_id



SQL Schema Creation:
sql-- Create tables matching OMOP CDM structure
-- Add primary keys and indexes
-- Import pipe-delimited CSV data
```

---

## Backend Architecture Options

### Option 1: Direct Oracle Connection (Simplest)
**Pro:** No Python, uses Oracle REST Data Services (ORDS) or SQL over HTTP
**Con:** May require CORS proxy for browser security

### Option 2: Minimal Node.js API (Recommended)
```
React Frontend
    ↓
Node.js API (Vercel serverless functions)
    ↓
Oracle Cloud (oracledb npm package)
Endpoints:

POST /api/search - Step 1 query
POST /api/hierarchy - Step 2 query
POST /api/codeset - Step 3 query (accepts array of concept IDs)

Why Node.js:

Easier to deploy than Python (Vercel, Netlify, Railway)
oracledb npm package for Oracle connections
Serverless functions = no server management
CORS handled automatically

Option 3: Oracle ORDS REST APIs

Use Oracle's built-in REST endpoints
Requires ORDS configuration (already enabled)
Most direct but requires Oracle-specific setup


Authentication & User Data
Supabase Integration
Authentication:

Magic link email (passwordless)
User stored in auth.users table automatically

User Tables:
sqlCREATE TABLE saved_code_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  hierarchy_concept_ids BIGINT[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  default_domain TEXT,
  theme TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  search_term TEXT,
  domain TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
Row-Level Security (RLS):
sqlALTER TABLE saved_code_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own code sets"
  ON saved_code_sets FOR ALL
  USING (auth.uid() = user_id);
```

---

## UI/UX Requirements

### Navigation
- **Progress indicator:** Step 1 → Step 2 → Step 3
- **Shopping cart always visible** (collapsed/expandable when not in use)
- **Back buttons** at each step
- **Breadcrumb trail** showing current step

### Shopping Cart Component
```
╔══════════════════════════════════════╗
║ Shopping Cart (2 concepts)           ║
║ ────────────────────────────────────║
║ [×] Ritonavir (RxNorm: 1748921)     ║
║ [×] Diabetes mellitus (SNOMED: ...) ║
║                                      ║
║ [Clear Cart] [Build Code Set →]     ║
╚══════════════════════════════════════╝
Tables

Sortable columns
Row selection highlighting
Pagination (50 rows/page for Step 3)
Loading spinners during queries
Search/filter within results

Responsive Design

Mobile-first approach
Tables scroll horizontally on mobile
Shopping cart collapses to badge on small screens


SQL Query Integration
Query Files Location
C:\Users\T933261\mcsb_oracle\SQL_Files\

Step_1_TermSearch.sql
Step_2_ExploreHierarchy.sql
Step_3_Build_Code_Set.sql

Query Parameterization
Step 1: Replace SET searchterm = 'ritonavir' with parameter
Step 2: Replace SET concept = 1748921 with parameter
Step 3: Execute once per cart item, UNION results
Modifications for Multiple Hierarchy Concepts (Step 3)
sql-- Original: Single concept
WHERE C.CONCEPT_ID = $concept

-- Modified: Multiple concepts from cart
WHERE C.CONCEPT_ID IN ($concept_id_1, $concept_id_2, ...)
```

Or execute query N times and combine results in backend.

---

## Error Handling

### API Errors
- Network failures: Show retry button
- Oracle connection errors: "Database temporarily unavailable"
- Invalid queries: Log error, show user-friendly message

### User Feedback
- Toast notifications for success/error
- Loading states with spinners
- Disable buttons during async operations

### Validation
- Search term: minimum 2 characters
- Shopping cart: at least 1 item before Step 3
- Domain selection required

---

## Performance Considerations

### Query Optimization
- Use Oracle indexes (created during data load)
- Limit Step 1 results to 75 rows (already in SQL)
- Paginate Step 3 results (potentially 1000+ rows per concept)

### Caching
- Cache Step 1 search results for 5 minutes (in-memory or browser)
- Step 2 hierarchy doesn't change often - longer cache OK
- No caching for Step 3 (user expects fresh results)

### Frontend Optimization
- Lazy load Step 2 and Step 3 components
- Debounce search input (300ms)
- Virtual scrolling for large Step 3 results

---

## Deployment Strategy

### Development
```
Local dev:
- Frontend: npm run dev (Vite on localhost:5173)
- Backend: Node.js API on localhost:3000
- Oracle: Connection via wallet file
- Supabase: Connect to cloud instance
```

### Production
```
Frontend: Vercel (React SPA)
Backend: Vercel Serverless Functions (same repo)
Database: Oracle Cloud (connection via wallet)
Auth: Supabase (cloud)
```

**Environment Variables (.env):**
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
ORACLE_CONNECTION_STRING=xxx
ORACLE_USER=ADMIN
ORACLE_PASSWORD=xxx
```

---

## Security Requirements

### Oracle Connection
- Use Oracle Wallet for secure connections
- Store credentials in environment variables (never commit)
- Read-only user for OMOP tables

### Supabase
- Row-level security enabled on all user tables
- JWT verification on backend
- API keys in environment variables

### CORS
- Backend allows requests from frontend domain only
- No `Access-Control-Allow-Origin: *` in production

---

## Testing Requirements

### Manual Testing Checklist
- [ ] Step 1 search returns results for all domains
- [ ] Step 2 hierarchy shows parents/children correctly
- [ ] Shopping cart adds/removes items
- [ ] Cart persists when navigating back to Step 1
- [ ] Step 3 builds code set for multiple cart items
- [ ] TXT export downloads correctly formatted file
- [ ] SQL snippet copies to clipboard
- [ ] User authentication works (magic link email)
- [ ] Saved code sets persist for logged-in users

### Edge Cases
- Empty search results
- No hierarchy found for concept
- Shopping cart with 10+ items
- Very large Step 3 results (5000+ rows)
- Concurrent queries (user clicks multiple buttons rapidly)

---

## Project Structure
```
mcsb_oracle/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Step1Search.tsx
│   │   │   ├── Step2Hierarchy.tsx
│   │   │   ├── Step3CodeSet.tsx
│   │   │   ├── ShoppingCart.tsx
│   │   │   ├── Navigation.tsx
│   │   │   └── ExportButtons.tsx
│   │   ├── lib/
│   │   │   ├── api.ts (API client)
│   │   │   ├── supabase.ts
│   │   │   └── types.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── api/ (Vercel serverless functions)
│   ├── search.ts
│   ├── hierarchy.ts
│   └── codeset.ts
├── SQL_Files/
│   ├── Step_1_TermSearch.sql
│   ├── Step_2_ExploreHierarchy.sql
│   └── Step_3_Build_Code_Set.sql
├── oracle_setup/
│   ├── create_tables.sql
│   ├── load_data.sql
│   └── create_indexes.sql
├── .env.example
├── .gitignore
└── README.md

Oracle Cloud Database Setup Tasks
Pre-Development

Connect to Oracle Autonomous Database
Create OMOP tables (CONCEPT, CONCEPT_RELATIONSHIP, CONCEPT_ANCESTOR)
Load pipe-delimited CSV files
Create indexes on query columns
Test Step 1, 2, 3 queries manually
Download Oracle Wallet for secure connections

SQL Scripts Needed

Table creation DDL
CSV import script (SQL*Loader or SQL Developer import)
Index creation script
Test queries to verify data loaded correctly


Success Criteria

 User can search OMOP vocabulary across all domains
 Shopping cart allows adding multiple hierarchy concepts
 Step 3 generates combined code sets from cart items
 TXT and SQL exports work correctly
 Application loads in <3 seconds
 Works in Chrome, Firefox, Safari, Edge
 Mobile responsive
 Deployed publicly (Vercel + Oracle Cloud + Supabase)
 User authentication works (magic link)
 Users can save and reload code sets


Future Enhancements (Post-MVP)

 Share code sets via URL
 Export to Excel/CSV/JSON
 Visualization of concept hierarchy (tree diagram)
 Bulk import of concept IDs
 Code set comparison (diff two sets)
 Admin panel for managing users