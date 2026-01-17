import { useState, useEffect } from 'react';
import { PackageCheck, Loader2, AlertCircle, Download, Copy, CheckCircle, RotateCcw, ArrowLeft, Plus, ChevronDown, ChevronRight, Save } from 'lucide-react';
import { buildCodeSet, exportToTxt, exportToSql, saveCodeSet } from '../lib/api';
import { supabase } from '../lib/supabase';
import SaveCodeSetModal from './SaveCodeSetModal';
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
}: Step3CodeSetProps) {
  const [results, setResults] = useState<CodeSetResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comboFilter, setComboFilter] = useState<ComboFilter>('ALL');
  const [sqlCopied, setSqlCopied] = useState(false);
  const [hasBuilt, setHasBuilt] = useState(false);
  const [selectedVocabularies, setSelectedVocabularies] = useState<Set<string>>(new Set());
  const [excludedCodes, setExcludedCodes] = useState<Set<string>>(new Set());
  const [collapsedVocabs, setCollapsedVocabs] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedAttribute, setSelectedAttribute] = useState<string>('');
  const [selectedValue, setSelectedValue] = useState<string>('');

  // Auto-build when shopping cart is populated (e.g., from editing a saved code set)
  useEffect(() => {
    if (shoppingCart.length > 0 && !hasBuilt && !loading) {
      console.log('Auto-building code set from cart:', shoppingCart);
      buildSet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shoppingCart.length]); // Only run when cart length changes

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
    exportToTxt(filteredResults);
  };

  const handleCopySql = async () => {
    try {
      await exportToSql(filteredResults);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy SQL to clipboard');
    }
  };

  const handleSaveCodeSet = async (name: string, description: string) => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      // Convert built code set results to SavedCodeSetConcept format
      // We need to save the full built code set, not just the shopping cart
      const conceptsToSave = filteredResults.map(result => ({
        hierarchy_concept_id: result.child_concept_id,
        concept_name: result.child_name,
        vocabulary_id: result.child_vocabulary_id,
        concept_class_id: result.concept_class_id,
        root_term: result.root_concept_name,
        domain_id: shoppingCart[0]?.domain_id || 'Condition', // Use domain from cart
      }));

      console.log('💾 Saving code set:', {
        userId: session.user.id,
        name,
        description,
        conceptCount: conceptsToSave.length,
        rootConceptsInCart: shoppingCart.length,
      });

      // Save the built code set (all descendant codes)
      const saveResult = await saveCodeSet(session.user.id, {
        code_set_name: name,
        description: description || `Saved on ${new Date().toLocaleDateString()}`,
        concepts: conceptsToSave,
        source_type: 'OMOP',
      });

      console.log('✅ Code set saved successfully:', saveResult);

      setSaveSuccess(true);
      setShowSaveModal(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('❌ Failed to save code set:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to save code set: ${errorMessage}\n\nCheck browser console for full details.`);
    } finally {
      setSaving(false);
    }
  };

  // Get unique vocabularies from results
  const availableVocabularies = Array.from(
    new Set(results.map((r) => r.child_vocabulary_id))
  ).sort();

  // Get unique attributes from results
  const availableAttributes = Array.from(
    new Set(results.filter((r) => r.concept_attribute).map((r) => r.concept_attribute as string))
  ).sort();

  // Get values for the selected attribute
  const availableValues = selectedAttribute
    ? Array.from(
        new Set(
          results
            .filter((r) => r.concept_attribute === selectedAttribute && r.value)
            .map((r) => r.value as string)
        )
      ).sort()
    : [];

  // Reset selected value when attribute changes
  useEffect(() => {
    setSelectedValue('');
  }, [selectedAttribute]);

  // Filter results based on selected vocabularies and attribute/value
  const visibleResults = results
    .filter((r) => selectedVocabularies.size === 0 || selectedVocabularies.has(r.child_vocabulary_id))
    .filter((r) => {
      // If attribute filter is not active, show all results
      if (!selectedAttribute || !selectedValue) {
        return true;
      }
      // If attribute filter is active, only show matching results
      return r.concept_attribute === selectedAttribute && r.value === selectedValue;
    });

  // Filter for export (exclude unchecked codes)
  const filteredResults = visibleResults
    .filter((r) => !excludedCodes.has(`${r.child_vocabulary_id}:${r.child_code}`));

  // Group visible results by vocabulary (includes excluded codes for display)
  const groupedResults = visibleResults.reduce((acc, result) => {
    if (!acc[result.child_vocabulary_id]) {
      acc[result.child_vocabulary_id] = [];
    }
    acc[result.child_vocabulary_id].push(result);
    return acc;
  }, {} as Record<string, CodeSetResult[]>);

  // Toggle vocabulary filter
  const toggleVocabulary = (vocab: string) => {
    const newSelected = new Set(selectedVocabularies);
    if (newSelected.has(vocab)) {
      newSelected.delete(vocab);
    } else {
      newSelected.add(vocab);
    }
    setSelectedVocabularies(newSelected);
  };

  // Select all vocabularies
  const selectAllVocabularies = () => {
    setSelectedVocabularies(new Set(availableVocabularies));
  };

  // Clear all vocabulary selections
  const clearAllVocabularies = () => {
    setSelectedVocabularies(new Set());
  };

  // Toggle individual code exclusion
  const toggleCodeExclusion = (vocab: string, code: string) => {
    const key = `${vocab}:${code}`;
    const newExcluded = new Set(excludedCodes);
    if (newExcluded.has(key)) {
      newExcluded.delete(key);
    } else {
      newExcluded.add(key);
    }
    setExcludedCodes(newExcluded);
  };

  // Check if a code is excluded
  const isCodeExcluded = (vocab: string, code: string) => {
    return excludedCodes.has(`${vocab}:${code}`);
  };

  // Toggle vocabulary collapse state
  const toggleVocabCollapse = (vocab: string) => {
    const newCollapsed = new Set(collapsedVocabs);
    if (newCollapsed.has(vocab)) {
      newCollapsed.delete(vocab);
    } else {
      newCollapsed.add(vocab);
    }
    setCollapsedVocabs(newCollapsed);
  };

  if (shoppingCart.length === 0) {
    return (
      <div className="card p-6 text-center">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-sm font-medium text-gray-900 mb-1">
          Shopping Cart is Empty
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Add concepts from Step 2
        </p>
        <button onClick={onBackToHierarchy} className="btn-primary text-sm px-3 py-1.5">
          <ArrowLeft className="w-3 h-3 mr-1.5" />
          Back to Hierarchy
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cart Summary */}
      <div className="card p-2 bg-primary-50 border-primary-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
              Building from {shoppingCart.length} concept{shoppingCart.length !== 1 ? 's' : ''}
            </h3>
            <div className="flex flex-wrap gap-1">
              {shoppingCart.map((item) => (
                <span key={item.hierarchy_concept_id} className="badge badge-primary text-xs px-2 py-0.5">
                  {item.concept_name.slice(0, 25)}
                  {item.concept_name.length > 25 ? '...' : ''}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              <button onClick={onBackToHierarchy} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap">
                <ArrowLeft className="w-3 h-3" />
                Back
              </button>
              <button onClick={onBackToSearch} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap">
                <Plus className="w-3 h-3" />
                Add More
              </button>
            </div>
            <button onClick={onStartOver} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 text-red-600 hover:text-red-700 whitespace-nowrap">
              <RotateCcw className="w-3 h-3" />
              Clear Cart
            </button>
          </div>
        </div>
      </div>

      {/* Build Code Set Button */}
      {!hasBuilt && !loading && (
        <div className="card p-4 text-center">
          <PackageCheck className="w-10 h-10 text-primary-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Ready to Build Code Set
          </h3>
          <p className="text-xs text-gray-600 mb-3">
            Generate from {shoppingCart.length} selected concept{shoppingCart.length !== 1 ? 's' : ''}
          </p>

          {/* Combo Filter (Drug domain only) */}
          {shoppingCart.some((item) => item.domain_id === 'Drug') && (
            <div className="mb-3 flex justify-center">
              <div className="inline-flex flex-col items-start">
                <label htmlFor="comboFilter" className="block text-xs font-medium text-gray-700 mb-1">
                  Drug Filter (optional)
                </label>
                <select
                  id="comboFilter"
                  value={comboFilter}
                  onChange={(e) => setComboFilter(e.target.value as ComboFilter)}
                  className="select-field text-sm max-w-xs"
                  disabled={loading}
                >
                  <option value="ALL">All Drugs</option>
                  <option value="SINGLE">Single Ingredient Only</option>
                  <option value="COMBINATION">Combination Drugs Only</option>
                </select>
              </div>
            </div>
          )}

          <button onClick={buildSet} className="btn-primary flex items-center gap-2 mx-auto px-6 py-2 text-sm">
            <PackageCheck className="w-4 h-4" />
            Build Code Set
          </button>
        </div>
      )}

      {/* Rebuild Button (shown after initial build) */}
      {hasBuilt && !loading && shoppingCart.some((item) => item.domain_id === 'Drug') && (
        <div className="card p-3">
          <label htmlFor="comboFilter" className="block text-xs font-medium text-gray-700 mb-1.5">
            Drug Filter
          </label>
          <div className="flex gap-2">
            <select
              id="comboFilter"
              value={comboFilter}
              onChange={(e) => setComboFilter(e.target.value as ComboFilter)}
              className="select-field text-sm max-w-xs"
              disabled={loading}
            >
              <option value="ALL">All Drugs</option>
              <option value="SINGLE">Single Ingredient Only</option>
              <option value="COMBINATION">Combination Drugs Only</option>
            </select>
            <button onClick={buildSet} className="btn-primary text-sm px-4 py-2" disabled={loading}>
              Rebuild
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card p-6 text-center">
          <Loader2 className="w-10 h-10 text-primary-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-600">Building code set...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <>
          {/* Combined Filters Panel */}
          {(availableVocabularies.length > 1 || availableAttributes.length > 0) && (
            <div className="card p-3">
              <div className="flex gap-4">
                {/* Vocabulary Filter */}
                {availableVocabularies.length > 1 && (
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Filter by Vocabulary
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={selectAllVocabularies}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          All
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={clearAllVocabularies}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableVocabularies.map((vocab) => {
                        const count = results.filter((r) => r.child_vocabulary_id === vocab).length;
                        const isSelected = selectedVocabularies.has(vocab);
                        return (
                          <button
                            key={vocab}
                            onClick={() => toggleVocabulary(vocab)}
                            className={`
                              px-2 py-1 rounded-lg border text-xs font-medium transition-colors
                              ${
                                isSelected
                                  ? 'bg-primary-100 border-primary-300 text-primary-700'
                                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                              }
                            `}
                          >
                            {vocab} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Attribute Filter (if attributes exist) */}
                {availableAttributes.length > 0 && (
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      Filter by Attribute
                    </h3>
                    <div className="flex gap-2">
                      <select
                        id="attributeFilter"
                        value={selectedAttribute}
                        onChange={(e) => setSelectedAttribute(e.target.value)}
                        className="select-field text-xs flex-1"
                      >
                        <option value="">All attributes</option>
                        {availableAttributes.map((attr) => (
                          <option key={attr} value={attr}>
                            {attr}
                          </option>
                        ))}
                      </select>
                      <select
                        id="valueFilter"
                        value={selectedValue}
                        onChange={(e) => setSelectedValue(e.target.value)}
                        className="select-field text-xs flex-1"
                        disabled={!selectedAttribute || availableValues.length === 0}
                      >
                        <option value="">All values</option>
                        {availableValues.map((val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                      {(selectedAttribute || selectedValue) && (
                        <button
                          onClick={() => {
                            setSelectedAttribute('');
                            setSelectedValue('');
                          }}
                          className="btn-secondary text-xs px-2 py-1.5 whitespace-nowrap"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <p className="mt-2 text-xs text-gray-500">
                {selectedAttribute && selectedValue
                  ? `Filtered to ${visibleResults.length} codes with ${selectedAttribute} = ${selectedValue}`
                  : selectedVocabularies.size === 0
                  ? `Showing all ${visibleResults.length} codes`
                  : `Showing ${visibleResults.length} of ${results.length} codes from ${selectedVocabularies.size} ${selectedVocabularies.size === 1 ? 'vocabulary' : 'vocabularies'}`}
              </p>
            </div>
          )}

          {/* Export Buttons */}
          <div className="card p-3">
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Export Code Set ({filteredResults.length} codes)
              </h3>
              {excludedCodes.size > 0 && (
                <p className="text-xs text-gray-600 mt-0.5">
                  {excludedCodes.size} code{excludedCodes.size !== 1 ? 's' : ''} excluded
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowSaveModal(true)}
                disabled={saving || shoppingCart.length === 0}
                className={`
                  btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5
                  ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}
                `}
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Code Set'}
                  </>
                )}
              </button>
              <button onClick={handleExportTxt} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5">
                <Download className="w-4 h-4" />
                Export as TXT
              </button>
              <button
                onClick={handleCopySql}
                className={`
                  btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5
                  ${sqlCopied ? 'bg-green-50 text-green-700 border-green-200' : ''}
                `}
              >
                {sqlCopied ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy SQL
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results by Vocabulary */}
          {Object.entries(groupedResults).map(([vocabulary, vocabResults]) => {
            const isCollapsed = collapsedVocabs.has(vocabulary);
            const includedCount = vocabResults.filter((r) => !isCodeExcluded(vocabulary, r.child_code)).length;
            const excludedCount = vocabResults.length - includedCount;

            return (
              <div key={vocabulary} className="card p-3">
                <div
                  className="flex items-center justify-between mb-2 cursor-pointer hover:bg-gray-50 -m-3 p-3 rounded-t-lg"
                  onClick={() => toggleVocabCollapse(vocabulary)}
                >
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="badge badge-primary text-xs px-2 py-0.5">{vocabulary}</span>
                    <span className="text-xs font-normal text-gray-500">
                      ({vocabResults.length} codes)
                    </span>
                  </h3>
                  {excludedCount > 0 && (
                    <span className="text-xs text-gray-600">
                      {excludedCount} excluded
                    </span>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="table-container">
                <table className="table compact-table">
                  <thead>
                    <tr>
                      <th className="w-12 text-xs py-1.5"></th>
                      <th className="text-xs py-1.5">Code</th>
                      <th className="text-xs py-1.5">Name</th>
                      <th className="text-xs py-1.5">Concept ID</th>
                      <th className="text-xs py-1.5">Class</th>
                      {vocabResults[0]?.combinationyesno && <th className="text-xs py-1.5">Combo</th>}
                      {vocabResults[0]?.dose_form && <th className="text-xs py-1.5">Dose Form</th>}
                      {vocabResults[0]?.dfg_name && <th className="text-xs py-1.5">DFG Category</th>}
                      {vocabResults.some((r) => r.concept_attribute) && <th className="text-xs py-1.5">Attribute</th>}
                      {vocabResults.some((r) => r.value) && <th className="text-xs py-1.5">Value</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {vocabResults.map((result, index) => {
                      const isExcluded = isCodeExcluded(vocabulary, result.child_code);
                      return (
                        <tr
                          key={`${result.child_concept_id}-${index}`}
                          className={isExcluded ? 'bg-gray-50 opacity-60' : ''}
                        >
                          <td className="py-1.5 px-2">
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() => toggleCodeExclusion(vocabulary, result.child_code)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              title={isExcluded ? "Include in export" : "Exclude from export"}
                            />
                          </td>
                          <td className="font-mono text-xs py-1.5 px-2">{result.child_code}</td>
                          <td className="font-medium text-sm py-1.5 px-2">{result.child_name}</td>
                          <td className="text-xs py-1.5 px-2">{result.child_concept_id}</td>
                          <td className="text-xs text-gray-600 py-1.5 px-2">{result.concept_class_id}</td>
                        {result.combinationyesno && (
                          <td className="py-1.5 px-2">
                            <span
                              className={`badge text-xs px-1.5 py-0.5 ${
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
                          <td className="text-xs text-gray-600 py-1.5 px-2">{result.dose_form}</td>
                        )}
                        {result.dfg_name && (
                          <td className="py-1.5 px-2">
                            <span className="badge badge-info text-xs px-1.5 py-0.5">
                              {result.dfg_name}
                            </span>
                          </td>
                        )}
                        {vocabResults.some((r) => r.concept_attribute) && (
                          <td className="text-xs text-gray-600 py-1.5 px-2">{result.concept_attribute || '-'}</td>
                        )}
                        {vocabResults.some((r) => r.value) && (
                          <td className="text-xs text-gray-600 py-1.5 px-2">{result.value || '-'}</td>
                        )}
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Save Code Set Modal */}
      <SaveCodeSetModal
        isOpen={showSaveModal}
        onClose={() => !saving && setShowSaveModal(false)}
        onSave={handleSaveCodeSet}
        conceptCount={filteredResults.length}
        saving={saving}
      />
    </div>
  );
}
