"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, loginWithMagicLink, loginWithGoogle } from "./actions";

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = searchParams.get("message");

  const [mode, setMode] = useState<"password" | "magic">("password");

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold text-[#1a1a2e]">
            Welcome back
          </CardTitle>
          <CardDescription>
            Sign in to your ShardCFO account
          </CardDescription>
        </CardHeader>


        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
              {message}
            </div>
          )}

          {/* Google OAuth */}
          <form action={loginWithGoogle}>
            <Button
              type="submit"
              variant="outline"
              className="w-full h-9 gap-2"
            >
              <GoogleIcon />
              Continue with Google
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setMode("password")}
              className={`flex-1 py-1.5 transition-colors ${
                mode === "password"
                  ? "bg-[#1a1a2e] text-white font-medium"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setMode("magic")}
              className={`flex-1 py-1.5 transition-colors ${
                mode === "magic"
                  ? "bg-[#1a1a2e] text-white font-medium"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              Magic link
            </button>
          </div>

          {mode === "password" ? (
            <form action={login} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#1a1a2e] text-white hover:bg-[#1a1a2e]/90 h-9"
              >
                Sign in
              </Button>
            </form>
          ) : (
            <form action={loginWithMagicLink} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="magic-email">Email</Label>
                <Input
                  id="magic-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#1a1a2e] text-white hover:bg-[#1a1a2e]/90 h-9"
              >
                Send magic link
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-[#1a1a2e] hover:underline"
            >
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="space-y-4 animate-pulse" />}>
      <LoginForm />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-4"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
