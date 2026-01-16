import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { checkHealth, upsertUserProfile } from './lib/api';
import type { User } from '@supabase/supabase-js';
import type { CartItem, SearchResult, DomainType } from './lib/types';

// Components (will be created next)
import Navigation from './components/Navigation';
import ShoppingCart from './components/ShoppingCart';
import Step1Search from './components/Step1Search';
import Step2Hierarchy from './components/Step2Hierarchy';
import Step3CodeSet from './components/Step3CodeSet';
import SavedCodeSets from './components/SavedCodeSets';
import AuthPage from './components/AuthPage';
import DirectionsModal from './components/DirectionsModal';
import PendingApprovalPage from './components/PendingApprovalPage';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbWarming, setDbWarming] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [shoppingCart, setShoppingCart] = useState<CartItem[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<SearchResult | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainType | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isDirectionsOpen, setIsDirectionsOpen] = useState(false);

  // Check if auth is disabled for local development
  const authDisabled = import.meta.env.VITE_DISABLE_AUTH === 'true';

  // Check for existing session on mount
  useEffect(() => {
    // Skip auth check if disabled
    if (authDisabled) {
      setUser({ id: 'local-dev', email: 'dev@local.test' } as User);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // Create/update user profile on login
      if (session?.user) {
        upsertUserProfile(
          session.user.id,
          session.user.email!,
          session.user.user_metadata?.display_name
        ).catch(err => console.error('Failed to create user profile:', err));
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      // Create/update user profile on auth state change
      if (session?.user) {
        upsertUserProfile(
          session.user.id,
          session.user.email!,
          session.user.user_metadata?.display_name
        ).catch(err => console.error('Failed to create user profile:', err));
      }
    });

    return () => subscription.unsubscribe();
  }, [authDisabled]);

  // Warm up database connection after user is authenticated
  useEffect(() => {
    if (user && !dbReady && !dbWarming) {
      setDbWarming(true);
      checkHealth()
        .then((result) => {
          console.log('Database warmup successful:', result);
          setDbReady(true);
          setDbWarming(false);
        })
        .catch((error) => {
          console.error('Database warmup failed:', error);
          // Still mark as ready to prevent infinite loop
          setDbReady(true);
          setDbWarming(false);
          // Don't block the UI, just log the error
        });
    }
  }, [user, dbReady, dbWarming]);

  // Handle loading cart items from navigation state (for edit functionality)
  useEffect(() => {
    const state = location.state as { cartItems?: CartItem[]; autoRebuild?: boolean } | null;
    if (state?.cartItems && state.cartItems.length > 0) {
      console.log('Loading cart items from navigation state:', state.cartItems);
      setShoppingCart(state.cartItems);
      setCurrentStep(3);

      // Clear the navigation state to prevent reloading on page refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Shopping cart functions
  const addToCart = (item: CartItem) => {
    // Check if item already exists in cart
    const exists = shoppingCart.some(
      (cartItem) => cartItem.hierarchy_concept_id === item.hierarchy_concept_id
    );

    if (!exists) {
      setShoppingCart([...shoppingCart, item]);
    }
  };

  const removeFromCart = (hierarchyConceptId: number) => {
    setShoppingCart(shoppingCart.filter((item) => item.hierarchy_concept_id !== hierarchyConceptId));
  };

  const clearCart = () => {
    setShoppingCart([]);
  };

  // Navigation functions
  const goToStep = (step: 1 | 2 | 3) => {
    setCurrentStep(step);
  };

  const handleConceptSelected = (concept: SearchResult, domain: DomainType) => {
    setSelectedConcept(concept);
    setSelectedDomain(domain);
    setCurrentStep(2);
    navigate('/hierarchy');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show database warming message
  if (user && dbWarming) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            Connecting to Azure SQL Server
          </h2>
          <p className="mt-2 text-gray-600">
            Please wait while we establish a connection with the database...
          </p>
          <p className="mt-2 text-sm text-gray-500">
            This may take up to a minute if the database was paused.
          </p>
        </div>
      </div>
    );
  }

  // If not authenticated, show auth page
  if (!user) {
    return <AuthPage />;
  }

  // Check if user's email is confirmed
  // Note: Supabase email_confirmed_at field indicates if email is verified
  const isEmailConfirmed = user.email_confirmed_at !== null;

  if (!isEmailConfirmed) {
    return <PendingApprovalPage email={user.email || ''} />;
  }

  return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Medical Code Set Builder - Powered by OMOP Vocabulary Tables
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/saved')}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  My Saved Code Sets
                </button>
                <button
                  onClick={() => setIsDirectionsOpen(true)}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  How to Use
                </button>
                <span className="text-xs text-gray-600">{user.email}</span>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Progress Indicator */}
        <Navigation
          currentStep={currentStep}
          onStepClick={goToStep}
          cartItemCount={shoppingCart.length}
          onCartClick={() => setIsCartOpen(true)}
        />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Main Content Area - Full Width */}
          <div>
            <Routes>
                <Route
                  path="/"
                  element={<Navigate to="/search" replace />}
                />
                <Route
                  path="/search"
                  element={
                    <Step1Search
                      onConceptSelected={handleConceptSelected}
                      currentStep={currentStep}
                    />
                  }
                />
                <Route
                  path="/hierarchy"
                  element={
                    <Step2Hierarchy
                      selectedConcept={selectedConcept}
                      selectedDomain={selectedDomain}
                      onAddToCart={addToCart}
                      onBackToSearch={() => {
                        setCurrentStep(1);
                        navigate('/search');
                      }}
                      onProceedToCodeSet={() => {
                        setCurrentStep(3);
                        navigate('/codeset');
                      }}
                      currentStep={currentStep}
                    />
                  }
                />
                <Route
                  path="/codeset"
                  element={
                    <Step3CodeSet
                      shoppingCart={shoppingCart}
                      onBackToHierarchy={() => {
                        setCurrentStep(2);
                        navigate('/hierarchy');
                      }}
                      onBackToSearch={() => {
                        setCurrentStep(1);
                        navigate('/search');
                      }}
                      onStartOver={() => {
                        clearCart();
                        setSelectedConcept(null);
                        setSelectedDomain(null);
                        setCurrentStep(1);
                        navigate('/search');
                      }}
                      currentStep={currentStep}
                    />
                  }
                />
                <Route
                  path="/saved"
                  element={<SavedCodeSets />}
                />
              </Routes>
          </div>
        </main>

        {/* Shopping Cart Slide-out Panel */}
        <ShoppingCart
          items={shoppingCart}
          onRemove={removeFromCart}
          onClear={clearCart}
          onBuildCodeSet={() => goToStep(3)}
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
        />

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p className="text-center text-sm text-gray-500">
              Medical Code Set Builder | Built with React + Azure SQL Server + Supabase
            </p>
          </div>
        </footer>

        {/* Directions Modal */}
        <DirectionsModal
          isOpen={isDirectionsOpen}
          onClose={() => setIsDirectionsOpen(false)}
        />
      </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
