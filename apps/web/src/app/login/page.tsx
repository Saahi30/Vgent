"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertCircle, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Invalid credentials");
      }
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-layer-01 flex-col justify-between p-12">
        <div>
          <h1 className="text-heading-03 font-semibold text-foreground tracking-tight">Vgent</h1>
        </div>
        <div className="max-w-md">
          <h2 className="text-display-01 text-foreground leading-tight">
            Voice AI Agent Platform
          </h2>
          <p className="text-body-long-01 text-muted-foreground mt-4">
            Create, deploy, and manage intelligent voice agents that make outbound calls at scale.
          </p>
        </div>
        <p className="text-caption-01 text-muted-foreground">
          &copy; {new Date().getFullYear()} Vgent. All rights reserved.
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-12">
            <h1 className="text-heading-03 font-semibold text-foreground tracking-tight">Vgent</h1>
          </div>

          <div className="mb-8">
            <div className="h-10 w-10 bg-layer-01 flex items-center justify-center mb-6">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-heading-04 text-foreground">Log in</h2>
            <p className="text-body-short-01 text-muted-foreground mt-1">
              Enter your credentials to access the platform.
            </p>
          </div>

          {/* Error notification — Carbon inline notification */}
          {error && (
            <div className="flex items-start gap-3 bg-destructive/10 border-l-2 border-l-destructive px-4 py-3 mb-6">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-body-short-01 text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username field — Carbon bottom-border input */}
            <div>
              <label
                htmlFor="username"
                className="block text-caption-01 text-muted-foreground mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoFocus
                className="w-full h-10 bg-layer-01 border-0 border-b-2 border-b-muted px-4 text-body-short-01 text-foreground placeholder:text-muted-foreground/50 transition-colors focus:border-b-primary focus:outline-none"
              />
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="password"
                className="block text-caption-01 text-muted-foreground mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full h-10 bg-layer-01 border-0 border-b-2 border-b-muted px-4 text-body-short-01 text-foreground placeholder:text-muted-foreground/50 transition-colors focus:border-b-primary focus:outline-none"
              />
            </div>

            {/* Submit — Carbon primary button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary text-primary-foreground text-body-short-01 font-medium flex items-center justify-between px-4 transition-colors hover:bg-primary/85 active:bg-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
            >
              <span>{loading ? "Signing in..." : "Continue"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
