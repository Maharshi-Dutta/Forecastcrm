import './globals.css';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'ForecastCRM - AI Revenue Forecasting',
  description: 'AI-powered CRM with revenue forecasting, deal insights, and pipeline management',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
