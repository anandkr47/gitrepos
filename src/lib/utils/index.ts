import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names with Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates a GitHub repository URL
 * @param url The URL to validate
 * @returns A boolean indicating if the URL is valid
 */
export function isValidGitHubUrl(url: string): boolean {
  // Basic GitHub URL validation
  const githubUrlPattern = /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-_.]+\/?$/;
  return githubUrlPattern.test(url);
}

/**
 * Extracts owner and repo name from a GitHub URL
 * @param url The GitHub URL
 * @returns An object containing owner and repo name
 */
export function extractRepoInfo(url: string): { owner: string; repo: string } | null {
  if (!isValidGitHubUrl(url)) return null;
  
  // Remove trailing slash if present
  const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  
  // Extract owner and repo from URL
  const parts = cleanUrl.split('/');
  const owner = parts[parts.length - 2];
  const repo = parts[parts.length - 1];
  
  return { owner, repo };
}

/**
 * Delay function for simulating loading states
 * @param ms Milliseconds to delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
