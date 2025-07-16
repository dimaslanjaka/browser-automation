import hljs from 'highlight.js/lib/core';
import jsonLang from 'highlight.js/lib/languages/json';
import 'highlight.js/styles/github.css';
import nikParser from 'nik-parser-jurusid';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, Col, Container, Form, Row } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import dataKunto from '../../tmp/dataKunto.json' with { type: 'json' };
hljs.registerLanguage('json', jsonLang);

/**
 * NIK Parser React App
 * @returns {React.ReactElement}
 */
export default function NikParserWeb() {
  const [nik, setNik] = useState('');
  const [result, setResult] = useState(null);
  const resultRef = useRef(null);
  const navigate = useNavigate();

  /**
   * Handle form submit and parse NIK
   * @param {React.FormEvent<HTMLFormElement>} e
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const parsed = nikParser(nik);
      const result = {
        'nik-parser-result': parsed,
        'current-data': dataKunto.find((item) => item.nik === nik) || null
      };
      setResult(result);
    } catch (err) {
      setResult({ error: err.message });
    }
  };

  useEffect(() => {
    if (result && resultRef.current) {
      hljs.highlightElement(resultRef.current);
    }
  }, [result]);
  return (
    <Container className="mt-5">
      <Row className="justify-content-center">
        <Col xs={12}>
          <Card>
            <Card.Body>
              <Button
                variant="outline-secondary"
                className="mb-3"
                onClick={() => navigate('/')}
              >
                <i className="fa fa-arrow-left me-2" /> Back
              </Button>
              {/* ...existing code... */}
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
                <Button variant="primary" type="submit">
                  Parse
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
  );
}
