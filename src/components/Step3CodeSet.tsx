import { useState, useEffect } from 'react';
import { PackageCheck, Loader2, AlertCircle, Download, Copy, CheckCircle, RotateCcw, ArrowLeft, Plus } from 'lucide-react';
import { buildCodeSet, exportToTxt, exportToSql } from '../lib/api';
import type { CartItem, CodeSetResult, ComboFilter } from '../lib/types';

interface Step3CodeSetProps {
  shoppingCart: CartItem[];
  onBackToHierarchy: () => void;
  onBackToSearch: () => void;
  onStartOver: () => void;
  currentStep: number;
}

export default function Step3CodeSet({
  shoppingCart,
  onBackToHierarchy,
  onBackToSearch,
  onStartOver,
  currentStep,
}: Step3CodeSetProps) {
  const [results, setResults] = useState<CodeSetResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comboFilter, setComboFilter] = useState<ComboFilter>('ALL');
  const [sqlCopied, setSqlCopied] = useState(false);
  const [hasBuilt, setHasBuilt] = useState(false);

  const buildSet = async () => {
    if (shoppingCart.length === 0) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const conceptIds = shoppingCart.map((item) => item.hierarchy_concept_id);
      const data = await buildCodeSet({
        concept_ids: conceptIds,
        combo_filter: comboFilter,
      });

      setResults(data);
      setHasBuilt(true);

      if (data.length === 0) {
        setError('No codes found for the selected concepts.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build code set');
    } finally {
      setLoading(false);
    }
  };

  const handleExportTxt = () => {
    exportToTxt(results);
  };

  const handleCopySql = async () => {
    try {
      await exportToSql(results);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy SQL to clipboard');
    }
  };

  // Group results by vocabulary
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.child_vocabulary_id]) {
      acc[result.child_vocabulary_id] = [];
    }
    acc[result.child_vocabulary_id].push(result);
    return acc;
  }, {} as Record<string, CodeSetResult[]>);

  if (shoppingCart.length === 0) {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Shopping Cart is Empty
        </h3>
        <p className="text-gray-500 mb-4">
          Add concepts to your cart from Step 2 before building a code set
        </p>
        <button onClick={onBackToHierarchy} className="btn-primary">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Hierarchy
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Step 3: Build Code Set</h2>
        <p className="text-gray-600 mt-1">
          Generate comprehensive code sets from all concepts in your cart
        </p>
      </div>

      {/* Cart Summary */}
      <div className="card bg-primary-50 border-primary-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Building from {shoppingCart.length} concept{shoppingCart.length !== 1 ? 's' : ''}
            </h3>
            <div className="flex flex-wrap gap-2">
              {shoppingCart.map((item) => (
                <span key={item.hierarchy_concept_id} className="badge badge-primary">
                  {item.concept_name.slice(0, 30)}
                  {item.concept_name.length > 30 ? '...' : ''}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={onBackToHierarchy} className="btn-secondary flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Hierarchy
              </button>
              <button onClick={onBackToSearch} className="btn-secondary flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add More Concepts
              </button>
            </div>
            <button onClick={onStartOver} className="btn-secondary flex items-center gap-2 text-red-600 hover:text-red-700">
              <RotateCcw className="w-4 h-4" />
              Start Over (Clear Cart)
            </button>
          </div>
        </div>
      </div>

      {/* Build Code Set Button */}
      {!hasBuilt && !loading && (
        <div className="card text-center py-6">
          <PackageCheck className="w-12 h-12 text-primary-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Ready to Build Code Set
          </h3>
          <p className="text-gray-600 mb-4">
            Click the button below to generate your code set from {shoppingCart.length} selected concept{shoppingCart.length !== 1 ? 's' : ''}
          </p>

          {/* Combo Filter (Drug domain only) */}
          {shoppingCart.some((item) => item.domain_id === 'Drug') && (
            <div className="mb-6 flex justify-center">
              <div className="inline-flex flex-col items-start">
                <label htmlFor="comboFilter" className="block text-sm font-medium text-gray-700 mb-2">
                  Drug Filter (optional)
                </label>
                <select
                  id="comboFilter"
                  value={comboFilter}
                  onChange={(e) => setComboFilter(e.target.value as ComboFilter)}
                  className="select-field max-w-xs"
                  disabled={loading}
                >
                  <option value="ALL">All Drugs</option>
                  <option value="SINGLE">Single Ingredient Only</option>
                  <option value="COMBINATION">Combination Drugs Only</option>
                </select>
              </div>
            </div>
          )}

          <button onClick={buildSet} className="btn-primary flex items-center gap-2 mx-auto px-8 py-3 text-lg">
            <PackageCheck className="w-6 h-6" />
            Build Code Set
          </button>
        </div>
      )}

      {/* Rebuild Button (shown after initial build) */}
      {hasBuilt && !loading && shoppingCart.some((item) => item.domain_id === 'Drug') && (
        <div className="card">
          <label htmlFor="comboFilter" className="block text-sm font-medium text-gray-700 mb-2">
            Drug Filter (Drug domain only)
          </label>
          <div className="flex gap-2">
            <select
              id="comboFilter"
              value={comboFilter}
              onChange={(e) => setComboFilter(e.target.value as ComboFilter)}
              className="select-field max-w-xs"
              disabled={loading}
            >
              <option value="ALL">All Drugs</option>
              <option value="SINGLE">Single Ingredient Only</option>
              <option value="COMBINATION">Combination Drugs Only</option>
            </select>
            <button onClick={buildSet} className="btn-primary" disabled={loading}>
              Rebuild
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card text-center py-12">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Building code set...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <>
          {/* Export Buttons */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Export Code Set ({results.length} codes)
            </h3>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleExportTxt} className="btn-primary flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export as TXT
              </button>
              <button
                onClick={handleCopySql}
                className={`
                  btn-secondary flex items-center gap-2
                  ${sqlCopied ? 'bg-green-50 text-green-700 border-green-200' : ''}
                `}
              >
                {sqlCopied ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy SQL Snippet
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results by Vocabulary */}
          {Object.entries(groupedResults).map(([vocabulary, vocabResults]) => (
            <div key={vocabulary} className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="badge badge-primary">{vocabulary}</span>
                <span className="text-sm font-normal text-gray-500">
                  ({vocabResults.length} codes)
                </span>
              </h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Concept ID</th>
                      <th>Class</th>
                      {vocabResults[0]?.combinationyesno && <th>Combo</th>}
                      {vocabResults[0]?.dose_form && <th>Dose Form</th>}
                      {vocabResults[0]?.dfg_name && <th>DFG Category</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {vocabResults.map((result, index) => (
                      <tr key={`${result.child_concept_id}-${index}`}>
                        <td className="font-mono text-sm">{result.child_code}</td>
                        <td className="font-medium">{result.child_name}</td>
                        <td className="text-sm">{result.child_concept_id}</td>
                        <td className="text-xs text-gray-600">{result.concept_class_id}</td>
                        {result.combinationyesno && (
                          <td>
                            <span
                              className={`badge ${
                                result.combinationyesno === 'COMBINATION'
                                  ? 'badge-warning'
                                  : 'badge-success'
                              }`}
                            >
                              {result.combinationyesno}
                            </span>
                          </td>
                        )}
                        {result.dose_form && (
                          <td className="text-xs text-gray-600">{result.dose_form}</td>
                        )}
                        {result.dfg_name && (
                          <td>
                            <span className="badge badge-info text-xs">
                              {result.dfg_name}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
