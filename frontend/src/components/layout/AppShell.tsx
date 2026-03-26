import { Link, Outlet, useLocation } from "react-router-dom";
import { ImageUp, Settings, History, LogOut, Sparkles } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

export default function AppShell() {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Enhance", icon: ImageUp },
    { path: "/history", label: "History", icon: History },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-900">ImageEnhance Pro</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">AI-Powered Photo Enhancement</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-2">
            <p className="font-medium text-gray-900">{user?.full_name || user?.email}</p>
            <p className="text-xs text-gray-500">{user?.images_processed || 0} images processed</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
