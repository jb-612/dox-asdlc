import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getProducts, getCollection } from "../api/client";
import { useUIStore } from "../stores/uiStore";
import ProductCard from "./ProductCard";

export default function ProductList() {
  const { id: collectionId } = useParams();
  const viewMode = useUIStore((state) => state.viewMode);

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products", { collectionId }],
    queryFn: () => getProducts({ collectionId }),
  });

  const { data: collection } = useQuery({
    queryKey: ["collection", collectionId],
    queryFn: () => getCollection(collectionId),
    enabled: !!collectionId,
  });

  const products = productsData?.items || [];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {collection?.name || "All Products"}
        </h1>
        {productsData && (
          <p className="text-sm text-gray-500 mt-1">
            {productsData.total} {productsData.total === 1 ? "product" : "products"}
          </p>
        )}
      </div>

      {/* Products grid/list */}
      {productsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No products yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Use the browser extension to save products from any website.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} viewMode="grid" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} viewMode="list" />
          ))}
        </div>
      )}

      {/* Pagination */}
      {productsData && productsData.total_pages > 1 && (
        <div className="mt-8 flex justify-center">
          <p className="text-sm text-gray-500">
            Page {productsData.page} of {productsData.total_pages}
          </p>
        </div>
      )}
    </div>
  );
}
