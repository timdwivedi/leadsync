'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, PlayCircle, CheckCircle, XCircle, Clock, ListOrdered, X, RefreshCw } from 'lucide-react'
import './orders.css'

export default function OrdersClient({ orders: initialOrders }: { orders: any[] }) {
  const [orders, setOrders] = useState<any[]>(initialOrders)
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders')
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
        // Update selected order if it's open
        if (selectedOrder) {
          const updated = data.find((o: any) => o.id === selectedOrder.id)
          if (updated) setSelectedOrder(updated)
        }
      }
    } catch { /* silent */ }
  }

  // Auto-refresh every 10 seconds while any order is processing
  useEffect(() => {
    const hasProcessing = orders.some(o => o.status === 'processing')
    if (hasProcessing) {
      intervalRef.current = setInterval(fetchOrders, 10000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [orders])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchOrders()
    setRefreshing(false)
  }

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'completed': return <CheckCircle size={18} color="#4ade80" />
      case 'processing': return <PlayCircle size={18} color="#60a5fa" className="animate-pulse" />
      case 'failed': return <XCircle size={18} color="#f87171" />
      default: return <Clock size={18} color="var(--text-secondary)" />
    }
  }

  // Helper to force download instead of opening in a new tab
  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `leads-${new Date().getTime()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed, falling back to new tab", err);
      window.open(url, '_blank');
    }
  }

  return (
    <div className="orders-container">
      <div className={`orders-table-wrapper glass-panel`} style={{ padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-color)' }}>
          <button onClick={handleRefresh} disabled={refreshing} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
        <table className="orders-table">
          <thead>
            <tr>
              <th>Job Name</th>
              <th>Status</th>
              <th>Leads Found</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr 
                key={order.id} 
                onClick={() => setSelectedOrder(order)}
                style={{ backgroundColor: selectedOrder?.id === order.id ? 'rgba(212, 255, 54, 0.05)' : '' }}
              >
                <td style={{ fontWeight: 500 }}>{order.query}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'capitalize' }}>
                    {getStatusIcon(order.status)}
                    <span style={{ 
                      color: order.status === 'completed' ? '#4ade80' : 
                            order.status === 'processing' ? '#60a5fa' : 
                            order.status === 'failed' ? '#f87171' : 'var(--text-secondary)'
                    }}>
                      {order.status}
                    </span>
                  </div>
                </td>
                <td>{order.status === 'processing' ? '-' : order.count}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                  {(() => {
                    const d = new Date(order.created_at || order.date || Date.now())
                    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    return <>{datePart} <span style={{ opacity: 0.6 }}>·</span> {timePart}</>
                  })()}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {order.status === 'completed' && order.downloadUrl ? (
                    <a 
                      href={order.downloadUrl} 
                      onClick={(e) => handleDownload(e, order.downloadUrl)}
                      className="btn-secondary" 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '13px' }}
                    >
                      <Download size={14} /> Download CSV
                    </a>
                  ) : (
                    <button className="btn-secondary" disabled style={{ opacity: 0.5, cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '13px' }}>
                      <Download size={14} /> Unavailable
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {orders.length === 0 && (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <ListOrdered size={48} style={{ margin: '0 auto var(--space-4)', opacity: 0.5 }} />
            <p>No job orders found. Start a new scrape to see it here.</p>
          </div>
        )}
      </div>

      {/* Sidebar Drawer */}
      {selectedOrder && (
        <div className="order-sidebar">
          <div className="order-sidebar-header">
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Job Details</h3>
            <button 
              onClick={() => setSelectedOrder(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>
          <div className="order-sidebar-content">
            <div className="detail-row">
              <div className="detail-label">Job Name</div>
              <div className="detail-value" style={{ fontWeight: 500 }}>{selectedOrder.query}</div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Status</div>
              <div className="detail-value" style={{ textTransform: 'capitalize' }}>{selectedOrder.status}</div>
            </div>
            <div className="detail-row">
              <div className="detail-label">Leads Processed</div>
              <div className="detail-value">{selectedOrder.status === 'processing' ? '-' : selectedOrder.count}</div>
            </div>

            {selectedOrder.status === 'failed' && selectedOrder.error && (
              <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'rgba(248,113,113,0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(248,113,113,0.2)', fontSize: '0.8rem', color: '#f87171' }}>
                <strong>Error:</strong> {selectedOrder.error}
              </div>
            )}

            {selectedOrder.status === 'completed' && selectedOrder.downloadUrl && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <a 
                  href={selectedOrder.downloadUrl} 
                  onClick={(e) => handleDownload(e, selectedOrder.downloadUrl)}
                  className="btn-primary" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px', width: '100%', justifyContent: 'center' }}
                >
                  <Download size={14} /> Download CSV
                </a>
              </div>
            )}
            
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 'var(--space-4) 0' }} />
            
            <h4 style={{ fontSize: '0.875rem', marginBottom: 'var(--space-3)' }}>Configuration Parameters</h4>
            {selectedOrder.parameters ? (
              <pre style={{ 
                background: 'rgba(0,0,0,0.2)', 
                padding: 'var(--space-3)', 
                borderRadius: 'var(--radius-md)', 
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                overflowX: 'auto'
              }}>
                {JSON.stringify(selectedOrder.parameters, null, 2)}
              </pre>
            ) : (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>No parameters recorded.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
