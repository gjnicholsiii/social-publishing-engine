import './globals.css';

export const metadata = {
  title: 'Publishing Engine',
  description: 'Capture once. Publish everywhere without sounding copied-and-pasted.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
