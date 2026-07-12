import './globals.css';
import React from 'react';

export const metadata = {
  title: 'SLM Router Studio',
  description:
    'Multi-modal SLM query router — pick a model, ground with web search, and route to the best model.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-studio-canvas font-sans text-studio-text antialiased">
        {children}
      </body>
    </html>
  );
}
