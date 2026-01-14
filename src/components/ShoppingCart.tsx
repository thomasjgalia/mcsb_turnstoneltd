import { ShoppingCart as CartIcon, X, Trash2, PackageCheck } from 'lucide-react';
import type { CartItem } from '../lib/types';

interface ShoppingCartProps {
  items: CartItem[];
  onRemove: (hierarchyConceptId: number) => void;
  onClear: () => void;
  onBuildCodeSet: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShoppingCart({
  items,
  onRemove,
  onClear,
  onBuildCodeSet,
  isOpen,
  onClose,
}: ShoppingCartProps) {
  const itemCount = items.length;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-primary-50">
          <div className="flex items-center gap-2">
            <CartIcon className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Shopping Cart
            </h2>
            {itemCount > 0 && (
              <span className="badge badge-primary">{itemCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {itemCount > 0 && (
              <button
                onClick={onClear}
                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                title="Clear all items"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              title="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {itemCount === 0 ? (
            <div className="text-center py-12">
              <CartIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">
                Your cart is empty
              </p>
              <p className="text-gray-400 text-xs mt-2">
                Add concepts from Step 2 to build your code set
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.hierarchy_concept_id}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-primary-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
                        {item.concept_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="badge badge-primary text-xs">
                          {item.vocabulary_id}
                        </span>
                        <span className="text-xs text-gray-500">
                          ID: {item.hierarchy_concept_id}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {item.concept_class_id}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemove(item.hierarchy_concept_id)}
                      className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors"
                      title="Remove from cart"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Build Button */}
        {itemCount > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => {
                onBuildCodeSet();
                onClose();
              }}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <PackageCheck className="w-5 h-5" />
              Build Code Set ({itemCount})
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Generate comprehensive code sets from all concepts in cart
            </p>
          </div>
        )}
      </div>
    </>
  );
}
