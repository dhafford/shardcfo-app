import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1a1a2e] rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold font-mono">&lt;/&gt;</span>
          </div>
          <span className="text-xl font-semibold tracking-tight">ShardCFO</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-10">
        <Image
          src="/logo.svg"
          alt="ShardCFO"
          width={300}
          height={80}
          priority
        />
        <Link href="/login">
          <Button size="lg" className="px-10">
            Log in
          </Button>
        </Link>
      </main>
    </div>
  );
}
