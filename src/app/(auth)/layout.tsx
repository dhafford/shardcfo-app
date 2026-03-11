import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ShardCFO — Sign In",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      <header className="py-6 px-4">
        <div className="max-w-sm mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#1a1a2e] hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 bg-[#1a1a2e] rounded-md flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              ShardCFO
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="py-6 px-4 text-center">
        <p className="text-xs text-slate-400">
          &copy; {new Date().getFullYear()} ShardCFO. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
