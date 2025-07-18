import './main.scss'
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './src/react-website/components/ThemeContext.jsx'; // IMPORTANT: Do NOT lazy load ThemeProvider. It must wrap the app at the top level for context to work.
const Home = React.lazy(() => import('./src/react-website/Home.jsx'));
const NikParserApp = React.lazy(() => import('./src/react-website/nik-parser-website.jsx'));
const LogsViewer = React.lazy(() => import('./src/react-website/LogsViewer.jsx'));

const _react = typeof React;
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider>
    <BrowserRouter basename="/browser-automation">
      <React.Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/nik-parser" element={<NikParserApp />} />
          <Route path="/logs" element={<LogsViewer />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  </ThemeProvider>
);
