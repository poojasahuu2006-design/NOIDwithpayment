import React from 'react';
import { Sparkles, Database } from 'lucide-react';

export default function Navbar({ dbConnected }) {
  return (
    <header className="app-header no-print">
      <div className="brand-wrapper">
        <img
          src="/photos/NOID.jpg"
          alt="NOID Logo"
          className="brand-logo"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/NOID.jpg';
          }}
        />
        <div className="brand-info">
          <h1>
            NOID <span className="brand-badge">v2.0</span>
          </h1>
          <p>Dynamic Student ID Card Generator</p>
        </div>
      </div>

      <div className="db-status-pill" title={dbConnected ? "Connected to MySQL Database" : "Using in-memory fallback dataset"}>
        <div className={`status-dot ${dbConnected ? 'online' : 'fallback'}`} />
        <span>{dbConnected ? 'MySQL Active' : 'Fallback Active'}</span>
      </div>
    </header>
  );
}
