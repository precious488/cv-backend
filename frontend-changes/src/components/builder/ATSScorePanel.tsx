/**
 * ATSScorePanel.tsx
 * Drop into src/components/builder/
 * Usage in Builder.tsx: <ATSScorePanel resumeData={currentResume} cvId={id} />
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, ChevronDown, ChevronUp, Loader2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { atsAPI, ATSResult } from '@/lib/api';
import type { ResumeData } from '@/contexts/ResumeContext';

interface Props {
  resumeData: ResumeData;
  cvId?: string;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="6"
          className="text-muted/30" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[9px] text-muted-foreground font-medium">/ 100</span>
      </div>
    </div>
  );
}

function BarScore({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'bg-green-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export default function ATSScorePanel({ resumeData, cvId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState<ATSResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function runAnalysis() {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await atsAPI.analyze(resumeData, jobDescription || undefined, cvId);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Header */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">ATS Score Analyzer</span>
          {result && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              result.overallScore >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
              : result.overallScore >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
            }`}>
              {result.overallScore}/100
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
              {/* Job Description input */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Paste job description (optional — improves keyword matching)
                </label>
                <Textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job posting here..."
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>

              <Button
                onClick={runAnalysis}
                disabled={isLoading}
                size="sm"
                className="w-full bg-gradient-primary text-white hover:opacity-90"
              >
                {isLoading ? (
                  <><Loader2 className="w-3 h-3 mr-2 animate-spin" />Analyzing…</>
                ) : (
                  <><Target className="w-3 h-3 mr-2" />Analyze Resume</>
                )}
              </Button>

              {error && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />{error}
                </p>
              )}

              {/* Results */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Score ring */}
                  <div className="flex items-center gap-4">
                    <ScoreRing score={result.overallScore} />
                    <div className="flex-1 space-y-2">
                      <BarScore label="Keyword Match" value={result.breakdown.keywordMatch} />
                      <BarScore label="Completeness" value={result.breakdown.sectionCompleteness} />
                      <BarScore label="Action Verbs" value={result.breakdown.actionVerbs} />
                      <BarScore label="Achievements" value={result.breakdown.quantifiableAchievements} />
                    </div>
                  </div>

                  {/* Keywords */}
                  {result.matchedKeywords.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />Matched Keywords
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {result.matchedKeywords.slice(0, 10).map((kw) => (
                          <span key={kw} className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.missingKeywords.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-500 mb-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />Missing Keywords
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {result.missingKeywords.map((kw) => (
                          <span key={kw} className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {result.suggestions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-primary" />Suggestions
                      </p>
                      <ul className="space-y-1.5">
                        {result.suggestions.map((s, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground flex gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
