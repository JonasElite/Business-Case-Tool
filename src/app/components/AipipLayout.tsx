import { Outlet } from 'react-router';
import { AppProvider } from '../context/AppContext';
import { AipipHomePage } from '../pages/AipipHomePage';
import { Package } from 'lucide-react';

function AipipHomeWrapper() {
  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      <nav className="bg-[#00338D] text-white flex items-center h-10 shrink-0 px-4 gap-3">
        <Package className="w-4 h-4" />
        <span className="text-sm font-bold">AIPIP – Business Case Simulator</span>
        <span className="ml-auto text-xs text-blue-200">v0.3 — Mock-up</span>
      </nav>
      <main className="flex-1 px-4 pb-4 overflow-auto">
        <AipipHomePage />
      </main>
    </div>
  );
}

export function AipipLayout() {
  return (
    <AppProvider>
      <Outlet />
    </AppProvider>
  );
}

export { AipipHomeWrapper };
