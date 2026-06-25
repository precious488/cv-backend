/**
 * useDownloadPDF.ts
 * Drop into src/hooks/
 * Replaces the frontend jsPDF/html2canvas approach with the backend Document Service.
 */
import { useState } from 'react';
import { documentAPI } from '@/lib/api';
import type { ResumeData } from '@/contexts/ResumeContext';

export function useDownloadPDF() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadPDF(resumeData: ResumeData) {
    setIsDownloading(true);
    setError(null);
    try {
      const blob = await documentAPI.generatePDF(resumeData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const name = resumeData.personalInfo.fullName
        ? `${resumeData.personalInfo.fullName.replace(/\s+/g, '_')}_Resume.pdf`
        : 'resume.pdf';
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsDownloading(false);
    }
  }

  return { downloadPDF, isDownloading, error };
}
