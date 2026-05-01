/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { Hero } from "./components/Hero";
import { DashboardView } from "./components/DashboardView";
import { BotInfo, fetchBotInfo } from "./services/api";
import { Features } from "./components/Features";
import { TermsView, PrivacyView } from "./components/LegalViews";

import { LanguageProvider, useLanguage } from "./context/LanguageContext";

function AppContent() {
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const { t } = useLanguage();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchBotInfo();
        setBotInfo(data);
        setError(null);
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Failed to fetch bot info");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-vibrant-bg flex flex-col">
      <Navigation />
      
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={
            <>
              <Hero botInfo={botInfo} />
              <Features />
            </>
          } />
          <Route path="/dashboard" element={
            <DashboardView 
              botInfo={botInfo} 
              loading={loading} 
              error={error} 
            />
          } />
          <Route path="/terms" element={<TermsView />} />
          <Route path="/privacy" element={<PrivacyView />} />
        </Routes>
      </main>

      <footer className="mt-20 py-10 border-t border-white/5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-600">
          <div className="flex gap-10">
            <span>© 2024 ZiProject</span>
            <span>API: api.ziji.best</span>
          </div>
          <div className="flex gap-8">
            <Link to="/terms" className="hover:text-white transition-colors">{t('terms')}</Link>
            <Link to="/privacy" className="hover:text-white transition-colors">{t('privacy')}</Link>
            <a 
              href="https://github.com/ZiProject/Ziji-bot-discord" 
              target="_blank" 
              rel="noreferrer" 
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <Router>
        <AppContent />
      </Router>
    </LanguageProvider>
  );
}

