import React from 'react';
import { Card, Container } from 'react-bootstrap';
import htmlFiles from '../../tmp/html-files.json' with { type: 'json' };
import AdSense from '../components/Adsense';
import Footer from './components/Footer';
import Header from './components/Header';

const _react = typeof React;

export default function Home() {
  return (
    <>
      <Header />
      <Container>
        {/* Hero Section */}
        <Card className="mb-4 shadow-sm border-0">
          <Card.Body>
            <Card.Title as="h1" className="display-5 mb-3">
              Browser Automation Tools
            </Card.Title>
            <Card.Text className="lead">
              Welcome to the Browser Automation project!
              <br />
              <span className="fw-light">
                Tools and utilities for automating browser tasks, parsing data, and more.
              </span>
            </Card.Text>
          </Card.Body>
        </Card>

        {/* Features Section */}
        <Card className="mb-4">
          <Card.Body>
            <Card.Title as="h2" className="h4 mb-3">
              Features
            </Card.Title>
            <ul className="list-group list-group-flush mb-3">
              <li className="list-group-item">Parse Indonesian NIK numbers with instant results</li>
              <li className="list-group-item">Analyze and convert XLSX/CSV data</li>
              <li className="list-group-item">Log viewer and analyzer</li>
              <li className="list-group-item">Easy integration with browser automation scripts</li>
            </ul>
            <div className="d-flex gap-3 flex-wrap mb-3">
              <a href="/browser-automation/nik-parser" className="btn">
                Go to NIK Parser
              </a>
              <a href="/browser-automation/logs" className="btn">
                Last runner logs
              </a>
            </div>
            <AdSense client="ca-pub-1048456668116270" slot="3470283861" />
          </Card.Body>
        </Card>

        {/* HTML Files Section */}
        <Card>
          <Card.Body>
            <Card.Title as="h2" className="h5 mb-3">
              Available HTML Files
            </Card.Title>
            <ul className="list-group list-group-flush">
              {htmlFiles.map((file) => (
                <li className="list-group-item" key={file}>
                  <a href={`/browser-automation/${file}`} target="_blank" rel="noopener noreferrer">
                    {file}
                  </a>
                </li>
              ))}
            </ul>
          </Card.Body>
        </Card>
      </Container>
      <Footer />
    </>
  );
}
