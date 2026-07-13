'use client';

import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatView } from '../components/ChatView';
import { EvalsConsole } from '../components/EvalsConsole';
import { ProviderProvider } from '../lib/providerContext';

export default function StudioPage() {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <ProviderProvider>
      <div className="flex h-screen w-full overflow-hidden bg-studio-canvas text-studio-text">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex min-w-0 flex-1">
          {activeTab === 'chat' ? <ChatView /> : <EvalsConsole />}
        </main>
      </div>
    </ProviderProvider>
  );
}
