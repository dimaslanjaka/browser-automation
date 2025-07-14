import React from 'react';
import { Card, Container } from 'react-bootstrap';
import htmlFiles from '../tmp/html-files.json' with { type: 'json' }; // Assuming this file contains the list of HTML files

const _react = typeof React;

export default function Home() {
  return (
    <Container className="mt-5">
      <Card>
        <Card.Body>
          <Card.Title>Browser Automation Tools</Card.Title>
          <Card.Text>
            Welcome to the Browser Automation project! This site provides tools and utilities for automating browser tasks, parsing data, and more.
            <br /><br />
            <b>Features:</b>
            <ul>
              <li>Parse Indonesian NIK numbers with instant results</li>
              <li>Analyze and convert XLSX/CSV data</li>
              <li>Log viewer and analyzer</li>
              <li>Easy integration with browser automation scripts</li>
            </ul>
            <br />
            <a href="/browser-automation/nik-parser" className="btn btn-primary">Go to NIK Parser</a>
            <br /><br />
            <b>Available HTML Files:</b>
            <ul>
              {htmlFiles.map((file) => (
                <li key={file}>
                  <a href={`/browser-automation/${file}`} target="_blank" rel="noopener noreferrer">{file}</a>
                </li>
              ))}
            </ul>
          </Card.Text>
        </Card.Body>
      </Card>
    </Container>
  );
}
