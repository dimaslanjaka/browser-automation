import './main.scss';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './src/react-website/components/ThemeContext.jsx'; // IMPORTANT: Do NOT lazy load ThemeProvider. It must wrap the app at the top level for context to work.
const Home = React.lazy(() => import('./src/react-website/Home.jsx'));
const NikParserApp = React.lazy(() => import('./src/react-website/nik-parser-website.jsx'));
const LogsViewer = React.lazy(() => import('./src/react-website/LogsViewer.jsx'));
const DateSnippet = React.lazy(() => import('./src/react-website/DateSnippet.jsx'));
const Outbound = React.lazy(() => import('./src/react-website/Outbound.jsx'));
const FullTimezoneListPage = React.lazy(() =>
  import('./src/react-website/FullTimezoneList.jsx').then((module) => ({
    default: module.FullTimezoneListPage
  }))
);
const DateFormatWeb = React.lazy(() => import('./src/react-website/DateFormatWeb.jsx'));
const KemkesIndonesiaKuLogs = React.lazy(() => import('./src/react-website/KemkesIndonesiaKuLogs.jsx'));

const _react = typeof React;
const root = ReactDOM.createRoot(document.getElementById('root'));

// Add Backspace navigation handler
window.addEventListener('keydown', function (e) {
  // Only trigger on Backspace, not in input/textarea/contenteditable
  if (
    e.key === 'Backspace' &&
    !e.repeat &&
    !(
      document.activeElement &&
      (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable)
    )
  ) {
    // Only go back if previous page is in same domain
    if (window.history.length > 1) {
      const prevUrl = document.referrer;
      if (prevUrl && prevUrl.startsWith(window.location.origin)) {
        e.preventDefault();
        window.history.back();
      }
    }
  }
});

root.render(
  <ThemeProvider>
    <BrowserRouter basename="/browser-automation">
      <React.Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/nik-parser" element={<NikParserApp />} />
          <Route path="/logs" element={<LogsViewer />} />
          {/* <Route path="*" element={<div>Page not found</div>} /> */}
          <Route path="/moment/snippet" element={<DateSnippet />} />
          <Route path="/moment/timezones" element={<FullTimezoneListPage />} />
          <Route path="/moment" element={<DateFormatWeb />} />
          <Route path="/outbound" element={<Outbound />} />
          <Route path="/sehatindonesiaku-logs" element={<KemkesIndonesiaKuLogs />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  </ThemeProvider>
);
