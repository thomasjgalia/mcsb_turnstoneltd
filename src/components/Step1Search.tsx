import { useState } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { searchConcepts, trackSearch } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { DomainType, SearchResult } from '../lib/types';

interface Step1SearchProps {
  onConceptSelected: (concept: SearchResult, domain: DomainType) => void;
  currentStep: number;
  searchResults: SearchResult[];
  setSearchResults: (results: SearchResult[]) => void;
  lastSearchTerm: string;
  setLastSearchTerm: (term: string) => void;
  lastSearchDomain: DomainType | '';
  setLastSearchDomain: (domain: DomainType | '') => void;
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
}: Step1SearchProps) {
  const [searchTerm, setSearchTerm] = useState(lastSearchTerm);
  const [domain, setDomain] = useState<DomainType | ''>(lastSearchDomain);
  const [results, setResults] = useState<SearchResult[]>(searchResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectedVocabulary, setSelectedVocabulary] = useState<string>('');
  const [selectedConceptClass, setSelectedConceptClass] = useState<string>('');
  const [textFilter, setTextFilter] = useState<string>('');

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
    setSelectedRow(null);
    setSelectedVocabulary('');
    setSelectedConceptClass('');

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
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (index: number, result: SearchResult) => {
    setSelectedRow(index);
    // Immediately proceed to Step 2 with the selected concept
    onConceptSelected(result, domain as DomainType);
  };

  // Get unique vocabularies and concept classes from results
  const availableVocabularies = Array.from(
    new Set(results.map((r) => r.searched_vocabulary))
  ).sort();

  const availableConceptClasses = Array.from(
    new Set(results.map((r) => r.searched_concept_class_id))
  ).sort();

  // Filter results based on selections and text filter
  const filteredResults = results.filter((result) => {
    if (selectedVocabulary && result.searched_vocabulary !== selectedVocabulary) {
      return false;
    }
    if (selectedConceptClass && result.searched_concept_class_id !== selectedConceptClass) {
      return false;
    }
    if (textFilter) {
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

  // Clear all filters
  const clearFilters = () => {
    setSelectedVocabulary('');
    setSelectedConceptClass('');
    setTextFilter('');
  };

  // Clear entire search
  const clearSearch = () => {
    setSearchTerm('');
    setDomain('');
    setResults([]);
    setSearchResults([]);
    setLastSearchTerm('');
    setLastSearchDomain('');
    setSelectedRow(null);
    setSelectedVocabulary('');
    setSelectedConceptClass('');
    setTextFilter('');
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
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3 flex-1">
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
                    placeholder="Filter results..."
                    className="input-field text-xs py-1 px-2 w-40"
                  />

                  <select
                    value={selectedVocabulary}
                    onChange={(e) => setSelectedVocabulary(e.target.value)}
                    className="select-field text-xs py-1 px-2"
                  >
                    <option value="">Vocab: All ({availableVocabularies.length})</option>
                    {availableVocabularies.map((vocab) => {
                      const count = results.filter((r) => r.searched_vocabulary === vocab).length;
                      return (
                        <option key={vocab} value={vocab}>
                          {vocab} ({count})
                        </option>
                      );
                    })}
                  </select>

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

                  {(selectedVocabulary || selectedConceptClass || textFilter) && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap"
                    >
                      Clear
                    </button>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Click row for hierarchy
            </p>
          </div>

          <div className="table-container">
            <table className="table search-results-table">
              <thead>
                <tr>
                  <th>Standard Name</th>
                  <th>Standard Code</th>
                  <th>Standard Vocabulary</th>
                  <th>Class</th>
                  <th>Search Result</th>
                  <th>Searched Code</th>
                  <th>Searched Vocabulary</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredResults.map((result, index) => (
                  <tr
                    key={`${result.std_concept_id}-${index}`}
                    onClick={() => handleRowClick(index, result)}
                    className={`cursor-pointer ${selectedRow === index ? 'selected' : ''}`}
                  >
                    <td className="font-medium">{result.standard_name || '-'}</td>
                    <td className="font-mono text-xs">{result.standard_code}</td>
                    <td>
                      <span className="badge badge-primary">{result.standard_vocabulary}</span>
                    </td>
                    <td className="text-xs text-gray-600">{result.concept_class_id}</td>
                    <td className="text-sm text-gray-700">{result.search_result}</td>
                    <td className="font-mono text-xs">{result.searched_code}</td>
                    <td>
                      <span className="badge badge-info">{result.searched_vocabulary}</span>
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
    </div>
  );
}
