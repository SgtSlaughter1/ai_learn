# AI Service Integration Architecture

This document describes the decoupled integration model for AI services within the platform.

---

## Architecture Design Principles

1. **Replaceable Provider Abstraction**:
   * The core application logic does not bind to any specific LLM or provider SDK.
   * Laravel accesses AI capabilities through a backend service interface (`app/Services/AI/AIService.php`), allowing providers (Gemini, OpenAI, Anthropic, or local server instances) to be swapped with configuration changes.

2. **Backend Gateway Proxy**:
   * The React frontend does not make direct API calls to AI providers to protect secrets, keys, and control usage quotas.
   * All frontend AI queries are routed through Laravel, which proxies requests, appends template prompt contexts, and processes responses.

3. **Decoupled AI Pipeline**:
   * *Phase 1 (Initial)*: Standard cloud API integration (Gemini, OpenAI).
   * *Phase 2 (Potential dedicated Python microservice)*:
     
     ```text
     Laravel
        │
        ▼
     AI Gateway
        │
        ├── Cloud AI (Gemini / OpenAI API)
        │
        └── Python AI Service (Optional local microservice)
               │
               ├── RAG (Retrieval Augmented Generation)
               ├── local LLM running (Ollama/llama.cpp)
               └── Custom model execution pipelines
     ```

   * *Phase 3 (On-Device AI)*: Future local/offline AI capabilities executing directly in the client web browser (e.g. WebGPU-based model runtime, Chrome's built-in gemini-nano via Window AI API) when the learner is fully disconnected.
