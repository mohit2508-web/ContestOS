"use client";

import { useState, useCallback } from 'react';
import { api } from '../services/api';

interface ResumeAnalysisResult {
  score: number;
  atsScore: number;
  improvements: string[];
  suggestions: string[];
  weaknesses: string[];
  strengths: string[];
  recommendedRoles: string[];
}

export function useResumeAnalyzer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ResumeAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumeSkills, setResumeSkills] = useState<string[]>([]);
  const [showResumeUpload, setShowResumeUpload] = useState(false);

  const analyzeResume = useCallback(async (file: File) => {
    const validTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(ext)) {
      setError('Please upload a valid file type (.pdf, .doc, .docx, .txt)');
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return false;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const analysisResult = await api.uploadResume(file);
      setResult(analysisResult);

      // Process skills and roles from the result
      const allSkills: string[] = [];
      if (analysisResult.skills) {
        if (Array.isArray(analysisResult.skills)) {
          allSkills.push(...analysisResult.skills.map((s: any) => typeof s === 'string' ? s : s.name || s.skill || ''));
        } else if (typeof analysisResult.skills === 'object') {
          Object.values(analysisResult.skills as Record<string, any>).forEach((group: any) => {
            if (Array.isArray(group)) allSkills.push(...group.map((s: any) => typeof s === 'string' ? s : s.name || s.skill || ''));
          });
        }
      }
      if (analysisResult.recommendedRoles && Array.isArray(analysisResult.recommendedRoles)) {
        const firstRole = analysisResult.recommendedRoles[0] || '';
        setResumeSkills(allSkills.filter(Boolean));
        return { success: true, role: firstRole, skills: allSkills.filter(Boolean) };
      }
      setResumeSkills(allSkills.filter(Boolean));
      return { success: true, role: '', skills: allSkills.filter(Boolean) };
    } catch (err) {
      setError('Failed to analyze resume. Please try again.');
      console.error('Resume analysis error:', err);
      return { success: false, error: err };
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const reset = () => {
    setResult(null);
    setError(null);
    setResumeSkills([]);
    setShowResumeUpload(false);
  };

  return {
    isAnalyzing,
    result,
    error,
    resumeSkills,
    showResumeUpload,
    setShowResumeUpload,
    analyzeResume,
    reset,
  };
}