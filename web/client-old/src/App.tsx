import React from 'react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-bg text-gray-900 dark:text-white">
      <header className="bg-white dark:bg-dark-card shadow">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">LitAssist</h1>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Login</button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-dark-card shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome to LitAssist</h2>
          <p className="mb-4">This is the academic literature assistant powered by web scraping and data processing.</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Get Started</button>
        </div>
      </main>
      <footer className="bg-gray-200 dark:bg-dark-border mt-8 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600 dark:text-gray-400">
          &copy; {new Date().getFullYear()} LitAssist. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default App;