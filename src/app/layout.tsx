import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lingora — платформа для уроков английского",
  description: "Teach · Inspire · Grow",
};

// Применяем сохранённую тему до первой отрисовки — без мигания.
const themeScript = `(function(){try{var m=localStorage.getItem('lingora-mode');var a=localStorage.getItem('lingora-accent');var r=document.documentElement;if(m==='dark')r.setAttribute('data-mode','dark');if(a)r.setAttribute('data-accent',a);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`h-full antialiased ${poppins.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
