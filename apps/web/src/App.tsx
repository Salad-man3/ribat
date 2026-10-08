import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { router } from './routes/router';

const queryClient = new QueryClient();

function LanguageSync() {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageSync />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
