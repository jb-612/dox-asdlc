import { Outlet } from "react-router-dom";
import { useUIStore } from "../stores/uiStore";
import Header from "./Header";
import Sidebar from "./Sidebar";
import CompareBar from "./CompareBar";

export default function Layout() {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            pt-16 lg:pt-0
          `}
        >
          <Sidebar />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-h-screen lg:pl-0">
          <div className="p-4 lg:p-6 pb-24">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Compare bar */}
      <CompareBar />
    </div>
  );
}
