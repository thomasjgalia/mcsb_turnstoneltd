// ============================================================================
// TypeScript Type Definitions for Medical Code Set Builder
// ============================================================================

// Domain types for medical concepts
export type DomainType = 'Condition' | 'Drug' | 'Procedure' | 'Measurement' | 'Observation' | 'Device';

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
// Supabase User Data Types
// ============================================================================
export interface UserPreferences {
  user_id: string;
  default_domain?: DomainType;
  theme?: 'light' | 'dark';
  updated_at: string;
}

export interface SavedCodeSet {
  id: string;
  user_id: string;
  name: string;
  hierarchy_concept_ids: number[];
  created_at: string;
}

export interface SearchHistory {
  id: string;
  user_id: string;
  search_term: string;
  domain: DomainType;
  created_at: string;
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
