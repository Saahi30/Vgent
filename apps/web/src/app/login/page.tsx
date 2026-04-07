"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertCircle, Lock } from "lucide-react";
import { setToken } from "@/lib/api";
import { FadeIn, motion, AnimatePresence } from "@/components/motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Store JWT token and user info
        if (data.access_token) {
          setToken(data.access_token);
        }
        if (data.user) {
          localStorage.setItem("vgent_user", JSON.stringify(data.user));
        }
        router.push("/");
        router.refresh();
      } else {
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
        <FadeIn delay={0.1}>
          <h1 className="text-heading-03 font-semibold text-foreground tracking-tight">Vgent</h1>
        </FadeIn>
        <FadeIn delay={0.3} y={20}>
          <div className="max-w-md">
            <h2 className="text-display-01 text-foreground leading-tight">
              Voice AI Agent Platform
            </h2>
            <p className="text-body-long-01 text-muted-foreground mt-4">
              Create, deploy, and manage intelligent voice agents that make outbound calls at scale.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.5}>
          <p className="text-caption-01 text-muted-foreground">
            &copy; {new Date().getFullYear()} Vgent. All rights reserved.
          </p>
        </FadeIn>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <FadeIn className="lg:hidden mb-12">
            <h1 className="text-heading-03 font-semibold text-foreground tracking-tight">Vgent</h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mb-8">
              <motion.div
                className="h-10 w-10 bg-layer-01 flex items-center justify-center mb-6"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <Lock className="h-5 w-5 text-primary" />
              </motion.div>
              <h2 className="text-heading-04 text-foreground">Log in</h2>
              <p className="text-body-short-01 text-muted-foreground mt-1">
                Enter your credentials to access the platform.
              </p>
            </div>
          </FadeIn>

          {/* Error notification */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-3 bg-destructive/10 border-l-2 border-l-destructive px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-body-short-01 text-destructive">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <FadeIn delay={0.35}>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-caption-01 text-muted-foreground mb-2"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
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

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary text-primary-foreground text-body-short-01 font-medium flex items-center justify-between px-4 transition-colors hover:bg-primary/85 active:bg-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
              >
                <span>{loading ? "Signing in..." : "Continue"}</span>
                <motion.div
                  animate={loading ? { x: [0, 4, 0] } : {}}
                  transition={loading ? { repeat: Infinity, duration: 1 } : {}}
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              </motion.button>
            </form>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
