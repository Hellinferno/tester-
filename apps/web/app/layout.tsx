import './globals.css';
import React from 'react';

export const metadata = {
  title: 'SLM Router - Multi-Modal Query Orchestrator',
  description:
    'Intelligent Small Language Model Multi-Modal Query Router with OCR, STT, Analysis, and Routing Engines.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-gray-100 selection:bg-blue-500 selection:text-white">
        <div className="relative flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
