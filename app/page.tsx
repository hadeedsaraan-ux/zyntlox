"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState("");

  const handleRoast = async () => {
    if (!url) {
      alert("Please enter a website URL first!");
      return;
    }

    setLoading(true);
    setReport(null);
    setError("");

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setReport(data.report);
      }
    } catch (err) {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-12">
      <h1 className="text-4xl md:text-6xl font-bold mb-4 text-center">
        ZYNTLOX
      </h1>
      <p className="text-gray-400 mb-8 text-center max-w-md">
        Get brutally honest, actionable feedback for your website in under 60 seconds.
      </p>

      <div className="w-full max-w-md flex flex-col gap-4">
        <input
          type="text"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white outline-none focus:border-orange-500"
        />
        <button
          onClick={handleRoast}
          disabled={loading}
          className="px-4 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 font-semibold transition disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "🔥 Roast My Website"}
        </button>
      </div>

      {error && (
        <div className="mt-6 w-full max-w-md bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {report && (
        <div className="mt-8 w-full max-w-2xl space-y-6">
          {/* Overall Score */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 text-center">
            <p className="text-gray-500 mb-1">Overall Score</p>
            <p className="text-5xl font-bold text-orange-500">{report.overallScore}/100</p>
          </div>

          {/* First Impression */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">👀 First Impression</h3>
            <p className="text-gray-300">{report.firstImpression}</p>
          </div>

          {/* Sub Scores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
              <p className="text-gray-500 text-sm">Design</p>
              <p className="text-2xl font-bold">{report.designScore}/10</p>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
              <p className="text-gray-500 text-sm">Trust</p>
              <p className="text-2xl font-bold">{report.trustScore}/10</p>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
              <p className="text-gray-500 text-sm">UX</p>
              <p className="text-2xl font-bold">{report.uxScore}/10</p>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
              <p className="text-gray-500 text-sm">SEO</p>
              <p className="text-2xl font-bold">{report.seoScore}/10</p>
            </div>
          </div>

          {/* Biggest Problems */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3">❌ Biggest Problems</h3>
            <div className="space-y-3">
              {report.biggestProblems?.map((p: any, i: number) => (
                <div key={i} className="border-b border-gray-800 pb-2 last:border-0">
                  <p className="text-gray-200">{p.issue}</p>
                  <p className="text-sm text-gray-500">
                    Impact: {p.impact} • Effort: {p.effort}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Wins */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3">✅ Quick Wins</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              {report.quickWins?.map((q: string, i: number) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>

          {/* Suggestions */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3">💡 AI Suggestions</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              {report.suggestions?.map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
