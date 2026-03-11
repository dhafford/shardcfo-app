import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-12 max-w-3xl mx-auto">
      <Link
        href="/signup"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <h1 className="text-2xl font-bold mb-6">Terms of Service</h1>

      <div className="prose prose-slate text-sm space-y-4">
        <p>
          <strong>Last updated:</strong> March 2026
        </p>

        <h2 className="text-lg font-semibold mt-6">1. Acceptance of Terms</h2>
        <p>
          By accessing or using ShardCFO (&quot;the Service&quot;), you agree to be bound by these
          Terms of Service. If you do not agree, you may not use the Service.
        </p>

        <h2 className="text-lg font-semibold mt-6">2. Description of Service</h2>
        <p>
          ShardCFO provides financial analysis, reporting, and portfolio management tools
          for CFOs, venture capital firms, and finance professionals. The Service is provided
          on an &quot;as-is&quot; basis.
        </p>

        <h2 className="text-lg font-semibold mt-6">3. User Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials
          and for all activities under your account. You must provide accurate information
          when creating your account.
        </p>

        <h2 className="text-lg font-semibold mt-6">4. Data and Privacy</h2>
        <p>
          Your use of the Service is also governed by our{" "}
          <Link href="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
          . You retain ownership of all financial data you upload to the Service.
        </p>

        <h2 className="text-lg font-semibold mt-6">5. Limitation of Liability</h2>
        <p>
          The Service is not a substitute for professional financial advice. ShardCFO shall
          not be liable for any financial decisions made based on data presented in the
          platform.
        </p>

        <h2 className="text-lg font-semibold mt-6">6. Contact</h2>
        <p>
          For questions about these terms, contact us at support@shardcfo.com.
        </p>
      </div>
    </div>
  );
}
