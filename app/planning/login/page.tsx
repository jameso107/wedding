import type { Metadata } from "next";
import Image from "next/image";
import bayPointe from "@/public/images/bay-pointe.jpg";
import { LoginForm } from "../client";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="pl-login">
      <Image
        src={bayPointe}
        alt=""
        fill
        preload
        placeholder="blur"
        sizes="100vw"
        className="pl-hero-img"
        style={{ zIndex: -2 }}
      />
      <section className="pl-login-card">
        <p className="pl-kicker">The planning board</p>
        <h1 className="pl-lockup-names" style={{ margin: "16px 0 6px" }}>
          Hannah &amp; James
        </h1>
        <p className="pl-small" style={{ margin: 0, letterSpacing: "0.3em" }}>
          07 · 04 · 27
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
