import React from 'react';
import { createRoot } from 'react-dom/client';

const Popup = () => {
  return (
    <div className="w-96 h-[600px] p-4 bg-white shadow-lg rounded-lg">
      <h1 className="text-xl font-bold">NostrWatch Umon</h1>
      <p>Welcome to your extension!</p>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
