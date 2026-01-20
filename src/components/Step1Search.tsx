import { useState } from 'react';
import { Search, Loader2, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, ShoppingCart, GitBranch } from 'lucide-react';
import { searchConcepts, trackSearch } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { DomainType, SearchResult, CartItem } from '../lib/types';

type SortField = 'standard_name' | 'standard_vocabulary' | 'concept_class_id' | 'search_result' | 'searched_code' | 'searched_vocabulary';
type SortDirection = 'asc' | 'desc';

interface Step1SearchProps {
  onConceptSelected: (concept: SearchResult, domain: DomainType) => void;
  currentStep: number;
  searchResults: SearchResult[];
  setSearchResults: (results: SearchResult[]) => void;
  lastSearchTerm: string;
  setLastSearchTerm: (term: string) => void;
  lastSearchDomain: DomainType | '';
  setLastSearchDomain: (domain: DomainType | '') => void;
  addToCart: (item: CartItem) => void;
  addMultipleToCart: (items: CartItem[]) => void;
  shoppingCart: CartItem[];
}

const DOMAINS: DomainType[] = ['Condition', 'Drug', 'Procedure', 'Measurement', 'Observation', 'Device'];

export default function Step1Search({
  onConceptSelected,
  searchResults,
  setSearchResults,
  lastSearchTerm,
  setLastSearchTerm,
  lastSearchDomain,
  setLastSearchDomain,
  addToCart,
  addMultipleToCart,
  shoppingCart,
}: Step1SearchProps) {
  const [searchTerm, setSearchTerm] = useState(lastSearchTerm);
  const [domain, setDomain] = useState<DomainType | ''>(lastSearchDomain);
  const [results, setResults] = useState<SearchResult[]>(searchResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVocabulary, setSelectedVocabulary] = useState<string>('');
  const [selectedConceptClass, setSelectedConceptClass] = useState<string>('');
  const [textFilter, setTextFilter] = useState<string>('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showStrategyModal, setShowStrategyModal] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (searchTerm.trim().length < 2) {
      setError('Please enter at least 2 characters');
      return;
    }

    if (!domain) {
      setError('Please select a domain');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedVocabulary('');
    setSelectedConceptClass('');

    // Show strategy modal immediately when search starts
    setShowStrategyModal(true);

    try {
      const data = await searchConcepts({
        searchterm: searchTerm.trim(),
        domain_id: domain as DomainType,
      });

      setResults(data);
      // Also save to parent state so results persist when navigating back
      setSearchResults(data);
      setLastSearchTerm(searchTerm.trim());
      setLastSearchDomain(domain as DomainType);

      // Track search in history (fire and forget)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        trackSearch(session.user.id, searchTerm.trim(), domain as DomainType, data.length)
          .catch(() => {
            // Silently fail if tracking errors occur
          });
      }

      if (data.length === 0) {
        setError('No results found. Try a different search term or domain.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      // Close modal on error so user can see the error message
      setShowStrategyModal(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle "See Hierarchy" button click
  const handleSeeHierarchy = (result: SearchResult) => {
    onConceptSelected(result, domain as DomainType);
  };

  // Handle "Add to Cart" button click
  const handleAddToCart = (result: SearchResult) => {
    const cartItem: CartItem = {
      hierarchy_concept_id: result.std_concept_id,
      concept_name: result.standard_name,
      vocabulary_id: result.standard_vocabulary,
      concept_class_id: result.concept_class_id,
      root_term: result.search_result,
      domain_id: domain as DomainType,
    };
    addToCart(cartItem);
  };

  // Check if item is already in cart
  const isInCart = (conceptId: number) => {
    return shoppingCart.some((item) => item.hierarchy_concept_id === conceptId);
  };

  // Handle column sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Add all filtered results to cart
  const handleAddAllToCart = () => {
    // Collect all items to add
    const itemsToAdd: CartItem[] = filteredResults.map(result => ({
      hierarchy_concept_id: result.std_concept_id,
      concept_name: result.standard_name,
      vocabulary_id: result.standard_vocabulary,
      concept_class_id: result.concept_class_id,
      root_term: result.search_result,
      domain_id: domain as DomainType,
    }));

    // Add all items to cart at once (duplicate checking happens in parent)
    addMultipleToCart(itemsToAdd);
  };

  // Check if all filtered results are in cart
  const areAllFilteredInCart = () => {
    if (filteredResults.length === 0) return false;
    return filteredResults.every(result => isInCart(result.std_concept_id));
  };

  // Get unique vocabularies and concept classes from results
  const availableVocabularies = Array.from(
    new Set(results.map((r) => r.searched_vocabulary))
  ).sort();

  const availableConceptClasses = Array.from(
    new Set(results.map((r) => r.searched_concept_class_id))
  ).sort();

  // Filter results based on selections and text filter
  let filteredResults = results.filter((result) => {
    if (selectedVocabulary && result.searched_vocabulary !== selectedVocabulary) {
      return false;
    }
    if (selectedConceptClass && result.searched_concept_class_id !== selectedConceptClass) {
      return false;
    }
    if (textFilter && textFilter.length >= 2) {
      const searchText = textFilter.toLowerCase();
      const matchesSearched = result.searched_term?.toLowerCase().includes(searchText);
      const matchesStandard = result.standard_name?.toLowerCase().includes(searchText);
      const matchesCode = result.standard_code?.toLowerCase().includes(searchText);
      if (!matchesSearched && !matchesStandard && !matchesCode) {
        return false;
      }
    }
    return true;
  });

  // Apply sorting
  if (sortField) {
    filteredResults = [...filteredResults].sort((a, b) => {
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';

      const comparison = aValue.toString().localeCompare(bValue.toString(), undefined, {
        numeric: true,
        sensitivity: 'base'
      });

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  // Clear all filters
  const clearFilters = () => {
    setSelectedVocabulary('');
    setSelectedConceptClass('');
    setTextFilter('');
    setSortField(null);
    setSortDirection('asc');
  };

  // Clear entire search
  const clearSearch = () => {
    setSearchTerm('');
    setDomain('');
    setResults([]);
    setSearchResults([]);
    setLastSearchTerm('');
    setLastSearchDomain('');
    setSelectedVocabulary('');
    setSelectedConceptClass('');
    setTextFilter('');
    setSortField(null);
    setSortDirection('asc');
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Compact Search Form */}
      <form onSubmit={handleSearch} className="card p-3">
        <div className="flex items-end gap-3">
          {/* Search Term */}
          <div className="flex-1">
            <label htmlFor="searchTerm" className="block text-xs font-medium text-gray-700 mb-1">
              Search medical concepts
            </label>
            <input
              id="searchTerm"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="e.g., ritonavir, diabetes"
              className="input-field text-sm"
              disabled={loading}
              required
              minLength={2}
              autoComplete="off"
            />
          </div>

          {/* Domain */}
          <div className="w-48">
            <label htmlFor="domain" className="block text-xs font-medium text-gray-700 mb-1">
              Domain <span className="text-red-600">*</span>
            </label>
            <select
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value as DomainType | '')}
              className="select-field text-sm"
              disabled={loading}
              required
            >
              <option value="">Select...</option>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || searchTerm.trim().length < 2 || !domain}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Search
              </>
            )}
          </button>

          {/* Clear Search Button */}
          {results.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              className="btn-secondary text-sm px-4 py-2 whitespace-nowrap"
            >
              Clear Search
            </button>
          )}
        </div>
      </form>

      {/* Domain-Specific Helper Text */}
      {domain && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900">
              {(domain === 'Condition' || domain === 'Drug' || domain === 'Observation') ? (
                <p>
                  Code Sets for Condition, Drug, and Observation domains effectively leverage the hierarchical nature of the vocabularies. Choose a concept that most closely resembles your search term and click the view hierarchy button.
                </p>
              ) : (
                <p>
                  For code sets within Procedure, Measurement and Device domains, a good approach is to filter on your vocabulary and key terms and then use the Add or Add All button to add the terms to the shopping cart.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="card p-4">
          {/* Secondary Filter Controls - Highlighted Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-3 flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                    Results: {filteredResults.length}{filteredResults.length !== results.length && ` / ${results.length}`}
                  </h3>

                  {/* Inline Filters */}
                  {results.length > 1 && (
                    <>
                      {/* Text Filter */}
                      <input
                        type="text"
                        value={textFilter}
                        onChange={(e) => setTextFilter(e.target.value)}
                        placeholder="Filter (2+ chars)..."
                        className="input-field text-xs py-1 px-2 w-40"
                        title="Auto-filters after 2 characters"
                      />

                      <select
                        value={selectedConceptClass}
                        onChange={(e) => setSelectedConceptClass(e.target.value)}
                        className="select-field text-xs py-1 px-2"
                      >
                        <option value="">Class: All ({availableConceptClasses.length})</option>
                        {availableConceptClasses.map((conceptClass) => {
                          const count = results.filter((r) => r.searched_concept_class_id === conceptClass).length;
                          return (
                            <option key={conceptClass} value={conceptClass}>
                              {conceptClass} ({count})
                            </option>
                          );
                        })}
                      </select>

                      {(selectedVocabulary || selectedConceptClass || textFilter || sortField) && (
                        <button
                          onClick={clearFilters}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap"
                        >
                          Clear Filters
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Vocabulary Filter Buttons */}
                {results.length > 1 && availableVocabularies.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-700">Vocabulary:</span>
                    <button
                      onClick={() => setSelectedVocabulary('')}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        selectedVocabulary === ''
                          ? 'bg-primary-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      All ({results.length})
                    </button>
                    {availableVocabularies.map((vocab) => {
                      const count = results.filter((r) => r.searched_vocabulary === vocab).length;
                      return (
                        <button
                          key={vocab}
                          onClick={() => setSelectedVocabulary(vocab)}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            selectedVocabulary === vocab
                              ? 'bg-primary-600 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {vocab} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add All button on the right */}
              {results.length > 1 && (
                <button
                  onClick={handleAddAllToCart}
                  disabled={areAllFilteredInCart()}
                  className={`text-xs px-3 py-1 whitespace-nowrap flex items-center gap-1 self-start ${
                    areAllFilteredInCart()
                      ? 'bg-blue-600 text-white cursor-not-allowed opacity-75'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                  title={areAllFilteredInCart() ? 'All filtered results in cart' : 'Add all filtered results to cart'}
                >
                  <ShoppingCart className="w-3 h-3" />
                  {areAllFilteredInCart() ? 'All In Cart' : `Add All (${filteredResults.length})`}
                </button>
              )}
            </div>
          </div>

          <div className="table-container">
            <table className="table search-results-table text-xs">
              <thead>
                <tr>
                  <th
                    onClick={() => handleSort('standard_name')}
                    className="cursor-pointer hover:bg-gray-100 select-none text-xs py-2 w-[22%]"
                    title="Click to sort"
                  >
                    <div className="flex items-center gap-1">
                      Standard Name
                      {sortField === 'standard_name' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('standard_vocabulary')}
                    className="cursor-pointer hover:bg-gray-100 select-none text-xs py-2 w-[9%]"
                    title="Click to sort"
                  >
                    <div className="flex items-center gap-1">
                      Std Vocab
                      {sortField === 'standard_vocabulary' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('concept_class_id')}
                    className="cursor-pointer hover:bg-gray-100 select-none text-xs py-2 w-[11%]"
                    title="Click to sort"
                  >
                    <div className="flex items-center gap-1">
                      Class
                      {sortField === 'concept_class_id' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('search_result')}
                    className="cursor-pointer hover:bg-gray-100 select-none text-xs py-2 w-[30%]"
                    title="Click to sort"
                  >
                    <div className="flex items-center gap-1">
                      Search Result
                      {sortField === 'search_result' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('searched_code')}
                    className="cursor-pointer hover:bg-gray-100 select-none text-xs py-2 w-[6%]"
                    title="Click to sort"
                  >
                    <div className="flex items-center gap-1">
                      Code
                      {sortField === 'searched_code' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('searched_vocabulary')}
                    className="cursor-pointer hover:bg-gray-100 select-none text-xs py-2 w-[9%]"
                    title="Click to sort"
                  >
                    <div className="flex items-center gap-1">
                      Searched Vocab
                      {sortField === 'searched_vocabulary' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="text-center text-xs py-2 w-[13%]">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredResults.map((result, index) => (
                  <tr key={`${result.std_concept_id}-${index}`} className="text-xs">
                    <td className="font-medium py-1.5">{result.standard_name || '-'}</td>
                    <td className="py-1.5">
                      <span className="badge badge-primary text-xs">{result.standard_vocabulary}</span>
                    </td>
                    <td className="text-gray-600 py-1.5">{result.concept_class_id}</td>
                    <td className="text-gray-700 py-1.5">{result.search_result}</td>
                    <td className="font-mono py-1.5">{result.searched_code}</td>
                    <td className="py-1.5">
                      <span className="badge badge-info text-xs">{result.searched_vocabulary}</span>
                    </td>
                    <td className="py-1.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleSeeHierarchy(result)}
                          className="btn-secondary text-xs px-2 py-1 whitespace-nowrap flex items-center gap-1"
                          title="View hierarchy and descendants"
                        >
                          <GitBranch className="w-3 h-3" />
                          Hierarchy
                        </button>
                        <button
                          onClick={() => handleAddToCart(result)}
                          disabled={isInCart(result.std_concept_id)}
                          className={`text-xs px-2 py-1 whitespace-nowrap flex items-center gap-1 ${
                            isInCart(result.std_concept_id)
                              ? 'bg-blue-600 text-white cursor-not-allowed opacity-75'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                          title={isInCart(result.std_concept_id) ? 'Already in cart' : 'Add to cart'}
                        >
                          <ShoppingCart className="w-3 h-3" />
                          {isInCart(result.std_concept_id) ? 'In Cart' : 'Add'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && !error && (
        <div className="card p-8 text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Enter a medical term and select a domain to search
          </p>
        </div>
      )}

      {/* Strategy Modal */}
      {showStrategyModal && domain && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {domain} Domain Strategy
                </h2>
                <div className="text-sm text-gray-700">
                  {(domain === 'Condition' || domain === 'Drug' || domain === 'Observation') ? (
                    <p>
                      Code Sets for Condition, Drug, and Observation domains effectively leverage the hierarchical nature of the vocabularies. Choose a concept that most closely resembles your search term and click the view hierarchy button.
                    </p>
                  ) : (
                    <p>
                      For code sets within Procedure, Measurement and Device domains, a good approach is to filter on your vocabulary and key terms and then use the Add or Add All button to add the terms to the shopping cart.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowStrategyModal(false)}
                className="btn-primary text-sm px-4 py-2"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
