import { useEffect, useState } from 'react';
import { getViteUrl } from '../utils-browser-esm';
import Header from './components/Header';
import Footer from './components/Footer';

// Flowbite, Tailwind, and Font Awesome 6 Pro CDN links (to be included in index.html or via Helmet if SSR)
// <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" rel="stylesheet" />
// <link href="https://cdnjs.cloudflare.com/ajax/libs/flowbite/2.2.1/flowbite.min.css" rel="stylesheet" />
// <script src="https://cdnjs.cloudflare.com/ajax/libs/flowbite/2.2.1/flowbite.min.js"></script>

const KemkesIndonesiaKuLogs = () => {
  /**
   * @type {[DataMerged[], React.Dispatch<React.SetStateAction<DataMerged[]>>]}
   * Data state and setter for merged data rows.
   * @see {import('../runner/types').DataMerged}
   */
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  /**
   * @type {[DataMerged[], React.Dispatch<React.SetStateAction<DataMerged[]>>]}
   * Data state and setter for merged data rows.
   * @see {import('../runner/types').DataMerged}
   */
  const [filteredData, setFilteredData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  useEffect(() => {
    import('../utils/json-crypto.js').then(({ decryptJson }) => {
      fetch(getViteUrl('/assets/data/sehatindonesiaku-data.json'))
        .then((res) => res.text())
        .then((res) => {
          return decryptJson(res, import.meta.env.VITE_JSON_SECRET);
        })
        .then((json) => setData(json))
        .catch((err) => console.error('Failed to fetch data:', err));
    });
  }, []);

  useEffect(() => {
    let result = data;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((row) => Object.values(row).some((val) => String(val).toLowerCase().includes(s)));
    }
    if (filter) {
      result = result.filter((row) => Object.values(row).some((val) => String(val) === filter));
    }
    setFilteredData(result);
    setCurrentPage(1); // Reset to first page on filter/search change
  }, [search, filter, data]);

  // Get table columns from first row
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <>
      <Header />
      <div className="container py-4">
        <h1 className="h3 mb-4 d-flex align-items-center gap-2">
          <i className="fa-solid fa-notes-medical text-primary"></i>
          Kemkes IndonesiaKu Logs
        </h1>
        <div className="row g-2 mb-4">
          <div className="col-auto">
            <input
              type="text"
              className="form-control"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-auto">
            <select className="form-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All</option>
              {/* Example: filter by a specific column if needed */}
              {/* {Array.from(new Set(data.map(row => row.status))).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))} */}
            </select>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-hover table-sm align-middle">
            <thead className="table-light">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="fw-semibold">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center text-secondary py-4">
                    No data found
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr key={idx + (currentPage - 1) * rowsPerPage}>
                    {columns.map((col) => (
                      <td key={col}>{String(row[col])}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Controls - Floating */}
        {totalPages > 1 && (
          <nav
            className="pagination-float"
            style={{
              position: 'fixed',
              bottom: '32px',
              right: '32px',
              zIndex: 1050,
              background: 'rgba(255,255,255,0.95)',
              borderRadius: '2em',
              boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
              padding: '0.5em 1.2em',
              border: '1px solid #ddd',
              minWidth: 220,
              maxWidth: 320,
              width: '90vw',
              overflowX: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5em'
            }}
            aria-label="Table pagination">
            <ul className="pagination pagination-sm mb-0" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
              {/* Only show prev, three page numbers, and next */}
              <li className={`page-item${currentPage === 1 ? ' disabled' : ''}`} style={{ minWidth: 36 }}>
                <button
                  className="page-link"
                  style={{ minWidth: 36, maxWidth: 36, textAlign: 'center', padding: '0 0.5em' }}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}>
                  <i className="fa fa-angle-left" aria-hidden="true"></i>
                </button>
              </li>
              {(() => {
                let pages = [];
                let start = Math.max(1, currentPage - 1);
                let end = Math.min(totalPages, currentPage + 1);
                if (currentPage === 1) {
                  end = Math.min(totalPages, 3);
                } else if (currentPage === totalPages) {
                  start = Math.max(1, totalPages - 2);
                }
                for (let page = start; page <= end; page++) {
                  pages.push(
                    <li
                      key={page}
                      className={`page-item${page === currentPage ? ' active' : ''}`}
                      style={{ minWidth: 36 }}>
                      <button
                        className="page-link"
                        style={{ minWidth: 36, maxWidth: 36, textAlign: 'center', padding: '0 0.5em' }}
                        onClick={() => setCurrentPage(page)}>
                        {page}
                      </button>
                    </li>
                  );
                }
                return pages;
              })()}
              <li className={`page-item${currentPage === totalPages ? ' disabled' : ''}`} style={{ minWidth: 36 }}>
                <button
                  className="page-link"
                  style={{ minWidth: 36, maxWidth: 36, textAlign: 'center', padding: '0 0.5em' }}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}>
                  <i className="fa fa-angle-right" aria-hidden="true"></i>
                </button>
              </li>
            </ul>
          </nav>
        )}
      </div>
      <Footer />
    </>
  );
};

export default KemkesIndonesiaKuLogs;
