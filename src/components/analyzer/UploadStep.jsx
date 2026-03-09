import React from 'react';

const UploadStep = ({ fileInputRef, handleFileUpload, styles }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0' }}>
      <div onClick={() => fileInputRef.current?.click()}
        style={{ width: '100%', maxWidth: '500px', padding: '48px', border: '2px dashed #475569', borderRadius: '16px', backgroundColor: 'rgba(30, 41, 59, 0.3)', cursor: 'pointer', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>Upload Incucyte Data File</p>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>Supports .txt and .csv exports</p>
        <span style={{ ...styles.button, ...styles.primaryButton, display: 'inline-block' }}>Select File</span>
      </div>
      <input ref={fileInputRef} type="file" accept=".txt,.csv,.tsv" onChange={handleFileUpload} style={{ display: 'none' }} />
    </div>
  );
};

export default UploadStep;
