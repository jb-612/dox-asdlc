import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { getProduct } from "../api/client";
import { useUIStore } from "../stores/uiStore";

export default function CompareView() {
  const navigate = useNavigate();
  const compareProducts = useUIStore((state) => state.compareProducts);
  const clearCompare = useUIStore((state) => state.clearCompare);
  const toggleCompare = useUIStore((state) => state.toggleCompare);

  const productQueries = useQueries({
    queries: compareProducts.map((id) => ({
      queryKey: ["product", id],
      queryFn: () => getProduct(id),
    })),
  });

  const products = productQueries
    .filter((q) => q.isSuccess)
    .map((q) => q.data);

  const isLoading = productQueries.some((q) => q.isLoading);

  if (compareProducts.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900">
          No products to compare
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          Select products from the list to compare them side by side.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Browse Products
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Find min/max prices for highlighting
  const prices = products.filter((p) => p.price).map((p) => parseFloat(p.price));
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Compare Products ({products.length})
        </h1>
        <button
          onClick={() => {
            clearCompare();
            navigate("/");
          }}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Clear All
        </button>
      </div>

      {/* Desktop: Side by side */}
      <div className="hidden md:grid gap-4" style={{ gridTemplateColumns: `repeat(${products.length}, 1fr)` }}>
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            {/* Image */}
            <div className="relative">
              {product.thumbnail ? (
                <img
                  src={product.thumbnail}
                  alt=""
                  className="w-full aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <button
                onClick={() => toggleCompare(product.id)}
                className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow hover:bg-gray-100"
                aria-label="Remove from compare"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Details */}
            <div className="p-4">
              <h3 className="font-medium text-gray-900 line-clamp-2 mb-2">
                {product.title}
              </h3>

              <p className="text-sm text-gray-500 mb-3">{product.domain}</p>

              {/* Price with highlighting */}
              {product.price ? (
                <p
                  className={`text-xl font-bold ${
                    parseFloat(product.price) === minPrice
                      ? "text-green-600"
                      : parseFloat(product.price) === maxPrice
                      ? "text-red-600"
                      : "text-gray-900"
                  }`}
                >
                  {product.currency || "USD"} {product.price}
                  {parseFloat(product.price) === minPrice && prices.length > 1 && (
                    <span className="ml-2 text-xs font-normal bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      Lowest
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-gray-400">No price</p>
              )}

              {product.user_notes && (
                <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  {product.user_notes}
                </p>
              )}

              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
              >
                View Original
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: Swipeable cards */}
      <div className="md:hidden overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex gap-4" style={{ width: `${products.length * 280}px` }}>
          {products.map((product) => (
            <div
              key={product.id}
              className="w-64 flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {product.thumbnail ? (
                <img
                  src={product.thumbnail}
                  alt=""
                  className="w-full aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square bg-gray-100" />
              )}
              <div className="p-3">
                <h3 className="font-medium text-gray-900 line-clamp-2 text-sm">
                  {product.title}
                </h3>
                {product.price && (
                  <p className={`text-lg font-bold mt-2 ${
                    parseFloat(product.price) === minPrice ? "text-green-600" : "text-gray-900"
                  }`}>
                    {product.currency || "USD"} {product.price}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
