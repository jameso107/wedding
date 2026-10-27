import type { Metadata } from "next";
import "./planning.css";

export const metadata: Metadata = {
  title: { default: "Planning · Hannah + James", template: "%s · Planning" },
  description: "Hannah and James’s private wedding planning board.",
  robots: { index: false, follow: false },
  openGraph: null,
};

export default function PlanningLayout({ children }: LayoutProps<"/planning">) {
  return <div className="pl">{children}</div>;
}
