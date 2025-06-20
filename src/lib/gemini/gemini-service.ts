import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { RepoAnalysisData } from "../github/github-service";
import { mcpServer } from "./mcp-server";

export interface AIAnalysisResult {
  summary: string;
  detailedSummary: string;
  projectPurpose: string;
  technologyStack: string[];
  codeQuality: string;
  architecturePatterns: string;
  potentialImprovements: string;
  securityConsiderations: string;
  workflowDiagram: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Gemini AI service for analyzing repository data
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private repoContext: string = "";

  constructor(apiKey?: string) {
    this.genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY || "");
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  /**
   * Creates a structured prompt for repository analysis
   */
  private createAnalysisPrompt(repoData: RepoAnalysisData): string {
    const { repoData: repo, repoContent: content } = repoData;
    
    // Create a structured prompt for the AI
    return `
      Analyze the following GitHub repository:
      
      # Repository Information
      - Name: ${repo.name}
      - Full Name: ${repo.fullName}
      - Description: ${repo.description}
      - Primary Language: ${repo.language}
      - Stars: ${repo.stargazersCount}
      - Forks: ${repo.forksCount}
      - Open Issues: ${repo.openIssuesCount}
      - Created: ${repo.createdAt}
      - Last Updated: ${repo.updatedAt}
      - Last Push: ${repo.pushedAt}
      - Size: ${repo.size} KB
      - Topics: ${repo.topics.join(", ")}
      
      # README Content
      ${content.readme}
      
      # Dependencies
      ${Object.entries(content.dependencies)
        .map(([name, version]) => `- ${name}: ${version}`)
        .join("\n")}
      
      # Languages Used
      ${Object.entries(content.languages)
        .map(([language, bytes]) => `- ${language}: ${bytes} bytes`)
        .join("\n")}
      
      # Folder Structure
      ${JSON.stringify(content.folderStructure, null, 2)}
      
      # Recent Commits
      ${content.commits
        .map(commit => `- ${commit.date}: ${commit.message} (${commit.author})`)
        .join("\n")}
      
      Based on this information, provide a comprehensive analysis of the repository including:
      1. A brief summary (50-100 words) of the project's purpose and functionality
      2. A detailed summary (200-300 words) with in-depth analysis of the project's architecture, components, and functionality
      3. The main technology stack used
      4. An assessment of the code quality and structure
      5. Identified architecture patterns
      6. Potential improvements or suggestions
      7. Security considerations (if applicable)
      8. A Mermaid diagram that visualizes the workflow or architecture of the application
      
      For the Mermaid diagram, use the following guidelines:
      - Use the graph TD (top-down) or graph LR (left-right) syntax
      - Include key components, services, and data flows
      - Keep it concise but informative (10-15 nodes maximum)
      - Focus on the main user flows or data processing paths
      - Use proper Mermaid syntax with nodes, connections, and labels
      - Wrap the diagram in triple backtick mermaid and triple backtick
      
      Format your response in a structured way that's easy to parse programmatically.
    `;
  }

