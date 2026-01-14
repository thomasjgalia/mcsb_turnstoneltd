import { useState, useEffect } from 'react';
import { GitBranch, Loader2, AlertCircle, Plus, ArrowLeft, CheckCircle } from 'lucide-react';
import { getHierarchy } from '../lib/api';
import type { SearchResult, HierarchyResult, CartItem, DomainType } from '../lib/types';

interface Step2HierarchyProps {
  selectedConcept: SearchResult | null;
  selectedDomain: DomainType | null;
  onAddToCart: (item: CartItem) => void;
  onBackToSearch: () => void;
  onProceedToCodeSet: () => void;
  currentStep: number;
}

export default function Step2Hierarchy({
  selectedConcept,
  selectedDomain,
  onAddToCart,
  onBackToSearch,
  onProceedToCodeSet,
  currentStep,
}: Step2HierarchyProps) {
  const [hierarchyResults, setHierarchyResults] = useState<HierarchyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (selectedConcept && currentStep === 2) {
      loadHierarchy();
    }
  }, [selectedConcept, currentStep]);

  const loadHierarchy = async () => {
    if (!selectedConcept) return;

    setLoading(true);
    setError(null);
    setHierarchyResults([]);

    try {
      const data = await getHierarchy({
        concept_id: selectedConcept.std_concept_id,
      });

      setHierarchyResults(data);

      if (data.length === 0) {
        setError('No hierarchy found for this concept.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (result: HierarchyResult) => {
    const cartItem: CartItem = {
      hierarchy_concept_id: result.hierarchy_concept_id,
      concept_name: result.concept_name,
      vocabulary_id: result.vocabulary_id,
      concept_class_id: result.concept_class_id,
      root_term: result.root_term,
      domain_id: selectedDomain || 'Drug', // Use the actual selected domain
    };

    onAddToCart(cartItem);
    setAddedItems(new Set(addedItems).add(result.hierarchy_concept_id));

    // Navigate to Step 3 after a brief delay to show the "Added" feedback
    setTimeout(() => {
      onProceedToCodeSet();
    }, 500);
  };

  const isAdded = (conceptId: number) => addedItems.has(conceptId);

  // Group results by relationship type
  const parents = hierarchyResults.filter((r) => r.steps_away > 0);
  const self = hierarchyResults.filter((r) => r.steps_away === 0);
  const children = hierarchyResults.filter((r) => r.steps_away < 0);

  if (!selectedConcept) {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Concept Selected
        </h3>
        <p className="text-gray-500 mb-4">
          Please go back to Step 1 and select a concept
        </p>
        <button onClick={onBackToSearch} className="btn-primary">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Search
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Step 2: Explore Hierarchy</h2>
        <p className="text-gray-600 mt-1">
          Review the hierarchy and choose the starting point (root concept) to add to your code set build.
        </p>
      </div>

      {/* Selected Concept Info */}
      <div className="card bg-primary-50 border-primary-200">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {selectedConcept.standard_name}
            </h3>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-primary">
                {selectedConcept.standard_vocabulary}
              </span>
              <span className="badge bg-gray-100 text-gray-800">
                ID: {selectedConcept.std_concept_id}
              </span>
              <span className="badge bg-gray-100 text-gray-800">
                Code: {selectedConcept.standard_code}
              </span>
            </div>
          </div>
          <button onClick={onBackToSearch} className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card text-center py-12">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading hierarchy...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Hierarchy Results */}
      {!loading && hierarchyResults.length > 0 && (
        <div className="space-y-6">
          {/* Parents (Ancestors) */}
          {parents.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-blue-600" />
                Ancestors ({parents.length})
              </h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Steps Away</th>
                      <th>Concept Name</th>
                      <th>ID</th>
                      <th>Vocabulary</th>
                      <th>Class</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parents.map((result) => (
                      <tr key={result.hierarchy_concept_id}>
                        <td>
                          <span className="badge bg-blue-100 text-blue-800">
                            +{result.steps_away}
                          </span>
                        </td>
                        <td className="font-medium">{result.concept_name}</td>
                        <td className="text-sm">{result.hierarchy_concept_id}</td>
                        <td>
                          <span className="badge badge-primary">{result.vocabulary_id}</span>
                        </td>
                        <td className="text-xs text-gray-600">{result.concept_class_id}</td>
                        <td>
                          <button
                            onClick={() => handleAddToCart(result)}
                            disabled={isAdded(result.hierarchy_concept_id)}
                            className={`
                              btn-table flex items-center gap-1 text-xs
                              ${isAdded(result.hierarchy_concept_id) ? 'bg-green-50 text-green-700 border-green-200' : ''}
                            `}
                          >
                            {isAdded(result.hierarchy_concept_id) ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                Add
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Selected Concept (Self - steps_away = 0) */}
          {self.length > 0 && (
            <div className="card border-2 border-purple-300 bg-purple-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-purple-600" />
                Selected Concept
              </h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Steps Away</th>
                      <th>Concept Name</th>
                      <th>ID</th>
                      <th>Vocabulary</th>
                      <th>Class</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {self.map((result) => (
                      <tr key={result.hierarchy_concept_id}>
                        <td>
                          <span className="badge bg-purple-100 text-purple-800">
                            {result.steps_away}
                          </span>
                        </td>
                        <td className="font-medium">{result.concept_name}</td>
                        <td className="text-sm">{result.hierarchy_concept_id}</td>
                        <td>
                          <span className="badge badge-primary">{result.vocabulary_id}</span>
                        </td>
                        <td className="text-xs text-gray-600">{result.concept_class_id}</td>
                        <td>
                          <button
                            onClick={() => handleAddToCart(result)}
                            disabled={isAdded(result.hierarchy_concept_id)}
                            className={`
                              btn-table flex items-center gap-1 text-xs
                              ${isAdded(result.hierarchy_concept_id) ? 'bg-green-50 text-green-700 border-green-200' : ''}
                            `}
                          >
                            {isAdded(result.hierarchy_concept_id) ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                Add
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Children (Descendants) */}
          {children.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-green-600 transform rotate-180" />
                Descendants ({children.length})
              </h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Steps Away</th>
                      <th>Concept Name</th>
                      <th>ID</th>
                      <th>Vocabulary</th>
                      <th>Class</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {children.map((result) => (
                      <tr key={result.hierarchy_concept_id}>
                        <td>
                          <span className="badge bg-green-100 text-green-800">
                            {result.steps_away}
                          </span>
                        </td>
                        <td className="font-medium">{result.concept_name}</td>
                        <td className="text-sm">{result.hierarchy_concept_id}</td>
                        <td>
                          <span className="badge badge-primary">{result.vocabulary_id}</span>
                        </td>
                        <td className="text-xs text-gray-600">{result.concept_class_id}</td>
                        <td>
                          <button
                            onClick={() => handleAddToCart(result)}
                            disabled={isAdded(result.hierarchy_concept_id)}
                            className={`
                              btn-table flex items-center gap-1 text-xs
                              ${isAdded(result.hierarchy_concept_id) ? 'bg-green-50 text-green-700 border-green-200' : ''}
                            `}
                          >
                            {isAdded(result.hierarchy_concept_id) ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                Add
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
