import { useNavigate } from "react-router-dom";
import { useUIStore } from "../stores/uiStore";

export default function CompareBar() {
  const navigate = useNavigate();
  const compareProducts = useUIStore((state) => state.compareProducts);
  const clearCompare = useUIStore((state) => state.clearCompare);

  if (compareProducts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg safe-bottom z-30">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-900">
            {compareProducts.length} selected
          </span>
          <button
            onClick={clearCompare}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>

        <button
          onClick={() => navigate("/compare")}
          disabled={compareProducts.length < 2}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Compare ({compareProducts.length})
        </button>
      </div>
    </div>
  );
}
