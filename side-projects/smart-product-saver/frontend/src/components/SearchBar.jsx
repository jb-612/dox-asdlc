import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchProducts } from "../api/client";

export default function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchProducts(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const handleSelect = (productId) => {
    navigate(`/product/${productId}`);
    setQuery("");
    setShowResults(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          placeholder="Search products..."
          className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-lg text-sm focus:outline-none focus:bg-white focus:border-gray-300"
        />
      </div>

      {/* Search results dropdown */}
      {showResults && query.length >= 2 && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowResults(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-20">
            {isLoading ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                Searching...
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                No products found
              </div>
            ) : (
              <ul>
                {results.map((product) => (
                  <li key={product.id}>
                    <button
                      onClick={() => handleSelect(product.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                    >
                      {product.thumbnail ? (
                        <img
                          src={product.thumbnail}
                          alt=""
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {product.title}
                        </p>
                        <p className="text-xs text-gray-500">{product.domain}</p>
                      </div>
                      {product.price && (
                        <span className="text-sm font-semibold text-green-600">
                          {product.currency || "$"}
                          {product.price}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
