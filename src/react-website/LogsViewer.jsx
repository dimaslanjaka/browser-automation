import { useEffect, useMemo, useState } from 'react';
import { Accordion, Badge, FormControl, InputGroup, Pagination, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { ucwords } from '../utils/string.js';
import styles from './LogsViewer.module.scss';
import { useTheme } from './components/ThemeContext.jsx';

function LogAccordionItem({ log, idx }) {
  const isSuccessMsg = typeof log.message === 'string' && log.message.toLowerCase().includes('success');
  let indicatorCLass = '';
  if (log.data?.status === 'invalid') {
    indicatorCLass = styles.textInvalid;
  } else if (log.data?.status === 'success') {
    indicatorCLass = styles.textSuccess;
  } else {
    indicatorCLass = styles.textError;
  }
  return (
    <Accordion.Item eventKey={String(idx)} className={styles.accordionItem}>
      <Accordion.Header className={styles.accordionHeader}>
        <span className="d-block w-100">
          <span className={`fw-bold ${indicatorCLass}`}>{log.data?.nik || ''}</span> - {ucwords(log.data?.nama || '')}
        </span>
      </Accordion.Header>
      <Accordion.Body className={styles.accordionBody}>
        <div className={`${styles.logTimestamp} mb-2`}>Timestamp: {log.timestamp || ''}</div>
        <div className={`${styles.logMessage} mb-2 ${indicatorCLass}`}>
          {log.message || ''}
        </div>
        <span className={styles.sectionTitle}>Basic Data</span>
        <Table bordered striped className={`mb-3 ${styles.table}`}>
          <tbody>
            <tr>
              <th>Tanggal</th>
              <td>{log.data?.tanggal || ''}</td>
            </tr>
            <tr>
              <th>Nama</th>
              <td>{ucwords(log.data?.nama || '')}</td>
            </tr>
            <tr>
              <th>Tgl Lahir</th>
              <td>{log.data?.tgl_lahir || ''}</td>
            </tr>
            <tr>
              <th>Alamat</th>
              <td>{log.data?.alamat || ''}</td>
            </tr>
            <tr>
              <th>BB</th>
              <td>{log.data?.bb || ''}</td>
            </tr>
            <tr>
              <th>TB</th>
              <td>{log.data?.tb || ''}</td>
            </tr>
            <tr>
              <th>Petugas</th>
              <td>{log.data?.petugas || ''}</td>
            </tr>
            <tr>
              <th>Status</th>
              <td>{log.data?.status || ''}</td>
            </tr>
            <tr>
              <th>Gender</th>
              <td>{log.data?.gender || ''}</td>
            </tr>
            <tr>
              <th>Age</th>
              <td>{log.data?.age || ''}</td>
            </tr>
            <tr>
              <th>Pekerjaan</th>
              <td>{log.data?.pekerjaan || ''}</td>
            </tr>
          </tbody>
        </Table>
        {log.data?.parsed_nik && (
          <>
            <span className="section-title">Parsed NIK</span>
            <Table bordered hover className="mb-3 parsed-nik-table">
              <tbody>
                <tr>
                  <th>Status</th>
                  <td>{log.data.parsed_nik.status || ''}</td>
                </tr>
                <tr>
                  <th>Message</th>
                  <td>{log.data.parsed_nik.message || ''}</td>
                </tr>
                {log.data.parsed_nik.data && (
                  <>
                    <tr>
                      <th>NIK</th>
                      <td>{log.data.parsed_nik.data.nik || ''}</td>
                    </tr>
                    <tr>
                      <th>Kelamin</th>
                      <td>{log.data.parsed_nik.data.kelamin || ''}</td>
                    </tr>
                    <tr>
                      <th>Lahir</th>
                      <td>{log.data.parsed_nik.data.lahir || ''}</td>
                    </tr>
                    <tr>
                      <th>Provinsi</th>
                      <td>{log.data.parsed_nik.data.provinsi || ''}</td>
                    </tr>
                    <tr>
                      <th>Kota/Kab</th>
                      <td>{log.data.parsed_nik.data.kotakab || ''}</td>
                    </tr>
                    <tr>
                      <th>Kecamatan</th>
                      <td>{log.data.parsed_nik.data.namaKec || ''}</td>
                    </tr>
                    <tr>
                      <th>Uniqcode</th>
                      <td>{log.data.parsed_nik.data.uniqcode || ''}</td>
                    </tr>
                    <tr>
                      <th>Original Lahir</th>
                      <td>{log.data.parsed_nik.data.originalLahir || ''}</td>
                    </tr>
                    <tr>
                      <th>Kelurahan</th>
                      <td>
                        {Array.isArray(log.data.parsed_nik.data.kelurahan) ? (
                          <ul className="list-group list-group-flush">
                            {log.data.parsed_nik.data.kelurahan.map((kel, i) => (
                              kel && typeof kel === 'object' && kel.name ? (
                                <li className="list-group-item" key={i}>
                                  {kel.name}{' '}
                                  <span className="text-muted">
                                    (ID: {kel.id}, District: {kel.district_id})
                                  </span>
                                </li>
                              ) : null
                            ))}
                          </ul>
                        ) : (
                          ''
                        )}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </Table>
          </>
        )}
        {log.data?.formValues && (
          <>
            <span className="section-title">Form Values</span>
            <Table bordered size="sm" className="mb-3">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {log.data.formValues.map((field, i) => (
                  <tr key={i}>
                    <td>{field.label || ''}</td>
                    <td>{field.value || '<empty>'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Accordion.Body>
    </Accordion.Item>
  );
}

export default function LogsViewer({ pageTitle = 'Log Viewer' }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeKeys, setActiveKeys] = useState([]); // [] means all collapsed
  const batch = 20;
  const navigate = useNavigate();
  const { theme } = useTheme();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    import('../utils/json-crypto.js').then(({ decryptJson }) => {
      fetch('/browser-automation/assets/data/logs.json')
        .then((res) => res.text())
        .then((encryptedText) => {
          let data = [];
          const secret = import.meta.env.VITE_JSON_SECRET;
          try {
            data = decryptJson(encryptedText, secret);
          } catch (err) {
            console.error('Failed to decrypt logs:', err);
            data = [];
          }
          if (mounted) setLogs(data);
        })
        .catch(() => {
          if (mounted) setLogs([]);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    });
    return () => {
      mounted = false;
    };
  }, []);

  const successCount = useMemo(() => logs.filter((log) => log.data && log.data.status === 'success').length, [logs]);
  const failCount = useMemo(() => logs.filter((log) => log.data && log.data.status !== 'success').length, [logs]);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      const fields = [
        log.data?.nik,
        log.data?.nama,
        log.message,
        log.data?.tanggal,
        log.data?.alamat,
        log.data?.petugas,
        log.data?.status,
        log.data?.gender,
        log.data?.age,
        log.data?.pekerjaan
      ];
      return fields.some((f) => typeof f === 'string' && f.toLowerCase().includes(query));
    });
  }, [logs, search]);

  const totalPages = Math.ceil(filteredLogs.length / batch);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * batch, currentPage * batch);
  // Debug: log the state of logs and pagination
  useEffect(() => {
    console.log('filteredLogs.length:', filteredLogs.length, 'totalPages:', totalPages, 'currentPage:', currentPage, 'paginatedLogs.length:', paginatedLogs.length);
    if (currentPage > 1 && paginatedLogs.length === 0) {
      setCurrentPage(1);
    }
  }, [filteredLogs.length, totalPages, currentPage, paginatedLogs.length]);

  useEffect(() => {
    setCurrentPage(1);
    setActiveKeys([]); // Reset expanded accordions on search change
  }, [search]);
  useEffect(() => {
    setActiveKeys([]); // Reset expanded accordions on page change
  }, [currentPage]);

  if (loading) {
    return <div className="text-center my-5">Loading logs...</div>;
  }

  return (
    <>
      <div className="m-0 m-md-5">
        <div
          id="logs-viewer"
          className={`container mx-auto py-4 bg-body-tertiary ${styles.container}`}
          data-bs-theme={theme}>
          <button type="button" className="btn btn-outline-secondary mb-3" onClick={() => navigate('/')}>
            <i className="fa fa-arrow-left me-2" /> Back
          </button>
          {/* Theme toggle UI omitted for brevity */}
          <h1 className="my-4 text-body">{pageTitle}</h1>
          <div className="mb-4 d-flex flex-wrap justify-content-center gap-2">
            <Badge
              bg="success"
              className="px-3 py-1 fw-normal text-center"
              style={{ fontSize: '0.95em', minWidth: 120 }}>
              Success: {successCount}
            </Badge>
            <Badge
              bg="danger"
              className="px-3 py-1 fw-normal text-center"
              style={{ fontSize: '0.95em', minWidth: 120 }}>
              Not Success: {failCount}
            </Badge>
          </div>
          <InputGroup className="mb-3" id="log-search-group">
            <InputGroup.Text>
              <i className="fa-solid fa-magnifying-glass"></i>
            </InputGroup.Text>
            <FormControl
              type="text"
              placeholder="Search logs..."
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className={styles.collapseAllBtn + ' ms-2'}
              title="Collapse All"
              onClick={() => setActiveKeys([])}
            >
              <i className="fa-solid fa-compress" /> <span className="sr-only">Collapse All</span>
            </button>
          </InputGroup>
          <Accordion
            style={{ maxHeight: '70vh', overflowY: 'auto' }}
            activeKey={activeKeys}
            onSelect={(eventKey) => {
              if (!eventKey) return;
              setActiveKeys((prev) => {
                const key = String(eventKey);
                let arr = Array.isArray(prev) ? prev : [];
                if (arr.includes(key)) {
                  // Collapse
                  return arr.filter((k) => k !== key);
                } else {
                  // Expand
                  return [...arr, key];
                }
              });
            }}
          >
            {paginatedLogs.map((log, idx) => (
              <LogAccordionItem log={log} idx={String(idx + 1 + (currentPage - 1) * batch)} key={idx} />
            ))}
          </Accordion>
          {/* Pagination */}
          <div className={`my-3 d-flex justify-content-center ${styles.paginationScroll}`}>
            <Pagination size="sm">
              <Pagination.Prev disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                <i className="fa fa-angle-left" aria-hidden="true"></i>
                <span className="visually-hidden">Previous</span>
              </Pagination.Prev>
              {/* Compact pagination: show first, last, current, +/-2, and ellipsis */}
              {(() => {
                const pages = [];
                const pageWindow = 2; // show 2 before/after current
                let addedLeftEllipsis = false;
                let addedRightEllipsis = false;
                for (let page = 1; page <= totalPages; page++) {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - pageWindow && page <= currentPage + pageWindow)
                  ) {
                    pages.push(
                      <Pagination.Item
                        active={page === currentPage}
                        key={page}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Pagination.Item>
                    );
                  } else if (page < currentPage - pageWindow && !addedLeftEllipsis && page !== 1) {
                    pages.push(<Pagination.Ellipsis key="left-ellipsis" disabled />);
                    addedLeftEllipsis = true;
                  } else if (page > currentPage + pageWindow && !addedRightEllipsis && page !== totalPages) {
                    pages.push(<Pagination.Ellipsis key="right-ellipsis" disabled />);
                    addedRightEllipsis = true;
                  }
                }
                return pages;
              })()}
              <Pagination.Next
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                <i className="fa fa-angle-right" aria-hidden="true"></i>
                <span className="visually-hidden">Next</span>
              </Pagination.Next>
            </Pagination>
          </div>
          {/* Loading spinner example (not used) */}
          {/* <div className="text-center my-3">
          <Spinner animation="border" variant="primary" /> Loading more logs...
        </div> */}
        </div>
      </div>
    </>
  );
}
