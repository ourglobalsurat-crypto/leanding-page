"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AdminLoginForm({ adminSlug }: { adminSlug: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setError(result.message || "Could not sign in.");
        return;
      }
      router.replace(`/${adminSlug}`);
      router.refresh();
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="admin-login-form" onSubmit={submit}>
      <div className="admin-field">
        <label htmlFor="admin-email">Email address</label>
        <div><Mail size={18} /><input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></div>
      </div>
      <div className="admin-field">
        <label htmlFor="admin-password">Password</label>
        <div>
          <LockKeyhole size={18} />
          <input id="admin-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" required />
          <button type="button" className="password-toggle" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {error && <p className="admin-form-error" role="alert">{error}</p>}
      <button className="admin-submit" type="submit" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Open lead desk"} <ArrowRight size={18} />
      </button>
    </form>
  );
}
