import type { Metadata } from "next";
import { Big_Shoulders, Big_Shoulders_Stencil, Homemade_Apple } from "next/font/google";
import "./globals.css";

const display = Big_Shoulders({
  subsets: ["latin"],
  variable: "--font-display",
});

const stamp = Big_Shoulders_Stencil({
  subsets: ["latin"],
  variable: "--font-stamp",
});

const hand = Homemade_Apple({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hand",
});

export const metadata: Metadata = {
  title: "Hannah + James · July 4, 2027",
  description:
    "Save the date: Hannah and James marry on July 4, 2027 at Bay Pointe Inn on Gun Lake, Michigan.",
  metadataBase: new URL("https://oosterhouse.wedding"),
  openGraph: {
    title: "Hannah + James · July 4, 2027",
    description:
      "Save the date for the Oosterhouse wedding at Bay Pointe Inn, Gun Lake.",
    type: "website",
    locale: "en_US",
  },
};

export const viewport = {
  themeColor: "#6B1020",
  colorScheme: "light" as const,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${stamp.variable} ${hand.variable} h-full`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}
