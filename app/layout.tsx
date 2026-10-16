import type { Metadata } from "next";
import { EB_Garamond, Jost, Pinyon_Script } from "next/font/google";
import "./globals.css";

const serif = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  style: ["normal", "italic"],
});

const sans = Jost({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-sans",
});

const script = Pinyon_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
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
  themeColor: "#3A6F88",
  colorScheme: "light" as const,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} ${script.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
