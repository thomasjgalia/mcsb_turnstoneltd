import { Zap, PackageCheck, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface LandingProps {
  onSelectWorkflow: (workflow: 'direct' | 'hierarchical') => void;
  connectionStatus: 'connecting' | 'connected' | 'error';
  errorMessage?: string;
}

export default function Landing({ onSelectWorkflow, connectionStatus, errorMessage = '' }: LandingProps) {

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            MCSB Oracle Code Set Builder
          </h1>
          <p className="text-lg text-gray-600">
            What type of code set are you building?
          </p>
        </div>

        {/* Connection Status */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {connectionStatus === 'connecting' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">Connecting to database...</span>
            </>
          )}
          {connectionStatus === 'connected' && (
            <>
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">Database connected</span>
            </>
          )}
          {connectionStatus === 'error' && (
            <>
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700">{errorMessage}</span>
            </>
          )}
        </div>

        {/* Workflow Selection Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Hierarchical Build Card */}
          <button
            onClick={() => onSelectWorkflow('hierarchical')}
            disabled={connectionStatus !== 'connected'}
            className="group relative bg-white rounded-lg border-2 border-gray-200 p-8 text-left transition-all hover:border-primary-500 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:shadow-none"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                <PackageCheck className="w-6 h-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Hierarchical Build
                </h3>
                <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                  Comprehensive
                </span>
              </div>
            </div>

            <p className="text-gray-600 mb-4">
              Build comprehensive code sets with all descendant concepts from the vocabulary hierarchy.
              Includes child concepts and related mappings.
            </p>

            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Works best for Condition, Drug and Observation domains</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Complete hierarchy with all descendants</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Explore relationships before building</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700">Workflow:</p>
              <p className="text-sm text-gray-500">Search → Explore Hierarchy → Build</p>
            </div>

            <div className="absolute bottom-4 right-4 text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-sm font-medium">Select →</span>
            </div>
          </button>

          {/* Direct Build Card */}
          <button
            onClick={() => onSelectWorkflow('direct')}
            disabled={connectionStatus !== 'connected'}
            className="group relative bg-white rounded-lg border-2 border-gray-200 p-8 text-left transition-all hover:border-primary-500 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:shadow-none"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                <Zap className="w-6 h-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Direct Build
                </h3>
                <span className="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                  Fast & Precise
                </span>
              </div>
            </div>

            <p className="text-gray-600 mb-4">
              Build exact code sets from search results without hierarchical expansion.
              Returns only the specific concepts you select.
            </p>

            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Works best for Procedure, Measurement and Device domains</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Quick results - no hierarchy processing</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Precise control over included concepts</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700">Workflow:</p>
              <p className="text-sm text-gray-500">Search → Filter → Build</p>
            </div>

            <div className="absolute bottom-4 right-4 text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-sm font-medium">Select →</span>
            </div>
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Not sure which to choose? Direct Build is faster for simple lists,
            while Hierarchical Build is better for comprehensive clinical concept sets.
          </p>
        </div>
      </div>
    </div>
  );
}
