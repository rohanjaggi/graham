'use client'

import { useState } from 'react'

export default function ValuationPage() {
  const [activeTab, setActiveTab] = useState<'dcf' | 'comparables'>('dcf')

  return (
    <div style={{
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: "'DM Sans', sans-serif",
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 className="font-display" style={{
          fontSize: '2.5rem',
          fontWeight: 500,
          marginBottom: '2rem',
          color: 'var(--text-primary)'
        }}>
          Valuation Analysis
        </h1>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          marginBottom: '2rem'
        }}>
          <button
            onClick={() => setActiveTab('dcf')}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'dcf' ? '2px solid var(--gold)' : '2px solid transparent',
              color: activeTab === 'dcf' ? 'var(--gold)' : 'var(--text-secondary)',
              fontSize: '1rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            DCF Valuation
          </button>
          <button
            onClick={() => setActiveTab('comparables')}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'comparables' ? '2px solid var(--gold)' : '2px solid transparent',
              color: activeTab === 'comparables' ? 'var(--gold)' : 'var(--text-secondary)',
              fontSize: '1rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Comparables Analysis
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'dcf' && (
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Discounted Cash Flow (DCF) Valuation</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              DCF analysis content will be implemented here. This will include adjustable WACC, growth rates, terminal value assumptions, and real-time intrinsic value calculations.
            </p>
            {/* Placeholder for DCF features */}
            <div style={{ marginTop: '2rem', padding: '2rem', border: '1px dashed var(--border)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>
              DCF Valuation Interface Coming Soon
            </div>
          </div>
        )}

        {activeTab === 'comparables' && (
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Comparables Analysis</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Peer benchmarking across P/E, EV/EBITDA, P/B, and ROE. Add and remove peers dynamically for comprehensive comparative analysis.
            </p>
            {/* Placeholder for Comparables features */}
            <div style={{ marginTop: '2rem', padding: '2rem', border: '1px dashed var(--border)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Comparables Analysis Interface Coming Soon
            </div>
          </div>
        )}
      </div>
    </div>
  )
}