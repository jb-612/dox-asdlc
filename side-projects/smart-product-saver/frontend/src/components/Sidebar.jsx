import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCollections, createCollection } from "../api/client";
import clsx from "clsx";

export default function Sidebar() {
  const queryClient = useQueryClient();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: getCollections,
  });

  const createMutation = useMutation({
    mutationFn: createCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setNewName("");
      setShowNewForm(false);
    },
  });

  const handleCreateCollection = (e) => {
    e.preventDefault();
    if (newName.trim()) {
      createMutation.mutate({ name: newName.trim() });
    }
  };

  const linkClass = ({ isActive }) =>
    clsx(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
      isActive
        ? "bg-primary-50 text-primary-700"
        : "text-gray-700 hover:bg-gray-100"
    );

  return (
    <nav className="h-full flex flex-col p-4">
      <div className="space-y-1">
        <NavLink to="/" end className={linkClass}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          All Products
        </NavLink>
      </div>

      {/* Collections */}
      <div className="mt-6">
        <div className="flex items-center justify-between px-3 mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Collections
          </h3>
          <button
            onClick={() => setShowNewForm(true)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            aria-label="Add collection"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* New collection form */}
        {showNewForm && (
          <form onSubmit={handleCreateCollection} className="px-3 mb-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-3 py-1 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewForm(false);
                  setNewName("");
                }}
                className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Collection list */}
        {isLoading ? (
          <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-1">
            {collections.map((collection) => (
              <NavLink
                key={collection.id}
                to={`/collection/${collection.id}`}
                className={linkClass}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: collection.color || "#9CA3AF" }}
                />
                <span className="flex-1 truncate">{collection.name}</span>
                <span className="text-xs text-gray-400">
                  {collection.product_count}
                </span>
              </NavLink>
            ))}
          </div>
        )}
      </div>

      {/* Bottom spacer */}
      <div className="flex-1" />
    </nav>
  );
}
