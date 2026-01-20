// ============================================================================
// TypeScript Type Definitions for Medical Code Set Builder
// ============================================================================

// Domain types for medical concepts
export type DomainType = 'Condition' | 'Drug' | 'Procedure' | 'Measurement' | 'Observation' | 'Device' | 'Aman\'s Domain';

// Combination filter for Drug domain
export type ComboFilter = 'ALL' | 'SINGLE' | 'COMBINATION';

// ============================================================================
// Step 1: Search Results
// ============================================================================
export interface SearchResult {
  standard_name: string;
  std_concept_id: number;
  standard_code: string;
  standard_vocabulary: string;
  concept_class_id: string;
  search_result: string;
  searched_code: string;
  searched_vocabulary: string;
  searched_concept_class_id: string;
  searched_term: string;
}

export interface SearchRequest {
  searchterm: string;
  domain_id: DomainType;
}

// ============================================================================
// Step 2: Hierarchy Results
// ============================================================================
export interface HierarchyResult {
  steps_away: number;
  concept_name: string;
  hierarchy_concept_id: number;
  concept_code: string;
  vocabulary_id: string;
  concept_class_id: string;
  root_term: string;
}

export interface HierarchyRequest {
  concept_id: number;
}

// ============================================================================
// Step 3: Code Set Build Results
// ============================================================================
export interface CodeSetResult {
  root_concept_name: string;
  child_vocabulary_id: string;
  child_code: string;
  child_name: string;
  child_concept_id: number;
  concept_class_id: string;
  combinationyesno?: string;  // Drug domain only
  dose_form?: string;          // Drug domain only
  dfg_name?: string;           // Drug domain only
  concept_attribute?: string;  // Optional attribute
  value?: string;              // Optional attribute value
}

export interface CodeSetRequest {
  concept_ids: number[];  // Array of HIERARCHY_CONCEPT_IDs from shopping cart
  combo_filter?: ComboFilter;  // Drug domain only
}

// ============================================================================
// Shopping Cart
// ============================================================================
export interface CartItem {
  hierarchy_concept_id: number;
  concept_name: string;
  vocabulary_id: string;
  concept_class_id: string;
  root_term: string;
  domain_id: DomainType;
}

// ============================================================================
// Export Formats
// ============================================================================
export interface ExportOptions {
  format: 'txt' | 'sql';
  data: CodeSetResult[];
}

export interface SQLSnippet {
  vocabulary_id: string;
  codes: string[];
}

// ============================================================================
// API Response Types
// ============================================================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

// ============================================================================
// Azure SQL User Data Types
// ============================================================================
export interface UserProfile {
  supabase_user_id: string;
  email: string;
  display_name?: string;
  preferences?: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  default_domain?: DomainType;
  theme?: 'light' | 'dark';
  show_search_history?: boolean;
  recent_search_limit?: number;
}

export interface SavedCodeSetRecord {
  id: number;
  supabase_user_id: string;
  code_set_name: string;
  description?: string;
  concepts: string; // JSON string
  total_concepts: number;
  source_type: 'OMOP' | 'UMLS'; // Source type to distinguish code set origin
  source_metadata?: string; // JSON string with additional metadata
  created_at: string;
  updated_at: string;
}

export interface SavedCodeSetConcept {
  hierarchy_concept_id: number;
  concept_name: string;
  vocabulary_id: string;
  concept_class_id: string;
  root_term: string;
  domain_id: DomainType;
}

export interface SearchHistoryRecord {
  id: number;
  supabase_user_id: string;
  search_term: string;
  domain_type?: string;
  result_count?: number;
  searched_at: string;
}

// UMLS-specific saved code set concept (flatter structure than OMOP)
export interface SavedUMLSConcept {
  code: string;
  vocabulary: string;
  term: string;
  sourceConcept: string;
}

// Metadata for UMLS code sets
export interface UMLSCodeSetMetadata {
  search_term: string;
  selected_vocabularies?: string[];
  total_results: number;
  saved_at: string;
}

// Request/Response types for user data API
export interface SaveCodeSetRequest {
  code_set_name: string;
  description?: string;
  concepts: SavedCodeSetConcept[] | SavedUMLSConcept[];
  source_type: 'OMOP' | 'UMLS';
  source_metadata?: string; // JSON string
}

export interface GetCodeSetsResponse {
  id: number;
  code_set_name: string;
  description?: string;
  total_concepts: number;
  source_type: 'OMOP' | 'UMLS';
  source_metadata?: string;
  created_at: string;
  updated_at: string;
}

export interface GetCodeSetDetailResponse extends GetCodeSetsResponse {
  concepts: SavedCodeSetConcept[] | SavedUMLSConcept[];
}

// ============================================================================
// UMLS Search Types
// ============================================================================
export interface UMLSSearchRequest {
  searchTerm: string;
  vocabularies?: string[]; // Optional filter: ICD10CM, CPT, SNOMEDCT_US, etc.
  pageSize?: number;
}

export interface UMLSSourceAtom {
  code: string;
  sourceConcept: string;
  vocabulary: string;
  term: string;
}

export interface UMLSSearchResult {
  ui: string; // Concept Unique Identifier (CUI)
  name: string; // Preferred term
  uri: string; // Concept URI
  rootSource: string; // Source vocabulary
  semanticTypes?: string[]; // Semantic type abbreviations
  sources?: UMLSSourceAtom[]; // Codes from different vocabularies
}

export interface UMLSSearchResponse {
  results: UMLSSearchResult[];
  pageCount: number;
  pageNumber: number;
  ticket?: string; // Service ticket for authenticated UMLS links
}

// ============================================================================
// Application State Types
// ============================================================================
export interface AppState {
  currentStep: 1 | 2 | 3;
  selectedConcept: SearchResult | null;
  shoppingCart: CartItem[];
  codeSetResults: CodeSetResult[];
}
