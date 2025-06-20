import { create } from 'zustand';
import { ChatMessage } from './gemini/gemini-service';
import { RepoAnalysisData } from './github/github-service';

interface AnalysisState {
  // Repository URL and validation
  repoUrl: string;
  isValidUrl: boolean;
  setRepoUrl: (url: string) => void;
  
  // Loading states
  isValidating: boolean;
  isAnalyzing: boolean;
  setIsValidating: (state: boolean) => void;
  setIsAnalyzing: (state: boolean) => void;
  
  // Analysis data
  analysisData: RepoAnalysisData | null;
  aiSummary: string;
  detailedSummary: string;
  workflowDiagram: string;
  setAnalysisData: (data: RepoAnalysisData | null) => void;
  setAiSummary: (summary: string) => void;
  setDetailedSummary: (summary: string) => void;
  setWorkflowDiagram: (diagram: string) => void;
  
  // Chat messages
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  
  // Analysis completion state
  isAnalysisComplete: boolean;
  setIsAnalysisComplete: (state: boolean) => void;
  
  // Error handling
  error: string | null;
  setError: (error: string | null) => void;
  
  // Reset state
  resetState: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  // Repository URL and validation
  repoUrl: '',
  isValidUrl: false,
  setRepoUrl: (url) => set({ repoUrl: url }),
  
  // Loading states
  isValidating: false,
  isAnalyzing: false,
  setIsValidating: (state) => set({ isValidating: state }),
  setIsAnalyzing: (state) => set({ isAnalyzing: state }),
  
  // Analysis data
  analysisData: null,
  aiSummary: '',
  detailedSummary: '',
  workflowDiagram: '',
  setAnalysisData: (data) => set({ analysisData: data }),
  setAiSummary: (summary) => set({ aiSummary: summary }),
  setDetailedSummary: (summary) => set({ detailedSummary: summary }),
  setWorkflowDiagram: (diagram) => set({ workflowDiagram: diagram }),
  
  // Chat messages
  messages: [],
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  
  // Analysis completion state
  isAnalysisComplete: false,
  setIsAnalysisComplete: (state) => set({ isAnalysisComplete: state }),
  
  // Error handling
  error: null,
  setError: (error) => set({ error }),
  
  // Reset state
  resetState: () => set({
    repoUrl: '',
    isValidUrl: false,
    isValidating: false,
    isAnalyzing: false,
    analysisData: null,
    aiSummary: '',
    detailedSummary: '',
    workflowDiagram: '',
    messages: [],
    isAnalysisComplete: false,
    error: null,
  }),
}));
