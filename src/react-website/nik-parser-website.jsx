import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, Col, Container, Form, Row } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { decryptJson } from '../utils/json-crypto';
import AdSense from './components/Adsense';
import { useTheme } from './components/ThemeContext';
import Header from './components/Header';
import Footer from './components/Footer';

/**
 * @type {import('highlight.js').HLJSApi | undefined}
 */
let hljs;
/**
 * @type {import('highlight.js').Language | undefined}
 */
let jsonLang;
/**
 * @type {((nik: string) => any) | undefined}
 */
let nikParser;

async function loadHighlightAndNikParser() {
  if (!hljs) {
    const [hljsCore, jsonLangMod, nikParserMod] = await Promise.all([
      import('highlight.js/lib/core'),
      import('highlight.js/lib/languages/json'),
      import('nik-parser-jurusid/region_controller_async')
    ]);
    hljs = hljsCore.default || hljsCore;
    jsonLang = jsonLangMod.default || jsonLangMod;
    nikParser = nikParserMod.default || nikParserMod;
    hljs.registerLanguage('json', jsonLang);
  }
}

/**
 * NIK Parser React App
 * @returns {React.ReactElement}
 */
export default function NikParserWeb() {
  const [nik, setNik] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const resultRef = useRef(null);
  const navigate = useNavigate();
  const { theme } = useTheme();

  /**
   * Handle form submit and parse NIK
   * @param {React.FormEvent<HTMLFormElement>} e
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loadHighlightAndNikParser();
      let dataKunto = [];
      try {
        const axios = (await import('axios')).default;
        const response = await axios.get('/browser-automation/assets/data/dataKunto.json', { responseType: 'text' });
        const encodedResponse = response.data;
        const secret = import.meta.env.VITE_JSON_SECRET;
        dataKunto = decryptJson(encodedResponse, secret);
      } catch (error) {
        console.error('Failed to decrypt dataKunto:', error);
      }
      const parsed = await nikParser(nik);
      const result = {
        'nik-parser-result': parsed,
        'current-data': dataKunto.find((item) => item.nik === nik) || null
      };
      setResult(result);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (result && resultRef.current && hljs) {
      hljs.highlightElement(resultRef.current);
    }
  }, [result]);
  return (
    <>
      <Header />
      <Container className="mt-5" data-bs-theme={theme}>
        <Row className="justify-content-center">
          <Col xs={12}>
            <Card className="bg-body-tertiary text-body" style={{ borderRadius: '0.5rem' }}>
              <Card.Body>
                <Button
                  variant={`${theme === 'dark' ? 'outline-light' : 'outline-dark'}`}
                  className="mb-3"
                  onClick={() => navigate('/')}>
                  <i className="fa fa-arrow-left me-2" /> Back
                </Button>
                <AdSense client="ca-pub-1048456668116270" slot="3470283861" />
                <Card.Title className="text-center">NIK Parser React App</Card.Title>
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3" controlId="formNik">
                    <Form.Label>Input NIK</Form.Label>
                    <Form.Control
                      type="text"
                      value={nik}
                      onChange={(e) => setNik(e.target.value)}
                      placeholder="Enter NIK"
                    />
                  </Form.Group>
                  <Button variant="primary" type="submit" disabled={loading}>
                    {loading ? 'Parsing...' : 'Parse'}
                  </Button>
                </Form>
                {result && (
                  <Card className="mt-3">
                    <Card.Body>
                      <Card.Title>Result</Card.Title>
                      <pre ref={resultRef} className="hljs language-json">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </Card.Body>
                  </Card>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
      <Footer />
    </>
  );
}
