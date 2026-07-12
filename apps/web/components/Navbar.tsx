import React from 'react';
import { Activity, Cpu, Layers, Settings, Zap } from 'lucide-react';
import { SettingsPanel } from './SettingsPanel/SettingsPanel';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'query', label: 'Multi-Modal Query', icon: Zap },
    { id: 'system-instructions', label: 'System Instructions', icon: Settings },
    { id: 'analytics', label: 'Processing & Routing', icon: Activity },
    { id: 'benchmark', label: 'OCR & STT Benchmarks', icon: Layers },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20">
            <Cpu className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold tracking-tight text-white">SLM Router</span>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
                v0.1.0
              </span>
            </div>
            <p className="text-xs text-gray-400">Multi-Modal Small Language Model Query Orchestrator</p>
          </div>
        </div>

        <nav className="flex items-center space-x-1 rounded-xl bg-gray-900/90 p-1 border border-gray-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center space-x-3">
          <div className="hidden items-center space-x-2 rounded-full bg-emerald-500/10 px-3 py-1.5 border border-emerald-500/20 lg:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-300">5 Microservices Online</span>
          </div>
          <SettingsPanel />
        </div>
      </div>
    </header>
  );
};
