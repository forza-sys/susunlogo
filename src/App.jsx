import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import './App.css';
import opzData from './data.json';

function App() {
  // Read initial state from URL hash if available (for sharing)
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

  // Save scale to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('logo-arranger-scales', JSON.stringify(itemScales));
  }, [itemScales]);

  // Sync state to URL hash so it can be shared with friends
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

  // Parse input and match logos
  const matchedLogos = useMemo(() => {
    if (!inputText.trim()) return [];
    
    // Split by comma or newline
    const names = inputText.split(/[,\n]+/).map(n => n.trim()).filter(n => n.length > 0);
    
    const logos = names.map(name => {
      // Find matching OPZ (case insensitive, partial match or exact match)
      const match = opzData.find(opz => opz.name.toLowerCase() === name.toLowerCase()) 
        || opzData.find(opz => opz.name.toLowerCase().includes(name.toLowerCase()));
      
      return {
        queryName: name,
        found: !!match,
        logoData: match || null
      };
    });

    return logos;
  }, [inputText]);

  const validLogos = matchedLogos.filter(item => item.found);

  // Calculate CSS flex properties to allow bottom row centering
  const gridStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0', // "saling nempel aka, ga ada jarak"
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff', // "belakangnya putih"
    padding: '20px',
    minWidth: `${numCols * 100}px` // Memastikan tiap logo minimal punya lebar 100px
  };

  const updateScale = (name, delta) => {
    setItemScales(prev => {
      const currentScale = prev[name] || 1;
      const newScale = Math.max(0.5, Math.min(4, currentScale + delta));
      return { ...prev, [name]: newScale };
    });
  };

  const handleExport = async () => {
    if (!exportRef.current) return;
    
    try {
      const canvas = await html2canvas(exportRef.current, {
        scale: 3, // High resolution
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
        <p>Susun logo OPZ dengan mudah</p>
      </header>

      <main className="app-content">
        <div className="controls-card">
          <div className="form-group">
            <label htmlFor="opz-input">Masukkan Nama OPZ (Pisahkan dengan koma atau baris baru)</label>
            <textarea
              id="opz-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Contoh: Dompet Dhuafa, Rumah Zakat, BAZMA..."
              rows={5}
            />
            <div style={{ marginTop: '10px' }}>
              <button 
                type="button" 
                onClick={() => setShowOpzList(!showOpzList)} 
                style={{ background: 'transparent', color: 'var(--primary-color)', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '0.9rem', fontWeight: '600' }}
              >
                {showOpzList ? 'Sembunyikan Daftar Nama OPZ' : 'Lihat Daftar Nama OPZ yang Tersedia'}
              </button>
              {showOpzList && (
                <div style={{ marginTop: '10px', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                  <input 
                    type="text" 
                    placeholder="🔍 Cari nama OPZ..." 
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
                        onMouseEnter={(e) => { e.target.style.backgroundColor = '#e0e7ff'; e.target.style.borderColor = 'var(--primary-color)' }}
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
            <button className="export-btn" onClick={copyShareLink} style={{ background: '#10b981', height: '54px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              🔗 Copy Link untuk Teman
            </button>
          </div>
        </div>

        {matchedLogos.length > 0 && (
          <div className="results-section">
            <div className="stats">
              Ditemukan {validLogos.length} dari {matchedLogos.length} nama OPZ.
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <button className="export-btn" onClick={handleExport}>
                📸 Export to PNG (High Res)
              </button>
            </div>

            <div className="logo-grid-container" style={{ overflowX: 'auto' }}>
              <div ref={exportRef} style={gridStyle}>
                {validLogos.map((item, idx) => {
                  const currentScale = itemScales[item.logoData.name] || 1;
                  return (
                    <div 
                      key={idx} 
                      className="logo-item"
                      style={{
                        width: `calc(100% / ${numCols})`
                      }}
                    >
                      <img 
                        src={`/logos/${item.logoData.logo}`} 
                        alt={item.logoData.name} 
                        title={item.logoData.name}
                        style={{ 
                          transform: `scale(${currentScale})`,
                          transition: 'transform 0.2s ease',
                          transformOrigin: 'center'
                        }}
                      />
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

            {matchedLogos.some(item => !item.found) && (
              <div className="missing-logos">
                <p style={{width: '100%', color: '#fca5a5', fontSize: '0.9rem', marginBottom: '10px'}}>Tidak ditemukan:</p>
                {matchedLogos.filter(item => !item.found).map((item, idx) => (
                  <span key={idx} className="missing-badge">❌ {item.queryName}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
