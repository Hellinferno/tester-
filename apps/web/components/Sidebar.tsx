'use client';

import React from 'react';
import { Columns3, FileText, FlaskConical, MessageSquare, Mic, Route, Sparkles } from 'lucide-react';
import { SettingsPanel } from './SettingsPanel/SettingsPanel';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const NAV = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'router', label: 'Router', icon: Route },
  { id: 'ocr', label: 'OCR', icon: FileText },
  { id: 'stt', label: 'STT', icon: Mic },
  { id: 'evals', label: 'Evals', icon: FlaskConical },
  { id: 'prompttester', label: 'Prompt tester', icon: Columns3 },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="flex h-screen w-[264px] shrink-0 flex-col border-r border-studio-border bg-studio-rail">
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-studio-blue text-white shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-[16px] font-medium text-studio-text">Testing Ground</div>
          <div className="text-xs text-studio-muted">Studio</div>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors ${
                active ? 'bg-studio-bluesoft font-medium text-studio-bluetext' : 'text-studio-text hover:bg-studio-hover'
              }`}
            >
              <Icon className={`h-[18px] w-[18px] ${active ? 'text-studio-bluetext' : 'text-studio-muted'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-studio-border p-3">
        <SettingsPanel />
      </div>
    </aside>
  );
};
