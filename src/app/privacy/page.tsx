import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-12 max-w-3xl mx-auto">
      <Link
        href="/signup"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>

      <div className="prose prose-slate text-sm space-y-4">
        <p>
          <strong>Last updated:</strong> March 2026
        </p>

        <h2 className="text-lg font-semibold mt-6">1. Information We Collect</h2>
        <p>
          We collect information you provide directly: name, email address, firm name,
          and financial data you upload to the platform. We also collect usage data such
          as pages visited and features used.
        </p>

        <h2 className="text-lg font-semibold mt-6">2. How We Use Your Information</h2>
        <p>
          Your information is used to provide and improve the Service, authenticate your
          account, and communicate important updates. Financial data you upload is used
          solely to power the analysis features you access.
        </p>

        <h2 className="text-lg font-semibold mt-6">3. Data Storage and Security</h2>
        <p>
          All data is stored securely using Supabase infrastructure with row-level security
          policies. Data is encrypted in transit and at rest. We do not sell or share your
          financial data with third parties.
        </p>

        <h2 className="text-lg font-semibold mt-6">4. Data Retention</h2>
        <p>
          Your data is retained as long as your account is active. You may request deletion
          of your account and associated data at any time by contacting support.
        </p>

        <h2 className="text-lg font-semibold mt-6">5. Your Rights</h2>
        <p>
          You have the right to access, correct, or delete your personal data. You may
          export your financial data at any time through the platform.
        </p>

        <h2 className="text-lg font-semibold mt-6">6. Contact</h2>
        <p>
          For privacy-related inquiries, contact us at privacy@shardcfo.com.
        </p>
      </div>
    </div>
  );
}
