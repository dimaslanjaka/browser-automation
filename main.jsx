import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
const Home = React.lazy(() => import('./react-website/Home.jsx'));
const NikParserApp = React.lazy(() => import('./react-website/nik-parser-website.jsx'));

const _react = typeof React;
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter basename="/browser-automation">
    <React.Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/nik-parser" element={<NikParserApp />} />
      </Routes>
    </React.Suspense>
  </BrowserRouter>
);
