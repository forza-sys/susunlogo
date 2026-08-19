import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import './App.css';

function App() {
  const getInitialState = () => {
    try {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        return JSON.parse(decodeURIComponent(atob(hash)));
      }
    } catch (e) {
      console.error("Failed to parse URL hash state", e);
    }
    return null;
  };

  const initialState = getInitialState();

  const [inputText, setInputText] = useState(initialState?.t || '');
  const [numCols, setNumCols] = useState(initialState?.c || 5);
  const [showOpzList, setShowOpzList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [opzData, setOpzData] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [logoImages, setLogoImages] = useState({}); // { name: base64 | 'loading' }

  // Load initial scale from URL, then localStorage, or default to empty object
  const [itemScales, setItemScales] = useState(() => {
    if (initialState?.s) return initialState.s;
    try {
      const saved = localStorage.getItem('logo-arranger-scales');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const exportRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('logo-arranger-scales', JSON.stringify(itemScales));
  }, [itemScales]);

  useEffect(() => {
    const state = {
      t: inputText,
      c: numCols,
      s: itemScales
    };
    try {
      const encoded = btoa(encodeURIComponent(JSON.stringify(state)));
      window.history.replaceState(null, '', `#${encoded}`);
    } catch (e) {
      // Ignore encoding errors if text is too weird
    }
  }, [inputText, numCols, itemScales]);

  // Fetch initial OPZ List from GAS
  useEffect(() => {
    const fetchList = async () => {
      try {
        const gasUrl = import.meta.env.VITE_GAS_API_URL;
        if (!gasUrl) {
          console.error("VITE_GAS_API_URL is missing in .env");
          setIsDataLoading(false);
          return;
        }
        const response = await fetch(`${gasUrl}?action=list`);
        const data = await response.json();
        // Assuming data is array of {name, id}
        setOpzData(data);
      } catch (err) {
        console.error('Failed to fetch opz list', err);
      } finally {
        setIsDataLoading(false);
      }
    };
    fetchList();
  }, []);

  const addOpzToInput = (name) => {
    const current = inputText.trim();
    if (current) {
      if (!current.includes(name)) {
        setInputText(current + ",\n" + name);
      }
    } else {
      setInputText(name);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Link berhasil di-copy! Silakan kirim link ini ke teman Anda agar mereka melihat susunan & ukuran yang sama persis.");
  };

  const matchedLogos = useMemo(() => {
    if (!inputText.trim()) return [];
    
    const names = inputText.split(/[,\n]+/).map(n => n.trim()).filter(n => n.length > 0);
    
    const logos = names.map(name => {
      const match = opzData.find(opz => opz.name.toLowerCase() === name.toLowerCase()) 
        || opzData.find(opz => opz.name.toLowerCase().includes(name.toLowerCase()));
      
      return {
        queryName: name,
        found: !!match,
        logoData: match || null
      };
    });

    return logos;
  }, [inputText, opzData]);

  const validLogos = matchedLogos.filter(item => item.found);

  // Helper to extract ID from full drive link or bare ID
  const extractFileId = (rawId) => {
    if (!rawId) return null;
    const match = rawId.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawId.match(/id=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : rawId;
  };

  // Lazy-load base64 images from GAS when logos enter the canvas
  useEffect(() => {
    validLogos.forEach(async (item) => {
      const name = item.logoData.name;
      const fileId = extractFileId(item.logoData.id); // Safe extraction
      
      if (!logoImages[name] && fileId) {
        // Mark as loading to prevent duplicate requests
        setLogoImages(prev => ({ ...prev, [name]: 'loading' }));
        
        try {
          const gasUrl = import.meta.env.VITE_GAS_API_URL;
          const res = await fetch(`${gasUrl}?action=getImage&id=${fileId}`);
          const json = await res.json();
          if (json.base64) {
            setLogoImages(prev => ({ ...prev, [name]: json.base64 }));
          } else {
            console.error("Error fetching image:", json.error);
            setLogoImages(prev => ({ ...prev, [name]: null }));
          }
        } catch (e) {
          console.error("Fetch failed:", e);
          setLogoImages(prev => ({ ...prev, [name]: null }));
        }
      }
    });
  }, [validLogos, logoImages]);

  const gridStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: '20px',
    minWidth: `${numCols * 100}px`
  };

  const updateScale = (name, delta) => {
    setItemScales(prev => {
      const currentScale = prev[name] || 1;
      const newScale = Math.max(0.5, Math.min(4, currentScale + delta));
      return { ...prev, [name]: newScale };
    });
  };

  const isExportReady = validLogos.every(item => {
    const state = logoImages[item.logoData.name];
    return state && state !== 'loading';
  });

  const handleExport = async () => {
    if (!exportRef.current) return;
    if (!isExportReady) {
      alert("Tunggu sebentar, gambar masih di-loading dari Google Drive...");
      return;
    }
    
    try {
      const canvas = await html2canvas(exportRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true
      });
      
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `logo-arranger-${Date.now()}.png`;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Gagal mengekspor gambar. Silakan coba lagi.");
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Susun Logo</h1>
        <p>selamatkan waktumu untuk ngerjain yg lain</p>
      </header>

      <main className="app-content">
        <div className="controls-card">
          <div className="form-group">
            <label htmlFor="opz-input">Masukkan Nama OPZ (Pisahkan dengan koma atau baris baru)</label>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <textarea
                  id="opz-input"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Contoh: Dompet Dhuafa, Rumah Zakat, BAZMA..."
                  rows={5}
                />
              </div>
              
              {matchedLogos.some(item => !item.found) && (
                <div style={{ 
                  width: '300px', 
                  background: '#fef2f2', 
                  border: '1px solid #fecaca', 
                  borderRadius: '8px', 
                  padding: '15px', 
                  maxHeight: '135px', 
                  overflowY: 'auto' 
                }}>
                  <p style={{ color: '#ef4444', fontSize: '0.9rem', margin: '0 0 10px 0', fontWeight: '600' }}>⚠️ Tidak Ditemukan:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {matchedLogos.filter(item => !item.found).map((item, idx) => (
                      <span key={idx} style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', border: '1px solid #fca5a5' }}>
                        {item.queryName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                type="button" 
                onClick={() => setShowOpzList(!showOpzList)} 
                style={{ background: showOpzList ? 'var(--text-main)' : 'var(--primary-color)', color: showOpzList ? '#ffffff' : 'var(--text-main)', border: '1px solid var(--text-main)', borderRadius: '20px', cursor: 'pointer', padding: '6px 14px', fontSize: '0.85rem', fontWeight: '600', transition: 'all 0.2s' }}
                disabled={isDataLoading}
              >
                {isDataLoading ? 'Memuat Database...' : (showOpzList ? 'Sembunyikan daftar OPZ' : 'Lihat daftar OPZ')}
              </button>
              
              {inputText.trim().length > 0 && (
                <button 
                  type="button" 
                  onClick={() => {
                    if (window.confirm("Yakin ingin mereset/menghapus semua nama OPZ di dalam kotak?")) {
                      setInputText('');
                    }
                  }} 
                  style={{ background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--text-main)', borderRadius: '20px', cursor: 'pointer', padding: '6px 14px', fontSize: '0.85rem', fontWeight: '600', transition: 'all 0.2s' }}
                  title="Hapus semua daftar"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = 'var(--text-main)'; e.target.style.color = '#ffffff' }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--text-main)' }}
                >
                  Reset daftar
                </button>
              )}
            </div>
            <div>
              {showOpzList && (
                <div style={{ marginTop: '10px', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                  <input 
                    type="text" 
                    placeholder="Cari nama OPZ..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '250px', overflowY: 'auto' }}>
                    {opzData
                      .filter(opz => opz.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((opz, idx) => (
                      <span 
                        key={idx} 
                        onClick={() => addOpzToInput(opz.name)}
                        style={{ background: '#ffffff', padding: '6px 10px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', border: '1px solid #cbd5e1', color: 'var(--text-main)', transition: 'all 0.2s', userSelect: 'none' }}
                        title="Klik untuk menambahkan ke daftar"
                        onMouseEnter={(e) => { e.target.style.backgroundColor = 'var(--primary-color)'; e.target.style.borderColor = 'var(--text-main)' }}
                        onMouseLeave={(e) => { e.target.style.backgroundColor = '#ffffff'; e.target.style.borderColor = '#cbd5e1' }}
                      >
                        {opz.name}
                      </span>
                    ))}
                    {opzData.filter(opz => opz.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>OPZ tidak ditemukan.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor="col-input">Jumlah Kolom</label>
              <input
                type="number"
                id="col-input"
                value={numCols}
                onChange={(e) => setNumCols(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                style={{ height: '54px', boxSizing: 'border-box' }}
              />
            </div>
            <button className="export-btn" onClick={copyShareLink} style={{ height: '54px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Copy link ↗
            </button>
            {matchedLogos.length > 0 && (
              <button 
                className="export-btn" 
                onClick={handleExport}
                style={{ 
                  height: '54px', 
                  boxSizing: 'border-box', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  opacity: isExportReady ? 1 : 0.6, 
                  cursor: isExportReady ? 'pointer' : 'not-allowed' 
                }}
              >
                {isExportReady ? 'Export to PNG ↗' : 'Loading Images... ⌛'}
              </button>
            )}
          </div>
        </div>

        {matchedLogos.length > 0 && (
          <div className="results-section">
            <div className="stats">
              Ditemukan {validLogos.length} dari {matchedLogos.length} nama OPZ.
            </div>

            <div className="logo-grid-container" style={{ overflowX: 'auto' }}>
              <div ref={exportRef} style={gridStyle}>
                {validLogos.map((item, idx) => {
                  const currentScale = itemScales[item.logoData.name] || 1;
                  const imageState = logoImages[item.logoData.name];
                  
                  // If image is still loading or not started fetching yet
                  const isImageReady = imageState && imageState !== 'loading';

                  return (
                    <div 
                      key={idx} 
                      className="logo-item"
                      style={{
                        width: `calc(100% / ${numCols})`
                      }}
                    >
                      {isImageReady ? (
                        <img 
                          src={imageState} 
                          alt={item.logoData.name} 
                          title={item.logoData.name}
                          crossOrigin="anonymous"
                          style={{ 
                            transform: `scale(${currentScale})`,
                            transition: 'transform 0.2s ease, opacity 0.2s',
                            transformOrigin: 'center'
                          }}
                        />
                      ) : (
                        <div className="skeleton-loader" style={{ transform: `scale(${currentScale})` }}></div>
                      )}
                      <div className="zoom-controls" data-html2canvas-ignore="true">
                        <button onClick={() => updateScale(item.logoData.name, -0.1)}>-</button>
                        <span>{currentScale.toFixed(1)}x</span>
                        <button onClick={() => updateScale(item.logoData.name, 0.1)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

export default App;
