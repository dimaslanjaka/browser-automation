import 'bootstrap/dist/css/bootstrap.min.css';
import hljs from 'highlight.js/lib/core';
import jsonLang from 'highlight.js/lib/languages/json';
import 'highlight.js/styles/github.css';
import nikParser from 'nik-parser-jurusid';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, Col, Container, Form, Row } from 'react-bootstrap';
hljs.registerLanguage('json', jsonLang);

export default function App() {
  const [nik, setNik] = useState('');
  const [result, setResult] = useState(null);
  const resultRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const parsed = nikParser(nik);
      setResult(parsed);
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
              <Card.Title>NIK Parser React App</Card.Title>
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
                    <pre ref={resultRef} className="hljs language-json">{JSON.stringify(result, null, 2)}</pre>
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
