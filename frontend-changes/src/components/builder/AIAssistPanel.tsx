/**
 * AIAssistPanel.tsx
 * Drop into src/components/builder/
 * Shows AI improvement buttons contextually in the form sections
 */
import { useState } from 'react';
import { Sparkles, Loader2, Copy, Check, Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ResumeData } from '@/contexts/ResumeContext';

interface SummaryAssistProps {
  currentSummary: string;
  jobTitle?: string;
  skills?: string[];
  onApply: (improved: string) => void;
}

export function SummaryAssist({ currentSummary, jobTitle, skills, onApply }: SummaryAssistProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();

  const isPro = user?.role === 'pro' || user?.role === 'admin';

  async function improve() {
    if (!currentSummary.trim()) return;
    setIsLoading(true);
    try {
      const { data } = await aiAPI.improveSummary({ currentSummary, jobTitle, skills });
      setSuggestion(data.improved);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(suggestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isPro) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
        <Sparkles className="w-3 h-3 text-primary" />
        <span>AI summary improvement is a <span className="text-primary font-medium">Pro</span> feature</span>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={improve}
        disabled={isLoading || !currentSummary.trim()}
        className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
      >
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
        Improve with AI
      </Button>

      {suggestion && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
          <p className="text-xs text-foreground leading-relaxed">{suggestion}</p>
          <div className="flex gap-2">
            <Button size="sm" className="h-6 text-xs gap-1" onClick={() => onApply(suggestion)}>
              <Check className="w-3 h-3" />Apply
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={handleCopy}>
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bullet point suggestions for experience ──────────────────
interface BulletAssistProps {
  position: string;
  company?: string;
  existingDescription?: string;
  onApply: (bullets: string) => void;
}

export function BulletAssist({ position, company, existingDescription, onApply }: BulletAssistProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [bullets, setBullets] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const isPro = user?.role === 'pro' || user?.role === 'admin';

  async function generate() {
    if (!position.trim()) return;
    setIsLoading(true);
    setIsOpen(true);
    try {
      const { data } = await aiAPI.generateBullets({ position, company, existingDescription, numberOfPoints: 3 });
      setBullets(data.bullets);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }

  if (!isPro) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => (bullets.length ? setIsOpen((v) => !v) : generate())}
        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        {isLoading ? 'Generating…' : 'Suggest bullet points'}
        {bullets.length > 0 && (isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>

      {isOpen && bullets.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {bullets.map((bullet, i) => (
            <div key={i} className="flex items-start gap-2 bg-primary/5 rounded-lg px-3 py-2">
              <span className="text-primary mt-0.5">•</span>
              <p className="text-xs flex-1 leading-relaxed">{bullet}</p>
              <button
                type="button"
                onClick={() => onApply(bullet)}
                className="text-[10px] text-primary hover:underline shrink-0"
              >
                Add
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onApply(bullets.join('\n'))}
            className="h-6 text-xs"
          >
            Add all
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Skill suggestions ────────────────────────────────────────
interface SkillSuggestProps {
  jobTitle: string;
  existingSkills: string[];
  onAddSkill: (skill: string) => void;
}

export function SkillSuggest({ jobTitle, existingSkills, onAddSkill }: SkillSuggestProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  async function suggest() {
    if (!jobTitle.trim()) return;
    setIsLoading(true);
    try {
      const { data } = await aiAPI.suggestSkills({ jobTitle, existingSkills });
      setSuggestions(data.skills.filter((s) => !existingSkills.includes(s)));
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => (suggestions.length ? setSuggestions([]) : suggest())}
        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        {isLoading ? 'Loading…' : suggestions.length ? 'Hide suggestions' : 'Suggest skills with AI'}
      </button>

      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((skill) => (
            <button
              type="button"
              key={skill}
              onClick={() => {
                onAddSkill(skill);
                setSuggestions((s) => s.filter((x) => x !== skill));
              }}
              className="text-xs border border-primary/40 text-primary rounded-full px-3 py-0.5 hover:bg-primary/10 transition-colors"
            >
              + {skill}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
