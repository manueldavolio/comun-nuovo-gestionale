import type { CSSProperties, ReactNode } from "react";
import { Montserrat, Oswald } from "next/font/google";

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-social-display",
  weight: ["500", "600", "700"],
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-social-body",
  weight: ["500", "600", "700", "800"],
});

export default function SocialStudioLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const style = {
    fontFamily: "var(--font-social-body), Montserrat, Segoe UI, sans-serif",
  } as CSSProperties;
  return (
    <div className={`${oswald.variable} ${montserrat.variable}`} style={style}>
      {children}
    </div>
  );
}
