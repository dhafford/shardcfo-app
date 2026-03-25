import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-10">
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
    </div>
  );
}
