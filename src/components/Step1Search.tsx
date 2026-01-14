import { useState } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { searchConcepts } from '../lib/api';
import { addSearchHistory } from '../lib/supabase';
import type { DomainType, SearchResult } from '../lib/types';

interface Step1SearchProps {
  onConceptSelected: (concept: SearchResult, domain: DomainType) => void;
  currentStep: number;
}

const DOMAINS: DomainType[] = ['Condition', 'Drug', 'Procedure', 'Measurement', 'Observation', 'Device'];

export default function Step1Search({ onConceptSelected }: Step1SearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [domain, setDomain] = useState<DomainType | ''>('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

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

    try {
      const data = await searchConcepts({
        searchterm: searchTerm.trim(),
        domain_id: domain as DomainType,
      });

      setResults(data);

      // Add to search history (fire and forget)
      addSearchHistory(searchTerm, domain as DomainType).catch(() => {
        // Silently fail if user is not logged in or error occurs
      });

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

  return (
    <div className="space-y-6">
      {/* Step Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Step 1: Search Concepts</h2>
        <p className="text-gray-600 mt-1">
          Search for medical concepts across OMOP vocabularies
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Term */}
          <div className="md:col-span-2">
            <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-2">
              Search Term
            </label>
            <input
              id="searchTerm"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter medical term (e.g., ritonavir, diabetes)"
              className="input-field"
              disabled={loading}
              required
              minLength={2}
            />
          </div>

          {/* Domain */}
          <div>
            <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
              Domain <span className="text-red-600">*</span>
            </label>
            <select
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value as DomainType | '')}
              className="select-field"
              disabled={loading}
              required
            >
              <option value="">-- Select Domain --</option>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || searchTerm.trim().length < 2 || !domain}
          className="btn-primary mt-4 flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Search
            </>
          )}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="card">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Search Results ({results.length})
            </h3>
            <p className="text-sm text-blue-600 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Click any row to select it and proceed to Step 2 (Hierarchy)
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
                {results.map((result, index) => (
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
        <div className="card text-center py-12">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Ready to Search
          </h3>
          <p className="text-gray-500">
            Enter a medical term and select a domain to begin
          </p>
        </div>
      )}
    </div>
  );
}
