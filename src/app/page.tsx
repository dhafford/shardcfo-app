import Link from "next/link";
import {
  BarChart3,
  PieChart,
  FileText,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: BarChart3,
    title: "Financial Statements",
    description:
      "Interactive P&L, balance sheet, and cash flow views with drill-down capability and period comparisons.",
  },
  {
    icon: TrendingUp,
    title: "SaaS Metrics",
    description:
      "MRR, ARR, churn, NDR, CAC, LTV, Rule of 40 — all calculated automatically with benchmark context.",
  },
  {
    icon: FileText,
    title: "Board Deck Builder",
    description:
      "Assemble professional board decks from live data. Export to PDF or PPTX with one click.",
  },
  {
    icon: PieChart,
    title: "Scenario Modeling",
    description:
      "What-if analysis for fundraising, hiring, and growth projections with sensitivity tables.",
  },
  {
    icon: Shield,
    title: "Budget Variance",
    description:
      "Actual vs. budget tracking with threshold alerts and contextual formatting.",
  },
  {
    icon: Zap,
    title: "Data Import",
    description:
      "Upload CSV or Excel exports from QuickBooks, Xero, or any accounting system. Smart column mapping.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1a1a2e] rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight">
              ShardCFO
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 max-w-4xl mx-auto">
          The command center for{" "}
          <span className="text-[#3b82f6]">fractional CFOs</span>
        </h1>
        <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
          Onboard clients, import financial data, run analyses, generate board
          decks, and manage your entire portfolio from a single dashboard.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="px-8">
              Start Free
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="px-8">
              Log in
            </Button>
          </Link>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-2xl font-semibold text-center mb-12 tracking-tight">
          Everything you need to manage client financials
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="border rounded-xl p-6 bg-white hover:shadow-md transition-shadow"
            >
              <feature.icon className="w-10 h-10 text-[#3b82f6] mb-4" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500">
          <p>
            ShardCFO assists financial analysis but does not constitute
            financial advice. All outputs should be reviewed by qualified
            financial professionals.
          </p>
          <p className="mt-2">&copy; {new Date().getFullYear()} ShardCFO</p>
        </div>
      </footer>
    </div>
  );
}
