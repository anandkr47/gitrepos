/* eslint-disable @typescript-eslint/no-explicit-any */
import { Octokit } from "octokit";

// Define types for repository data
export interface RepoData {
  name: string;
  fullName: string;
  description: string;
  url: string;
  homepage: string;
  language: string;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  size: number;
  topics: string[];
  visibility: string;
  owner: {
    login: string;
    avatarUrl: string;
    url: string;
  };
}

export interface RepoContent {
  readme: string;
  dependencies: {
    [key: string]: string;
  };
  folderStructure: any;
  languages: {
    [key: string]: number;
  };
  commits: Array<{
    sha: string;
    message: string;
    author: string;
    date: string;
  }>;
}

export interface RepoAnalysisData {
  repoData: RepoData;
  repoContent: RepoContent;
}

/**
 * GitHub service for fetching repository data
 */
export class GitHubService {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN,
    });
  }

  /**
   * Validates if a repository exists and is accessible
   */
  async validateRepo(owner: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.rest.repos.get({ owner, repo });
      return true;
    } catch (error) {
      console.error("Error validating repository:", error);
      return false;
    }
  }

  /**
   * Fetches basic repository data
   */
  async getRepoData(owner: string, repo: string): Promise<RepoData> {
    try {
      const { data } = await this.octokit.rest.repos.get({ owner, repo });
      
      return {
        name: data.name,
        fullName: data.full_name,
        description: data.description || "",
        url: data.html_url,
        homepage: data.homepage || "",
        language: data.language || "",
        stargazersCount: data.stargazers_count,
        forksCount: data.forks_count,
        openIssuesCount: data.open_issues_count,
        defaultBranch: data.default_branch,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        pushedAt: data.pushed_at,
        size: data.size,
        topics: data.topics || [],
        visibility: data.visibility || "",
        owner: {
          login: data.owner.login,
          avatarUrl: data.owner.avatar_url,
          url: data.owner.html_url,
        },
      };
    } catch (error) {
      console.error("Error fetching repo data:", error);
      throw new Error("Failed to fetch repository data");
    }
  }

  /**
   * Fetches README content
   */
  async getReadme(owner: string, repo: string): Promise<string> {
    try {
      const { data } = await this.octokit.rest.repos.getReadme({
        owner,
        repo,
        mediaType: {
          format: "raw",
        },
      });
      
      return data as unknown as string;
    } catch (error) {
      console.warn("README not found:", error);
      return "";
    }
  }

  /**
   * Fetches package dependencies
   */
  async getDependencies(owner: string, repo: string): Promise<{ [key: string]: string }> {
    const dependencies: { [key: string]: string } = {};
    
    try {
      // Try to fetch package.json for JavaScript/TypeScript projects
      const { data: packageJson } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: "package.json",
      });
      
      if ("content" in packageJson) {
        const content = Buffer.from(packageJson.content, "base64").toString();
        const parsed = JSON.parse(content);
        
        return {
          ...parsed.dependencies || {},
          ...parsed.devDependencies || {},
        };
      }
    } catch (error) {
      console.error("Error fetching dependencies:", error);
      // package.json not found, try requirements.txt for Python
      try {
        const { data: requirementsTxt } = await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path: "requirements.txt",
        });
        
        if ("content" in requirementsTxt) {
          const content = Buffer.from(requirementsTxt.content, "base64").toString();
          
          // Parse requirements.txt format
          content.split("\n").forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith("#")) {
              const [name, version] = trimmedLine.split("==");
              if (name) {
                dependencies[name.trim()] = version ? version.trim() : "latest";
              }
            }
          });
        }
      } catch (error) {
        // Neither package.json nor requirements.txt found
        console.warn("Dependencies files not found", error);
      }
    }
    
    return dependencies;
  }

  /**
   * Fetches repository languages
   */
  async getLanguages(owner: string, repo: string): Promise<{ [key: string]: number }> {
    try {
      const { data } = await this.octokit.rest.repos.listLanguages({
        owner,
        repo,
      });
      
      return data;
    } catch (error) {
      console.error("Error fetching languages:", error);
      return {};
    }
  }

  /**
   * Fetches recent commits
   */
  async getRecentCommits(owner: string, repo: string, count: number = 10): Promise<Array<{ sha: string; message: string; author: string; date: string }>> {
    try {
      const { data } = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: count,
      });
      
      return data.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name || "Unknown",
        date: commit.commit.author?.date || "",
      }));
    } catch (error) {
      console.error("Error fetching commits:", error);
      return [];
    }
  }

  /**
   * Fetches folder structure (top level)
   */
  async getFolderStructure(owner: string, repo: string): Promise<any> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: "",
      });
      
      if (Array.isArray(data)) {
        return data.map(item => ({
          name: item.name,
          path: item.path,
          type: item.type,
          size: item.size,
        }));
      }
      
      return [];
    } catch (error) {
      console.error("Error fetching folder structure:", error);
      return [];
    }
  }

  /**
   * Analyzes a repository and returns all relevant data
   */
  async analyzeRepository(owner: string, repo: string): Promise<RepoAnalysisData> {
    try {
      // Check if repo exists and is accessible
      const isValid = await this.validateRepo(owner, repo);
      if (!isValid) {
        throw new Error("Repository not found or not accessible");
      }
      
      // Fetch all data in parallel
      const [
        repoData,
        readme,
        dependencies,
        languages,
        commits,
        folderStructure,
      ] = await Promise.all([
        this.getRepoData(owner, repo),
        this.getReadme(owner, repo),
        this.getDependencies(owner, repo),
        this.getLanguages(owner, repo),
        this.getRecentCommits(owner, repo),
        this.getFolderStructure(owner, repo),
      ]);
      
      return {
        repoData,
        repoContent: {
          readme,
          dependencies,
          folderStructure,
          languages,
          commits,
        },
      };
    } catch (error) {
      console.error("Error analyzing repository:", error);
      throw error;
    }
  }
}
