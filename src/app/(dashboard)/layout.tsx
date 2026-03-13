'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, ListOrdered, Search, FileText, Zap, BookOpen, MessageSquare, HelpCircle, Inbox, User, LogOut } from 'lucide-react';
import './dashboard.css';

const sidebarLinks = [
  { group: 'Favorites', links: [
    { name: 'Technical Docs', href: '#', icon: FileText },
    { name: 'Campaign Guidelines', href: '#', icon: FileText },
    { name: 'Important Rules', href: '#', icon: FileText },
    { name: 'Onboarding', href: '#', icon: BookOpen },
  ]},
  { group: 'Main Menu', links: [
    { name: 'Scrape Leads', href: '/scrape', icon: Search },
    { name: 'Config Settings', href: '/config', icon: Settings },
    { name: 'Job Orders', href: '/orders', icon: ListOrdered },
    { name: 'Campaigns', href: '#', icon: Zap },
    { name: 'Chat', href: '#', icon: MessageSquare },
    { name: 'Support Center', href: '#', icon: HelpCircle },
    { name: 'Leads', href: '#', icon: User },
    { name: 'Archive', href: '#', icon: Inbox },
  ]}
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar glass-panel">
        <div className="sidebar-header">
          <Link href="/" className="logo-link">
            <span className="logo-icon gradient-text-accent">⚡</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>LeadSync</span>
          </Link>
          <button className="collapse-btn"><LayoutDashboard size={18} /></button>
        </div>

        <div className="sidebar-content">
          {sidebarLinks.map((group, idx) => (
            <div key={idx} className="sidebar-group">
              <h4 className="group-title">{group.group}</h4>
              <nav className="group-nav">
                {group.links.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  
                  if (link.href === '#') {
                    return (
                      <a key={link.name} href="#" onClick={(e) => { e.preventDefault(); alert("Coming Soon!"); }} className={`sidebar-link ${isActive ? 'active' : ''}`}>
                        <Icon size={18} />
                        <span>{link.name}</span>
                      </a>
                    );
                  }

                  return (
                    <Link key={link.name} href={link.href} className={`sidebar-link ${isActive ? 'active' : ''}`}>
                      <Icon size={18} />
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <form action="/auth/signout" method="post">
            <button className="btn-secondary logout-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <LogOut size={16} /> Sign out
            </button>
          </form>
          <button className="btn-primary get-extension-btn">Get the extension</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <span style={{ color: 'var(--text-secondary)' }}>App / </span>
            <span style={{ fontWeight: 500 }}>{pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}</span>
          </div>
          <div className="topbar-actions">
            <div className="search-bar">
              <Search size={14} color="var(--text-secondary)" />
              <input type="text" placeholder="Search..." className="search-input" />
              <div className="shortcut-hint">⌘ /</div>
            </div>
            {/* User Profile Mini */}
            <button className="user-avatar" title="User Profile">
              <User size={16} color="#000" style={{ strokeWidth: 3 }} />
            </button>
          </div>
        </header>
        <div className="content-container">
          {children}
        </div>
      </main>
    </div>
  );
}
