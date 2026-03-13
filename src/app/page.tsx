import Link from 'next/link'
import { ArrowRight, CheckCircle2, Search, Database, MailCheck, Zap } from 'lucide-react'
import './landing.css'

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="navbar container">
        <Link href="/" className="logo-link">
          <span className="logo-icon gradient-text-accent">⚡</span>
          <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-primary)' }}>LeadSync</span>
        </Link>
        <div className="nav-links">
          <Link href="#product">Product</Link>
          <Link href="#resources">Resources</Link>
          <Link href="#pricing">Pricing</Link>
        </div>
        <div className="nav-auth">
          <Link href="/login" className="btn-secondary">Log in</Link>
          <Link href="/signup" className="btn-primary">Sign up</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero container">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="gradient-text-accent">Trusted by 2M+ professionals</span>
          </div>
          <h1 className="hero-title">
            Find <span className="gradient-text">Leads,</span><br/>
            Scale Your <span className="gradient-text-accent">Revenue.</span>
          </h1>
          <p className="hero-subtitle">
            LeadSync is your go-to lead search and enrichment tool to find business emails, verify leads, and write personalized opening lines using AI.
          </p>
          <div className="hero-actions">
            <Link href="/signup" className="btn-primary btn-large">
              Start finding leads <ArrowRight size={20} />
            </Link>
            <span className="hero-guarantee">No credit card required • 100 Free Leads</span>
          </div>
        </div>
        <div className="hero-visual">
          {/* Abstract glassmorphism UI representation */}
          <div className="glass-panel demo-dashboard">
            <div className="demo-header">
              <div className="dot red"></div>
              <div className="dot yellow"></div>
              <div className="dot green"></div>
            </div>
            <div className="demo-content">
              <div className="demo-sidebar">
                <div className="demo-bar width-70"></div>
                <div className="demo-bar width-50"></div>
                <div className="demo-bar width-80"></div>
                <div className="demo-bar width-40"></div>
              </div>
              <div className="demo-main">
                <div className="demo-card">
                  <div className="demo-circle"></div>
                  <div className="demo-lines">
                    <div className="demo-line width-90"></div>
                    <div className="demo-line width-60"></div>
                  </div>
                </div>
                <div className="demo-card">
                  <div className="demo-circle"></div>
                  <div className="demo-lines">
                    <div className="demo-line width-80"></div>
                    <div className="demo-line width-50"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="features container" id="product">
        <div className="section-header text-center">
          <h2>Everything You Need to Build a <span className="gradient-text-accent">Verified List</span></h2>
          <p>LeadSync is your all-in-one tool to search, verify, and export business leads from professional networks and websites.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card glass-panel">
            <div className="feature-icon-wrapper"><Database className="feature-icon" /></div>
            <h3>Lead Generation</h3>
            <p>Get access to over 200M+ business profiles, refreshed daily. Build targeted lists with highly accurate data spanning all industries.</p>
          </div>
          
          <div className="feature-card glass-panel">
            <div className="feature-icon-wrapper"><MailCheck className="feature-icon" /></div>
            <h3>Email Verifier</h3>
            <p>Reduce bounce rates and reach real inboxes. We detect personal, disposable, and gibberish emails using strict deliverability checks with 97%+ accuracy.</p>
          </div>

          <div className="feature-card glass-panel">
            <div className="feature-icon-wrapper"><Zap className="feature-icon" /></div>
            <h3>AI Personalization</h3>
            <p>Add intelligence to your data. LeadSync generates highly personalized opening lines for each lead, so you can segment smarter and boost reply rates.</p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats container border-y">
        <div className="stats-grid">
          <div className="stat-item">
            <h3 className="gradient-text-accent">3B+</h3>
            <p>Email searches processed</p>
          </div>
          <div className="stat-item">
            <h3 className="gradient-text-accent">92%</h3>
            <p>Average search success rate</p>
          </div>
          <div className="stat-item">
            <h3 className="gradient-text-accent">200M+</h3>
            <p>Continuously refreshed leads</p>
          </div>
          <div className="stat-item">
            <h3 className="gradient-text-accent">20M+</h3>
            <p>Company profiles updated daily</p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials container">
        <div className="section-header text-center">
          <h2>What our <span className="gradient-text-accent">customers say</span></h2>
          <p>Join thousands of revenue hackers, founders, and sales teams crushing their quotas.</p>
        </div>
        
        <div className="testimonials-grid">
          {[
            { quote: "It delivers as expected - if all you need is email, this tool is great. Also like that there doesn't seem to have limitations on how many emails I can extract.", author: "Sophia Georgeo", title: "B2B Account Executive, Dashlane" },
            { quote: "LeadSync is the greatest tool a salesperson can have. I can consistently send out emails to qualified leads by using it to determine my audience.", author: "Yoni Lebovits", title: "Business Development, Albert Scott" },
            { quote: "So far, the ROI on LeadSync has been more than any other tool in our tech stack. Its quality data has led to thousands in deals for our company.", author: "Caleb S.", title: "Founder, SocialBloom" },
            { quote: "LeadSync really helps us find target contacts via LinkedIn. We looked at many of the competing solutions, and we found it to be easier and more accurate.", author: "Riz A.", title: "Director of Demand Generation, Edifecs" },
            { quote: "LeadSync is a revenue hacker's dream come true. Perfectly priced for the awesome service it provides to help companies grow.", author: "Philip H.", title: "Business Development, Sock Fancy" },
            { quote: "Easy lookup and authentic email addresses. The database is very extensive and the tool is simple and easy to navigate.", author: "Annie Hugh", title: "Customer Success Manager, Goodera" }
          ].map((testimonial, idx) => (
            <div key={idx} className="testimonial-card glass-panel">
              <p className="testimonial-quote">"{testimonial.quote}"</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">{(testimonial.author)[0]}</div>
                <div>
                  <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{testimonial.author}</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{testimonial.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta text-center container">
        <div className="cta-box glass-panel">
          <h2>Get started today with <span className="gradient-text-accent">100 FREE leads</span>.</h2>
          <p>Find professional emails and key company data in a matter of seconds.</p>
          <div className="cta-actions">
            <Link href="/signup" className="btn-primary btn-large">
              Claim Free Leads
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer border-t">
        <div className="container footer-content">
          <div className="footer-brand">
            <Link href="/" className="logo-link">
              <span className="logo-icon gradient-text-accent">⚡</span>
              <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>LeadSync</span>
            </Link>
            <p>Your B2B Lead Generation Solution! Find verified business emails, leads and enrich company data effortlessly.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Product</h4>
              <Link href="#">Email Finder</Link>
              <Link href="#">Lead Finder</Link>
              <Link href="#">Data Enrichment</Link>
              <Link href="#">Company Search</Link>
              <Link href="#">API</Link>
            </div>
            <div className="footer-col">
              <h4>Compare</h4>
              <Link href="#">Apollo.io vs LeadSync</Link>
              <Link href="#">Hunter.io vs LeadSync</Link>
              <Link href="#">ZoomInfo vs LeadSync</Link>
              <Link href="#">Lusha vs LeadSync</Link>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <Link href="#">Terms</Link>
              <Link href="#">Data Policy</Link>
              <Link href="#">Privacy Policy</Link>
              <Link href="#">GDPR Compliance</Link>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <p>Copyright © 2026 by LeadSync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
