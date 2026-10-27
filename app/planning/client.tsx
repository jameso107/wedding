"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { login, logout, toggleTask } from "./actions";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/tasks", label: "Tasks" },
  { href: "/decisions", label: "Decisions" },
  { href: "/vendors", label: "Vendors" },
  { href: "/budget", label: "Budget" },
];

export function Nav({ counts }: { counts: Record<string, number | undefined> }) {
  // The browser URL is /tasks; the rewritten route is /planning/tasks.
  const path = usePathname().replace(/^\/planning(?=\/|$)/, "") || "/";
  return (
    <nav className="pl-nav" aria-label="Planning">
      {NAV.map(({ href, label }) => {
        const active =
          href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
        const count = counts[href];
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            {label}
            {count ? <span className="pl-nav-count">{count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function SubmitButton({
  children,
  className = "pl-btn",
  pendingLabel,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

// Runs a server action, then navigates in the browser (see actions.ts for
// why actions don't redirect). `then` may contain ":id", replaced with the
// action's return value.
function useThen(then?: string) {
  const router = useRouter();
  return (result: unknown) => {
    if (then) router.push(then.replace(":id", String(result ?? "")));
  };
}

export function ActionForm({
  action,
  then,
  ...props
}: Omit<React.ComponentProps<"form">, "action"> & {
  action: (form: FormData) => Promise<unknown>;
  then?: string;
}) {
  const go = useThen(then);
  return <form {...props} action={async (form) => go(await action(form))} />;
}

export function ConfirmButton({
  action,
  then,
  message,
  children,
  className = "pl-btn pl-btn-danger",
}: {
  action: (form: FormData) => Promise<unknown>;
  then?: string;
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  const go = useThen(then);
  return (
    <button
      type="submit"
      formAction={async (form) => go(await action(form))}
      formNoValidate
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function TaskCheck({
  id,
  done,
  title,
}: {
  id: string;
  done: boolean;
  title: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={optimistic ? `Mark “${title}” not done` : `Mark “${title}” done`}
      className="pl-check"
      onClick={() => {
        const next = !optimistic;
        startTransition(async () => {
          setOptimistic(next);
          const form = new FormData();
          form.set("id", id);
          form.set("done", String(next));
          await toggleTask(form);
        });
      }}
    >
      <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M2 6.2l2.6 2.6L10 3.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="14"
        />
      </svg>
    </button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  return (
    <form
      className="pl-form"
      action={async (form) => {
        const result = await login(undefined, form);
        if (result.error) setError(result.error);
        else router.replace("/");
      }}
    >
      <p className="pl-label" style={{ margin: 0, textAlign: "center" }}>
        Who’s planning?
      </p>
      <div className="pl-who">
        <button type="submit" name="person" value="hannah">
          Hannah
        </button>
        <button type="submit" name="person" value="james">
          James
        </button>
      </div>
      {error ? (
        <p className="pl-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await logout();
        router.replace("/login");
      }}
    >
      Switch person
    </button>
  );
}
