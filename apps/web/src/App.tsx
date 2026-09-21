import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './App.css';

type HealthResult = {
  label: string;
  ok: boolean;
  detail?: string;
};

async function fetchHealth(path: string): Promise<HealthResult['ok']> {
  const response = await fetch(path);
  return response.ok;
}

function App() {
  const { t, i18n } = useTranslation();
  const [live, setLive] = useState<boolean | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const [liveOk, readyOk] = await Promise.all([
        fetchHealth('/api/v1/health/live'),
        fetchHealth('/api/v1/health/ready'),
      ]);
      if (!cancelled) {
        setLive(liveOk);
        setReady(readyOk);
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleLanguage = () => {
    void i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  };

  const renderStatus = (value: boolean | null) => {
    if (value === null) return t('loading');
    return value ? t('statusOk') : t('statusError');
  };

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>{t('appName')}</h1>
          <p>{t('tagline')}</p>
        </div>
        <button type="button" onClick={toggleLanguage}>
          {i18n.language === 'ar' ? t('switchToEnglish') : t('switchToArabic')}
        </button>
      </header>

      <section className="panel">
        <div className="row">
          <span>{t('healthLive')}</span>
          <strong data-ok={live}>{renderStatus(live)}</strong>
        </div>
        <div className="row">
          <span>{t('healthReady')}</span>
          <strong data-ok={ready}>{renderStatus(ready)}</strong>
        </div>
      </section>
    </main>
  );
}

export default App;