  /**
   * Analyzes a repository using Gemini AI
   */
  async analyzeRepository(repoData: RepoAnalysisData): Promise<AIAnalysisResult> {
    try {
      const prompt = this.createAnalysisPrompt(repoData);
      
      // Store detailed context for future chat
      this.repoContext = `
# Repository Information
Repository: ${repoData.repoData.fullName}
URL: ${repoData.repoData.url}
Description: ${repoData.repoData.description}
Primary Language: ${repoData.repoData.language}
Stars: ${repoData.repoData.stargazersCount}
Forks: ${repoData.repoData.forksCount}
Topics: ${repoData.repoData.topics.join(", ")}

# Project Analysis
This repository contains a ${repoData.repoData.language || "software"} project with ${Object.keys(repoData.repoContent.dependencies).length} dependencies.
The main files are organized in a structure with ${repoData.repoContent.folderStructure.length} top-level items.
The project has ${repoData.repoContent.commits.length} recent commits.

You are an AI assistant that has analyzed this repository and can answer questions about its structure, code, and functionality.
When asked questions, provide specific details about this repository based on the analysis data.
      `;
      
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      
      // Parse the response into structured data
      const summary = this.extractSection(text, "summary") || 
                     this.extractSection(text, "brief summary") || 
                     this.extractSection(text, "project purpose");
      
      const detailedSummary = this.extractSection(text, "detailed summary") || 
                            this.extractSection(text, "in-depth analysis") || 
                            this.extractSection(text, "comprehensive analysis");
      
      const techStack = this.extractSection(text, "technology stack") || 
                       this.extractSection(text, "tech stack") || 
                       this.extractSection(text, "technologies");
      
      const codeQuality = this.extractSection(text, "code quality") || 
                         this.extractSection(text, "quality assessment") || 
                         this.extractSection(text, "code structure");
      
      const architecturePatterns = this.extractSection(text, "architecture patterns") || 
                                  this.extractSection(text, "architecture") || 
                                  this.extractSection(text, "design patterns");
      
      const improvements = this.extractSection(text, "potential improvements") || 
                          this.extractSection(text, "improvements") || 
                          this.extractSection(text, "suggestions");
      
      const security = this.extractSection(text, "security considerations") || 
                      this.extractSection(text, "security") || 
                      this.extractSection(text, "security issues");
      
      // Extract Mermaid diagram
      const workflowDiagram = this.extractMermaidDiagram(text);
      
      // Extract technology stack as an array
      const techStackArray = techStack
        .split(/[,\n]/)
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0 && !item.startsWith('-') && !item.startsWith('*'))
        .map((item: string) => item.replace(/^[-.* ]+/, '').trim());
      
      const aiAnalysis: AIAnalysisResult = {
        summary,
        detailedSummary,
        projectPurpose: summary,
        technologyStack: techStackArray,
        codeQuality,
        architecturePatterns,
        potentialImprovements: improvements,
        securityConsiderations: security,
        workflowDiagram,
      };
      
      // Initialize the MCP server with the repository data and analysis
      mcpServer.initialize(repoData, aiAnalysis);
      
      return aiAnalysis;
    } catch (error) {
      console.error("Error analyzing repository with AI:", error);
      throw new Error("Failed to analyze repository with AI");
    }
  }

  /**
   * Extracts a section from the AI response text
   */
  private extractSection(text: string, sectionName: string): string {
    // Case insensitive search for section headers
    const regex = new RegExp(`(?:^|\\n)(?:\\d+\\.?\\s*)?(?:${sectionName}|${sectionName.toUpperCase()}|${this.capitalizeFirstLetter(sectionName)})[:\\s-]*([\\s\\S]*?)(?:\\n(?:\\d+\\.?\\s*)?(?:[A-Z][a-z]+|[A-Z\\s]+)[:\\s-]|$)`, 'i');
    const match = text.match(regex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    return "";
  }

  /**
   * Capitalizes the first letter of a string
   */
  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  /**
   * Extracts a Mermaid diagram from the AI response text
   */
  private extractMermaidDiagram(text: string): string {
    console.log("Extracting Mermaid diagram from text length:", text?.length || 0);
    
    // Look for Mermaid diagram enclosed in ```mermaid and ``` tags
    // More flexible regex to handle various code block formats
    const mermaidRegex = /```(?:mermaid|Mermaid|MERMAID)\s*([\s\S]*?)```/i;
    const match = text.match(mermaidRegex);
    
    console.log("Mermaid code block found:", !!match);
    
    if (match && match[1]) {
      console.log("Found diagram in code block, length:", match[1]?.length || 0);
      
      // Clean up the diagram definition
      let diagram = match[1].trim();
      
      // Process the diagram to fix common syntax issues
      diagram = this.processMermaidDiagram(diagram);
      
      console.log("Returning processed diagram from code block, length:", diagram.length);
      return diagram;
    }
    
    // Fallback: look for a section labeled as diagram or workflow
    console.log("No diagram found in code block, trying to extract from sections");
    
    const diagramSection = this.extractSection(text, "diagram") || 
                          this.extractSection(text, "workflow diagram") || 
                          this.extractSection(text, "architecture diagram") ||
                          this.extractSection(text, "mermaid diagram") ||
                          this.extractSection(text, "repository structure");
    
    console.log("Diagram section found:", !!diagramSection);
    console.log("Diagram section length:", diagramSection?.length || 0);
    
    if (diagramSection) {
      // Clean up the diagram text
      let diagram = diagramSection.trim();
      
      // Process the diagram to fix common syntax issues
      diagram = this.processMermaidDiagram(diagram);
      
      // If it includes graph syntax, it's likely a mermaid diagram
      if (diagram.includes("graph") || 
          diagram.includes("flowchart") ||
          diagram.includes("->") || 
          diagram.includes("-->")) {
        console.log("Found diagram syntax in section, returning diagram with length:", diagram.length);
        return diagram;
      } else {
        console.log("No diagram syntax found in section");
      }
    }
    
    // Try to extract any diagram-like structure from the text
    const extractedDiagram = this.extractDiagramFromText(text);
    if (extractedDiagram) {
      console.log("Extracted diagram-like structure from text, length:", extractedDiagram.length);
      return extractedDiagram;
    }
    
    // If we get here, no diagram was found
    console.log("No diagram found, returning default diagram");
    
    // Create a simple default diagram if nothing was found
    return `graph TD\n    A[Repository] --> B[Components]\n    B --> C[Features]`;
  }
  
  /**
   * Process a Mermaid diagram to fix common syntax issues
   */
  private processMermaidDiagram(diagram: string): string {
    // Normalize newlines and clean up escaped newlines
    let processed = diagram.replace(/\\n/g, '\n');
    
    // Normalize line endings
    processed = processed.replace(/\r\n/g, '\n');
    
    // Remove any duplicate graph/flowchart declarations
    processed = processed.replace(/(?:graph|flowchart)\s+(?:TD|LR|RL|BT)\s*\n\s*(?:graph|flowchart)\s+(?:TD|LR|RL|BT)/g, (match) => {
      // Keep only the first declaration
      const firstDeclaration = match.split('\n')[0];
      return firstDeclaration;
    });
    
    // Fix common syntax errors in arrows
    processed = processed.replace(/--[^>]>/g, "-->");
    processed = processed.replace(/==[^>]>/g, "==>");
    
    // Fix mismatched brackets
    processed = this.fixMismatchedBrackets(processed);
    
    // Ensure the diagram has a proper type declaration at the beginning
    if (!processed.startsWith('graph') && 
        !processed.startsWith('flowchart') && 
        !processed.startsWith('sequenceDiagram') && 
        !processed.startsWith('classDiagram') && 
        !processed.startsWith('stateDiagram') &&
        !processed.startsWith('erDiagram') &&
        !processed.startsWith('gantt') &&
        !processed.startsWith('pie') &&
        !processed.startsWith('journey')) {
      console.log("Adding graph TD to diagram");
      processed = `graph TD\n${processed}`;
    }
    
    return processed;
  }
  
  /**
   * Fix mismatched brackets in a Mermaid diagram
   */
  private fixMismatchedBrackets(text: string): string {
    const bracketPairs: Record<string, string> = {
      "(": ")",
      "[": "]",
      "{": "}",
      "<": ">"
    };
    
    const lines = text.split("\n");
    
    // Process each line to fix brackets within the line
    return lines.map(line => {
      // Skip comment lines and diagram declarations
      if (line.trim().startsWith("%") || 
          line.trim().startsWith("graph") ||
          line.trim().startsWith("flowchart")) {
        return line;
      }
      
      // Count brackets in the line
      const openBrackets: Record<string, number> = { "(": 0, "[": 0, "{": 0, "<": 0 };
      const closeBrackets: Record<string, number> = { ")": 0, "]": 0, "}": 0, ">": 0 };
      
      for (const char of line) {
        if (Object.keys(openBrackets).includes(char)) {
          openBrackets[char]++;
        } else if (Object.keys(closeBrackets).includes(char)) {
          closeBrackets[char]++;
        }
      }
      
      // Fix mismatched brackets in the line
      let fixedLine = line;
      
      // Add missing closing brackets
      for (const [open, close] of Object.entries(bracketPairs)) {
        const missingCount = openBrackets[open] - closeBrackets[close];
        if (missingCount > 0) {
          fixedLine += close.repeat(missingCount);
        }
      }
      
      return fixedLine;
    }).join("\n");
  }
  
  /**
   * Attempt to extract a diagram-like structure from text
   */
  private extractDiagramFromText(text: string): string | null {
    // Look for patterns that might indicate a diagram structure
    const nodePattern = /([A-Za-z0-9_-]+)(?:\[|\(\(|\(|>|\{)/;
    const connectionPattern = /([A-Za-z0-9_-]+)\s*(?:-->|-->|==>|-.->|--o|--x|\|>|<\||~~~|---|===)\s*([A-Za-z0-9_-]+)/g;
    
    const lines = text.split("\n");
    const nodes = new Set<string>();
    const connections: { from: string; to: string }[] = [];
    
    // Extract potential nodes and connections
    lines.forEach((line) => {
      // Skip very long lines or lines that are clearly not diagram syntax
      if (line.length > 100 || line.includes(".") || line.includes(";")) return;
      
      // Extract node IDs
      const nodeMatch = line.match(nodePattern);
      if (nodeMatch) {
        const nodeId = nodeMatch[1].trim();
        if (nodeId && !nodeId.includes(" ") && nodeId.length > 0) {
          nodes.add(nodeId);
        }
      }
      
      // Extract connections
      let connectionMatch;
      while ((connectionMatch = connectionPattern.exec(line)) !== null) {
        const from = connectionMatch[1].trim();
        const to = connectionMatch[2].trim();
        
        if (from && to && from.length > 0 && to.length > 0) {
          connections.push({ from, to });
          nodes.add(from);
          nodes.add(to);
        }
      }
    });
    
    // If we found enough nodes and connections, create a diagram
    if (nodes.size > 0 || connections.length > 0) {
      let diagram = "graph TD\n";
      
      // Add node definitions
      nodes.forEach((node) => {
        diagram += `    ${node}[${node}]\n`;
      });
      
      // Add connections
      connections.forEach((conn) => {
        diagram += `    ${conn.from} --> ${conn.to}\n`;
      });
      
      return diagram;
    }
    
    return null;
  }

  /**
   * Handles chat messages about the repository
   */
  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      // Make sure we have at least one user message
      if (messages.length === 0 || messages.every(msg => msg.role !== "user")) {
        throw new Error("At least one user message is required");
      }

      // Use the MCP server to enhance messages with repository context if available
      let chatHistory: ChatMessage[];
      
      if (mcpServer.hasContext()) {
        console.log("Using MCP server context for chat");
        // Make a deep copy of messages to avoid modifying the original array
        const messagesCopy = JSON.parse(JSON.stringify(messages)) as ChatMessage[];
        
        // Ensure we're passing fresh messages to the MCP server to enhance
        chatHistory = mcpServer.enhanceMessages(messagesCopy);
        
        // Log the enhanced messages for debugging
        console.log(`Enhanced messages with repository context. First system message: ${chatHistory[0]?.content?.substring(0, 100)}...`);
        console.log(`Total messages after enhancement: ${chatHistory.length}`);
      } else if (this.repoContext) {
        // Fall back to the old method if MCP server doesn't have context
        console.log("Using legacy context method for chat");
        chatHistory = [...messages];
        
        // Create a special system message with repository context
        const systemMessage: ChatMessage = {
          role: "assistant",
          content: `I am an AI assistant that has analyzed the following repository:\n\n${this.repoContext}\n\nI will answer questions about this specific repository based on my analysis.`
        };
        
        // Add the system message at the beginning if it's not already there
        if (chatHistory.length === 0 || 
            chatHistory[0].role !== "assistant" || 
            !chatHistory[0].content.includes("I am an AI assistant that has analyzed")) {
          chatHistory.unshift(systemMessage);
        }
        
        // Find the first user message
        const firstUserMessageIndex = chatHistory.findIndex(msg => msg.role === "user");
        
        // Enhance the first user message with a reminder about the context
        if (firstUserMessageIndex >= 0) {
          chatHistory[firstUserMessageIndex] = {
            ...chatHistory[firstUserMessageIndex],
            content: `Question about the analyzed repository: ${chatHistory[firstUserMessageIndex].content}`,
          };
        }
      } else {
        console.log("No repository context available for chat");
        chatHistory = [...messages];
      }
      
      // Convert to Gemini chat format - Gemini uses 'user' and 'model' roles
      const geminiMessages = chatHistory.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));
      
      console.log(`Total Gemini messages: ${geminiMessages.length}`);
      
      // For Gemini API, we need a different approach to handle system messages
      console.log(`Total messages: ${geminiMessages.length}`);
      
      // Check if we have a system message (first message is model)
      let systemContent = "";
      if (geminiMessages.length > 0 && geminiMessages[0].role === "model") {
        // Extract the system content but don't use it as systemInstruction
        // We'll prepend it to the user's message instead
        systemContent = geminiMessages[0].parts[0].text;
        console.log(`Found system message (${systemContent.length} chars)`);  
        
        // Remove the system message from history - Gemini requires the first message to be from the user
        geminiMessages.shift();
      }
      
      // Ensure the history starts with a user message for Gemini API requirements
      if (geminiMessages.length > 0 && geminiMessages[0].role === "model") {
        // If the first message is still a model message, we need to remove it or convert it
        // For safety, we'll just remove all model messages until we find a user message
        while (geminiMessages.length > 0 && geminiMessages[0].role === "model") {
          geminiMessages.shift();
        }
      }
      
      // Ensure we have at least one user message
      if (!geminiMessages.some(msg => msg.role === "user")) {
        throw new Error("No user messages found");
      }
      
      // Find the last user message
      const lastUserIndex = geminiMessages
        .map((msg, i) => msg.role === "user" ? i : -1)
        .filter(i => i !== -1)
        .pop();
      
      if (lastUserIndex === undefined) {
        throw new Error("No user messages found");
      }
      
      // Get history (all messages before the last user message)
      const historyMessages = geminiMessages.slice(0, lastUserIndex);
      
      // Get the message to send (the last user message)
      let messageToSend = geminiMessages[lastUserIndex].parts[0].text;
      
      // If we have system content, incorporate it into the user's message in a way that
      // doesn't interfere with the actual query but provides context
      if (systemContent && systemContent.length > 0) {
        // Create a condensed version of the system content to avoid token limits
        const maxSystemContentLength = 1500; // Limit system content to avoid token limits
        let condensedSystemContent = systemContent;
        if (systemContent.length > maxSystemContentLength) {
          // Extract key sections if it's too long
          condensedSystemContent = systemContent.substring(0, maxSystemContentLength) + "...";
        }
        
        // Add the system content as context before the user's message
        messageToSend = `I'm asking about this repository with the following context:\n\n${condensedSystemContent}\n\nMy question is: ${messageToSend}`;
      }
      
      // Log what we're sending to help with debugging
      console.log(`Sending message to Gemini: ${messageToSend.substring(0, 100)}...`);
      console.log(`With ${historyMessages.length} history messages`);
      
      // For Gemini 1.5, we need to include important context directly in the message
      // Let's check if we have a repository context from MCP server
      let contextEnhancedMessage = messageToSend;
      
      if (mcpServer.hasContext()) {
        const context = mcpServer.getContext();
        if (context) {
          // Add a brief context reminder to the message itself
          contextEnhancedMessage = `I'm asking about the repository ${context.repositoryName}. ${messageToSend}`;
          console.log(`Enhanced message with repository context: ${context.repositoryName}`);
        }
      }
      
      // Start chat with history
      const chat = this.model.startChat({
        history: historyMessages,
      });
      
      console.log("Started chat with Gemini model");
      
      // Send the enhanced message and get response
      const result = await chat.sendMessage(contextEnhancedMessage);
      console.log("Received response from Gemini");
      
      return result.response.text();
    } catch (error) {
      console.error("Error in chat:", error);
      return "I'm sorry, I encountered an error while processing your question. Please try again.";
    }
  }
}
