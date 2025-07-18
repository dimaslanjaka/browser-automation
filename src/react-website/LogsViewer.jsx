import { useEffect, useMemo, useState } from 'react';
import { Accordion, Badge, FormControl, InputGroup, Pagination, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import copyToClipboard from '../utils/copyToClipboard.js';
import { ucwords } from '../utils/string.js';
import styles from './LogsViewer.module.scss';
import Footer from './components/Footer.jsx';
import Header from './components/Header.jsx';
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
        {/* NIK with copy button */}
        <div className="d-flex align-items-center mb-2">
          <span className="fw-bold me-2">NIK:</span>
          <span className="me-2">{log.data?.nik || ''}</span>
          {log.data?.nik && (
            <button
              className="btn btn-sm btn-outline-secondary"
              title="Copy NIK"
              style={{ padding: '2px 6px', fontSize: '1rem', lineHeight: 1 }}
              onClick={() => {
                copyToClipboard(log.data.nik);
              }}>
              <i className="fa fa-copy" aria-hidden="true"></i>
            </button>
          )}
        </div>
        <div className={`${styles.logTimestamp} mb-2`}>Timestamp: {log.timestamp || ''}</div>
        <div className={`${styles.logMessage} mb-2 ${indicatorCLass}`}>{log.message || log.data?.message || ''}</div>
        <span className={styles.sectionTitle}>Basic Data</span>
        <Table bordered striped className={`mb-3 ${styles.table}`}>
          <tbody>
            <tr>
              <th>Tanggal Input</th>
              <td>
                {log.data?.tanggal || ''}
                {log.data?.tanggal && (
                  <button
                    className="btn btn-sm btn-outline-secondary ms-2"
                    title="Copy Tanggal"
                    style={{ padding: '2px 6px', fontSize: '1rem', lineHeight: 1 }}
                    onClick={() => copyToClipboard(log.data.tanggal)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
            </tr>
            <tr>
              <th>Nama</th>
              <td>
                {ucwords(log.data?.nama || '')}
                {log.data?.nama && (
                  <button
                    className="btn btn-sm btn-outline-secondary ms-2"
                    title="Copy Nama"
                    style={{ padding: '2px 6px', fontSize: '1rem', lineHeight: 1 }}
                    onClick={() => copyToClipboard(log.data.nama)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
            </tr>
            <tr>
              <th>Tanggal Lahir</th>
              <td>
                {log.data?.tgl_lahir || ''}
                {log.data?.tgl_lahir && (
                  <button
                    className="btn btn-sm btn-outline-secondary ms-2"
                    title="Copy Tgl Lahir"
                    style={{ padding: '2px 6px', fontSize: '1rem', lineHeight: 1 }}
                    onClick={() => copyToClipboard(log.data.tgl_lahir)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
            </tr>
            <tr>
              <th>Alamat</th>
              <td>
                {log.data?.alamat || ''}
                {log.data?.alamat && (
                  <button
                    className="btn btn-sm btn-outline-secondary ms-2"
                    title="Copy Alamat"
                    style={{ padding: '2px 6px', fontSize: '1rem', lineHeight: 1 }}
                    onClick={() => copyToClipboard(log.data.alamat)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
            </tr>
            <tr>
              <th>BB</th>
              <td>
                {log.data?.bb || ''}
                {log.data?.bb && (
                  <button
                    className="btn btn-sm btn-outline-secondary ms-2"
                    title="Copy BB"
                    style={{ padding: '2px 6px', fontSize: '1rem', lineHeight: 1 }}
                    onClick={() => copyToClipboard(log.data.bb)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
            </tr>
            <tr>
              <th>TB</th>
              <td>
                {log.data?.tb || ''}
                {log.data?.tb && (
                  <button
                    className="btn btn-sm btn-outline-secondary ms-2"
                    title="Copy TB"
                    style={{ padding: '2px 6px', fontSize: '1rem', lineHeight: 1 }}
                    onClick={() => copyToClipboard(log.data.tb)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
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
              <th>Umur</th>
              <td>{log.data?.age !== undefined && log.data?.age !== null ? `${log.data.age} Tahun` : ''}</td>
            </tr>
            <tr>
              <th>Pekerjaan</th>
              <td>
                {log.data?.pekerjaan || ''}
                {log.data?.pekerjaan && (
                  <button
                    className="btn btn-sm btn-outline-secondary ms-2"
                    title="Copy Pekerjaan"
                    style={{ padding: '2px 6px', fontSize: '1rem', lineHeight: 1 }}
                    onClick={() => copyToClipboard(log.data.pekerjaan)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
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
                      <td>{(log.data.parsed_nik.data.kelamin || '') === 'P' ? 'Perempuan' : 'Laki-laki'}</td>
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
                            {log.data.parsed_nik.data.kelurahan.map((kel, i) =>
                              kel && typeof kel === 'object' && kel.name ? (
                                <li className="list-group-item" key={i}>
                                  {kel.name}{' '}
                                  <span className="text-muted">
                                    (ID: {kel.id}, District: {kel.district_id})
                                  </span>
                                </li>
                              ) : null
                            )}
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
  const [filters, setFilters] = useState({ status: '', gender: '', provinsi: '', kotakab: '', kecamatan: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [activeKeys, setActiveKeys] = useState([]); // [] means all collapsed
  const [filterOpen, setFilterOpen] = useState(false); // Collapsible filter state
  const batch = 20;
  const navigate = useNavigate();
  const { theme } = useTheme();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    import('../utils/json-crypto.js').then(({ decryptJson }) => {
      import('axios').then(({ default: axios }) => {
        axios.get('/browser-automation/assets/data/logs.json', { responseType: 'text' })
          .then((res) => {
            let data = [];
            const secret = import.meta.env.VITE_JSON_SECRET;
            try {
              data = decryptJson(res.data, secret);
            } catch (err) {
              console.error('Failed to decrypt logs:', err);
              data = [];
            }
            if (mounted) setLogs(data);
            setLoading(false);
          })
          .catch((err) => {
            console.error('Failed to fetch logs:', err);
            if (mounted) setLogs([]);
            setLoading(false);
          });
      });
    });
    return () => {
      mounted = false;
    };
  }, []);

  const successCount = useMemo(() => logs.filter((log) => log.data && log.data.status === 'success').length, [logs]);
  const failCount = useMemo(
    () => logs.filter((log) => log.data && (log.data.status === 'failed' || log.data.status === 'error')).length,
    [logs]
  );
  const invalidCount = useMemo(() => logs.filter((log) => log.data && log.data.status === 'invalid').length, [logs]);

  // Collect unique values for provinsi, kotakab, kecamatan for filter dropdowns
  const provinsiOptions = useMemo(() => {
    const set = new Set();
    logs.forEach((log) => {
      const val = log.data?.parsed_nik?.data?.provinsi;
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [logs]);

  const kotakabOptions = useMemo(() => {
    const set = new Set();
    logs.forEach((log) => {
      const val = log.data?.parsed_nik?.data?.kotakab;
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [logs]);

  const kecamatanOptions = useMemo(() => {
    const set = new Set();
    logs.forEach((log) => {
      const val = log.data?.parsed_nik?.data?.namaKec;
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    // Apply search
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      result = result.filter((log) => {
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
    }
    // Apply filters
    if (filters.status) {
      result = result.filter((log) => log.data?.status === filters.status);
    }
    if (filters.gender) {
      result = result.filter((log) => {
        // Check gender in main data (should be 'L' or 'P')
        const genderMain = (log.data?.gender || '').toUpperCase();
        // Check gender in parsed_nik (kelamin, should be 'L' or 'P')
        const genderParsed = (log.data?.parsed_nik?.data?.kelamin || '').toUpperCase();
        const filterGender = filters.gender.toUpperCase();
        return genderMain === filterGender || genderParsed === filterGender;
      });
    }
    if (filters.provinsi) {
      result = result.filter((log) => log.data?.parsed_nik?.data?.provinsi === filters.provinsi);
    }
    if (filters.kotakab) {
      result = result.filter((log) => log.data?.parsed_nik?.data?.kotakab === filters.kotakab);
    }
    if (filters.kecamatan) {
      result = result.filter((log) => log.data?.parsed_nik?.data?.namaKec === filters.kecamatan);
    }
    return result;
  }, [logs, search, filters]);

  const totalPages = Math.ceil(filteredLogs.length / batch);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * batch, currentPage * batch);
  // Debug: log the state of logs and pagination
  useEffect(() => {
    console.log(
      'filteredLogs.length:',
      filteredLogs.length,
      'totalPages:',
      totalPages,
      'currentPage:',
      currentPage,
      'paginatedLogs.length:',
      paginatedLogs.length
    );
    if (currentPage > 1 && paginatedLogs.length === 0) {
      setCurrentPage(1);
    }
  }, [filteredLogs.length, totalPages, currentPage, paginatedLogs.length]);

  useEffect(() => {
    setCurrentPage(1);
    setActiveKeys([]); // Reset expanded accordions on search or filter change
  }, [search, filters]);
  useEffect(() => {
    setActiveKeys([]); // Reset expanded accordions on page change
  }, [currentPage]);

  if (loading) {
    return <div className="text-center my-5">Loading logs...</div>;
  }

  return (
    <>
      <Header />
      <div className="m-0 m-md-5">
        <div
          id="logs-viewer"
          className={`container mx-auto py-4 bg-body-tertiary ${styles.container}`}
          data-bs-theme={theme}>
          <button type="button" className={`btn ${theme === 'dark' ? 'btn-outline-light' : 'btn-outline-dark'} mb-3`} onClick={() => navigate('/')}>
            <i className="fa fa-arrow-left me-2" /> Back
          </button>
          {/* Theme toggle UI omitted for brevity */}
          <h1 className="my-4 text-body text-center">{pageTitle}</h1>
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
              Invalid: {invalidCount}
            </Badge>
            <Badge
              bg="secondary"
              className="px-3 py-1 fw-normal text-center"
              style={{ fontSize: '0.95em', minWidth: 120 }}>
              Error: {failCount}
            </Badge>
          </div>
          {/* Filter UI - collapsible */}
          <div className="mb-3">
            <button
              type="button"
              className={`btn btn-sm ${theme === 'dark' ? 'btn-outline-light' : 'btn-outline-dark'} mb-2`}
              style={{ width: '100%' }}
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((v) => !v)}>
              <i className={`fa ${filterOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i> Filter Options
            </button>
            {filterOpen && (
              <div className="row g-2">
                <div className="col-12 col-sm-6">
                  <div className="d-grid" style={{ gridTemplateColumns: '110px 1fr', alignItems: 'center' }}>
                    <label
                      className="form-label mb-0 text-end pe-2"
                      htmlFor="filter-status"
                      style={{ whiteSpace: 'nowrap' }}>
                      Status:
                    </label>
                    <select
                      id="filter-status"
                      className="form-select form-select-sm"
                      value={filters.status}
                      onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                      <option value="">All</option>
                      <option value="success">Success</option>
                      <option value="invalid">Invalid</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                </div>
                <div className="col-12 col-sm-6">
                  <div className="d-grid" style={{ gridTemplateColumns: '110px 1fr', alignItems: 'center' }}>
                    <label
                      className="form-label mb-0 text-end pe-2"
                      htmlFor="filter-gender"
                      style={{ whiteSpace: 'nowrap' }}>
                      Gender:
                    </label>
                    <select
                      id="filter-gender"
                      className="form-select form-select-sm"
                      value={filters.gender}
                      onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value }))}>
                      <option value="">All</option>
                      <option value="L">L</option>
                      <option value="P">P</option>
                    </select>
                  </div>
                </div>
                <div className="col-12 col-sm-6">
                  <div className="d-grid" style={{ gridTemplateColumns: '110px 1fr', alignItems: 'center' }}>
                    <label
                      className="form-label mb-0 text-end pe-2"
                      htmlFor="filter-provinsi"
                      style={{ whiteSpace: 'nowrap' }}>
                      Provinsi:
                    </label>
                    <select
                      id="filter-provinsi"
                      className="form-select form-select-sm"
                      value={filters.provinsi}
                      onChange={(e) => setFilters((f) => ({ ...f, provinsi: e.target.value }))}>
                      <option value="">All</option>
                      {provinsiOptions.map((prov, i) => (
                        <option value={prov} key={i}>
                          {prov}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-12 col-sm-6">
                  <div className="d-grid" style={{ gridTemplateColumns: '110px 1fr', alignItems: 'center' }}>
                    <label
                      className="form-label mb-0 text-end pe-2"
                      htmlFor="filter-kotakab"
                      style={{ whiteSpace: 'nowrap' }}>
                      Kota/Kab:
                    </label>
                    <select
                      id="filter-kotakab"
                      className="form-select form-select-sm"
                      value={filters.kotakab}
                      onChange={(e) => setFilters((f) => ({ ...f, kotakab: e.target.value }))}>
                      <option value="">All</option>
                      {kotakabOptions.map((kab, i) => (
                        <option value={kab} key={i}>
                          {kab}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-12 col-sm-6">
                  <div className="d-grid" style={{ gridTemplateColumns: '110px 1fr', alignItems: 'center' }}>
                    <label
                      className="form-label mb-0 text-end pe-2"
                      htmlFor="filter-kecamatan"
                      style={{ whiteSpace: 'nowrap' }}>
                      Kecamatan:
                    </label>
                    <select
                      id="filter-kecamatan"
                      className="form-select form-select-sm"
                      value={filters.kecamatan}
                      onChange={(e) => setFilters((f) => ({ ...f, kecamatan: e.target.value }))}>
                      <option value="">All</option>
                      {kecamatanOptions.map((kec, i) => (
                        <option value={kec} key={i}>
                          {kec}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-12 col-sm-6">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger w-100"
                    title="Clear Filters"
                    onClick={() => setFilters({ status: '', gender: '', provinsi: '', kotakab: '', kecamatan: '' })}>
                    <i className="fa fa-times" /> Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search UI */}
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
              onClick={() => setActiveKeys([])}>
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
            }}>
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
                      <Pagination.Item active={page === currentPage} key={page} onClick={() => setCurrentPage(page)}>
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
      <Footer />
    </>
  );
}
