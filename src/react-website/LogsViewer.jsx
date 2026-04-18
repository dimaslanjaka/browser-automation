import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Accordion, Badge, FormControl, InputGroup, Pagination } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getViteUrl } from '../utils-browser-esm.js';
import { decryptJson } from '../utils/json-crypto.js';
import { useTheme } from './components/ThemeContext.jsx';
import styles from './LogsViewer.module.scss';
import Footer from './components/Footer.jsx';
import Header from './components/Header.jsx';
import LogAccordionItem from './LogAccordionItem.jsx';

export default function LogsViewer({ pageTitle = 'Log Viewer' }) {
  const [logs, setLogs] = useState(/** @type {import('../runner/skrin/types.js').SkrinDatabaseEntry[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [imageDb, setImageDb] = useState({});
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
    (async () => {
      setLoading(true);
      const secret = import.meta.env.VITE_JSON_SECRET;
      try {
        // Fetch logs
        const res = await axios.get(getViteUrl('/assets/data/logs.bin'), { responseType: 'text' });
        let data = [];
        try {
          data = decryptJson(res.data, secret);
        } catch (err) {
          console.error('Failed to decrypt logs:', err);
          data = [];
        }
        if (mounted) setLogs(data);
      } catch (err) {
        console.error('Failed to fetch logs:', err);
        if (mounted) setLogs([]);
      }
      // Fetch screenshot image DB
      try {
        const resImg = await axios.get(getViteUrl('/assets/data/screenshot.bin'), { responseType: 'text' });
        let imgDb = {};
        try {
          imgDb = decryptJson(resImg.data, secret);
        } catch (err) {
          console.error('Failed to decrypt screenshot.bin:', err);
          imgDb = {};
        }
        if (mounted) setImageDb(imgDb);
      } catch (err) {
        console.error('Failed to fetch screenshot.bin:', err);
        if (mounted) setImageDb({});
      }
      setLoading(false);
    })();
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
  // Ensure currentPage is always valid (avoid setState in effect)
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedLogs = filteredLogs.slice((safeCurrentPage - 1) * batch, safeCurrentPage * batch);
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
  }, [filteredLogs.length, totalPages, currentPage, paginatedLogs.length]);

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
          <button
            type="button"
            className={`btn ${theme === 'dark' ? 'btn-outline-light' : 'btn-outline-dark'} mb-3`}
            onClick={() => navigate('/')}>
            <i className="fa fa-arrow-left me-2" /> Back
          </button>
          {/* Theme toggle UI omitted for brevity */}
          <h1 className="my-4 text-body text-center">{pageTitle}</h1>
          <div className="mb-4 d-flex flex-wrap justify-content-center gap-2">
            <Badge
              bg="success"
              className="px-2 py-1 fw-normal text-center"
              style={{ fontSize: '0.92em', minWidth: 70, maxWidth: 100 }}>
              <i className="fa-solid fa-circle-check me-1" aria-hidden="true"></i> {successCount}
            </Badge>
            <Badge
              bg="danger"
              className="px-2 py-1 fw-normal text-center"
              style={{ fontSize: '0.92em', minWidth: 70, maxWidth: 100 }}>
              <i className="fa-solid fa-circle-exclamation me-1" aria-hidden="true"></i> {invalidCount}
            </Badge>
            <Badge
              bg="secondary"
              className="px-2 py-1 fw-normal text-center"
              style={{ fontSize: '0.92em', minWidth: 70, maxWidth: 100 }}>
              <i className="fa-solid fa-circle-xmark me-1" aria-hidden="true"></i> {failCount}
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
            key={`${safeCurrentPage}-${search}-${JSON.stringify(filters)}`}
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
            {paginatedLogs.map((log, idx) => {
              const nik = log?.data?.nik;
              const imageUrl = nik && imageDb && typeof imageDb === 'object' ? imageDb[nik] : undefined;
              return (
                <LogAccordionItem
                  log={log}
                  idx={String(idx + 1 + (safeCurrentPage - 1) * batch)}
                  key={idx}
                  imageUrl={imageUrl}
                />
              );
            })}
          </Accordion>
          {/* Pagination */}
          <div className={`my-3 d-flex justify-content-center ${styles.paginationScroll}`}>
            <Pagination size="sm">
              <Pagination.Prev
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
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
                        active={page === safeCurrentPage}
                        key={page}
                        onClick={() => setCurrentPage(page)}>
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
                disabled={safeCurrentPage === totalPages}
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
