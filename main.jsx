import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Home from './react-website/Home.jsx';
import NikParserApp from './react-website/nik-parser-website.jsx';

const _react = typeof React;
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter basename="/browser-automation">
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/nik-parser" element={<NikParserApp />} />
    </Routes>
  </BrowserRouter>
);
