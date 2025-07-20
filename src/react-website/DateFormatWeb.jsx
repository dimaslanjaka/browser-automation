import React, { useState } from 'react';
// Font Awesome 6 Pro icon usage assumes global CSS or library import is present
import copyToClipboard from '../utils/copyToClipboard';
import moment from 'moment-timezone';
import { Container, Form, Button } from 'react-bootstrap';
import Header from './components/Header';
import Footer from './components/Footer';
import { useTheme } from './components/ThemeContext';
import { getViteUrl } from '../utils-browser-esm';

const defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';

const STORAGE_KEY = 'dateFormatWebInputs';
const DateFormatWeb = () => {
  // Restore from localStorage if available
  const getInitial = (key, fallback) => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return saved[key] !== undefined ? saved[key] : fallback;
    } catch {
      return fallback;
    }
  };
  // Helper to get current local datetime in 'YYYY-MM-DDTHH:mm' format
  const getNowLocalDatetime = () => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };
  // Helper to get current local datetime in 'YYYY-MM-DDTHH:mm:ss' format
  const getNowLocalDatetimeWithSeconds = () => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  };
  const [datePicker, setDatePicker] = useState(() => {
    const initial = getInitial('datePicker', '');
    if (initial) return initial;
    return getNowLocalDatetime();
  });
  const [dateString, setDateString] = useState(() => {
    const initial = getInitial('dateString', '');
    if (initial) return initial;
    // If no dateString, generate from now
    const nowVal = getNowLocalDatetime();
    const m = moment(nowVal, 'YYYY-MM-DDTHH:mm');
    return m.isValid() ? m.format('YYYY-MM-DDTHH:mm:ss') : '';
  });
  const [timezone, setTimezone] = useState(() => getInitial('timezone', moment.tz.guess()));
  const [outputFormat, setOutputFormat] = useState(() => getInitial('outputFormat', defaultFormat));
  const [result, setResult] = useState('');
  const { theme } = useTheme();

  // Save to localStorage on input change
  const saveInputs = (next) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          dateString: next.dateString,
          datePicker: next.datePicker,
          timezone: next.timezone,
          outputFormat: next.outputFormat
        })
      );
    } catch (_e) {
      // ignore
    }
  };

  const handleConvert = () => {
    if (!dateString) {
      setResult('Please enter a date string or pick a date.');
      return;
    }
    const m = moment.tz(dateString, timezone);
    if (!m.isValid()) {
      setResult('Invalid date or timezone.');
      return;
    }
    setResult(m.format(outputFormat));
  };

  // Handlers that update state and localStorage
  const handleDateString = (e) => {
    const val = e.target.value;
    setDateString(val);
    // Try to parse and sync datePicker if possible
    let pickerVal = '';
    const m = moment(val, moment.ISO_8601, true);
    if (m.isValid()) {
      pickerVal = m.format('YYYY-MM-DDTHH:mm');
    }
    setDatePicker(pickerVal);
    saveInputs({
      dateString: val,
      datePicker: pickerVal,
      timezone,
      outputFormat
    });
    handleConvert();
  };

  // Set both dateString and datePicker to now
  const handleSetNow = () => {
    const nowPicker = getNowLocalDatetime();
    const nowString = getNowLocalDatetimeWithSeconds();
    setDatePicker(nowPicker);
    setDateString(nowString);
    saveInputs({
      dateString: nowString,
      datePicker: nowPicker,
      timezone,
      outputFormat
    });
    handleConvert();
  };
  const handleDatePicker = (e) => {
    const val = e.target.value;
    setDatePicker(val);
    // Always set dateString in ISO format with seconds
    let generated = '';
    if (val) {
      // val is always 'YYYY-MM-DDTHH:mm' from input
      const m = moment(val, 'YYYY-MM-DDTHH:mm');
      if (m.isValid()) {
        generated = m.format('YYYY-MM-DDTHH:mm:ss');
      }
    }
    setDateString(generated);
    saveInputs({
      dateString: generated,
      datePicker: val,
      timezone,
      outputFormat
    });
  };
  const handleTimezone = (e) => {
    setTimezone(e.target.value);
    saveInputs({
      dateString,
      datePicker,
      timezone: e.target.value,
      outputFormat
    });
    handleConvert();
  };
  const handleOutputFormat = (e) => {
    setOutputFormat(e.target.value);
    saveInputs({
      dateString,
      datePicker,
      timezone,
      outputFormat: e.target.value
    });
  };

  return (
    <>
      <Header />
      <Container style={{ margin: '2rem auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2 className="mb-4">Moment Timezone Converter</h2>
        <Form>
          <Form.Group className="mb-3" controlId="dateString">
            <Form.Label>Date String</Form.Label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Control
                type="text"
                value={dateString}
                onChange={handleDateString}
                placeholder="e.g. 2025-07-19 08:35:23"
              />
              <Button
                variant={theme === 'dark' ? 'outline-light' : 'outline-dark'}
                size="sm"
                title="Set to current date/time"
                onClick={handleSetNow}
                style={{ display: 'flex', alignItems: 'center' }}>
                <i className="fa-duotone fa-clock" style={{ fontSize: 16 }} aria-hidden="true"></i>
                <span className="visually-hidden">Now</span>
              </Button>
            </div>
          </Form.Group>
          <Form.Group className="mb-3" controlId="datePicker">
            <Form.Label>Date Picker</Form.Label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="datetime-local"
                className="form-control"
                value={datePicker || ''}
                onChange={handleDatePicker}
              />
              <Button
                variant={theme === 'dark' ? 'outline-light' : 'outline-dark'}
                size="sm"
                title="Set to current date/time"
                onClick={handleSetNow}
                style={{ display: 'flex', alignItems: 'center' }}>
                <i className="fa-duotone fa-clock" style={{ fontSize: 16 }} aria-hidden="true"></i>
                <span className="visually-hidden">Now</span>
              </Button>
            </div>
          </Form.Group>
          <Form.Group className="mb-3" controlId="timezone">
            <Form.Label>
              Timezone
              <a
                href={getViteUrl('/moment/timezones')}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginLeft: 8,
                  fontSize: 13,
                  textDecoration: 'underline',
                  color: theme === 'dark' ? '#ccc' : '#333'
                }}>
                (reference)
              </a>
            </Form.Label>
            <Form.Control
              type="text"
              value={timezone}
              onChange={handleTimezone}
              placeholder="Asia/Jakarta"
              list="tz-list"
            />
            <datalist id="tz-list">
              {moment.tz.names().map((tz) => (
                <option value={tz} key={tz} />
              ))}
            </datalist>
          </Form.Group>
          <Form.Group className="mb-3" controlId="outputFormat">
            <Form.Label>
              Output Format
              <a
                href={getViteUrl('/moment/snippet')}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginLeft: 8,
                  fontSize: 13,
                  textDecoration: 'underline',
                  color: theme === 'dark' ? '#ccc' : '#333'
                }}>
                (reference)
              </a>
            </Form.Label>
            <Form.Control type="text" value={outputFormat} onChange={handleOutputFormat} placeholder={defaultFormat} />
          </Form.Group>
          <Button variant="primary" onClick={handleConvert} style={{ width: '100%', padding: 8, fontWeight: 'bold' }}>
            Convert
          </Button>
        </Form>
        <div style={{ marginTop: 24, wordBreak: 'break-all' }}>
          <strong>Result:</strong>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
            <div style={{ fontSize: 18, flex: 1 }}>{result}</div>
            <Button
              variant={theme === 'dark' ? 'outline-light' : 'outline-dark'}
              size="sm"
              style={{ marginLeft: 8, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}
              onClick={() => result && copyToClipboard(result)}
              title="Copy to clipboard">
              <i className="fa-duotone fa-copy" style={{ fontSize: 18 }} aria-hidden="true"></i>
              <span className="visually-hidden">Copy</span>
            </Button>
          </div>
        </div>
      </Container>
      <Footer />
    </>
  );
};

export default DateFormatWeb;
