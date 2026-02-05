import { Link } from "react-router-dom";
import { useUIStore } from "../stores/uiStore";
import clsx from "clsx";

export default function ProductCard({ product, viewMode = "grid" }) {
  const compareProducts = useUIStore((state) => state.compareProducts);
  const toggleCompare = useUIStore((state) => state.toggleCompare);
  const isSelected = compareProducts.includes(product.id);

  if (viewMode === "list") {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4">
        <Link to={`/product/${product.id}`} className="flex-shrink-0">
          {product.thumbnail ? (
            <img
              src={product.thumbnail}
              alt=""
              className="w-20 h-20 object-cover rounded-lg"
            />
          ) : (
            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <Link
            to={`/product/${product.id}`}
            className="text-sm font-medium text-gray-900 hover:text-primary-600 line-clamp-2"
          >
            {product.title}
          </Link>
          <p className="text-xs text-gray-500 mt-1">{product.domain}</p>
          {product.price && (
            <p className="text-sm font-semibold text-green-600 mt-2">
              {product.currency || "USD"} {product.price}
            </p>
          )}
        </div>

        <button
          onClick={() => toggleCompare(product.id)}
          className={clsx(
            "self-start p-2 rounded-lg border transition-colors",
            isSelected
              ? "bg-primary-50 border-primary-300 text-primary-600"
              : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500"
          )}
          aria-label={isSelected ? "Remove from compare" : "Add to compare"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </button>
      </div>
    );
  }

  // Grid view
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden group">
      <Link to={`/product/${product.id}`} className="block aspect-square relative">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Compare checkbox overlay */}
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleCompare(product.id);
          }}
          className={clsx(
            "absolute top-2 right-2 p-1.5 rounded-lg transition-all",
            isSelected
              ? "bg-primary-600 text-white"
              : "bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100"
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isSelected ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            )}
          </svg>
        </button>
      </Link>

      <div className="p-3">
        <Link
          to={`/product/${product.id}`}
          className="text-sm font-medium text-gray-900 hover:text-primary-600 line-clamp-2"
        >
          {product.title}
        </Link>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">{product.domain}</span>
          {product.price && (
            <span className="text-sm font-semibold text-green-600">
              {product.currency || "$"}{product.price}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
