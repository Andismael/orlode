/**
 * Setup Agent — BYOE Provisioning
 *
 * Guides the client through a 10-step process to configure their own
 * Firebase project, API keys, and Orlode environment.
 *
 * Pattern: agentic loop (LLM decides which tools to call next)
 * Security: API keys are encrypted before storage, never logged
 */
import { z } from 'zod';
import { ai, GEMINI_PRO } from '../../config/genkit.config';
import { firebaseValidatorTool } from './tools/firebaseValidatorTool';
import { apiKeyTesterTool } from './tools/apiKeyTesterTool';
import { firestoreSchemaDeployTool } from './tools/firestoreSchemaDeployTool';
import { connectionTesterTool } from './tools/connectionTesterTool';
import { progressTrackerTool } from './tools/progressTrackerTool';
import { tenantManager } from '../../config/tenantManager';
import { getFirestore } from '../../config/firebase.config';
import { logger } from '../../utils/logger';

const INPUT = z.object({
  companyId: z.string(),
  message: z.string().describe('Current message or action from the setup wizard'),
  step: z.number().min(0).max(10).describe('Current wizard step (0-10)'),
  context: z.record(z.unknown()).optional().describe('Accumulated setup context'),
});

const OUTPUT = z.object({
  response: z.string().describe('Agent reply to show in the wizard'),
  nextStep: z.number().optional().describe('Suggested next step number'),
  requiresUserAction: z.boolean().describe('True if user must take an action before proceeding'),
  actionUrl: z.string().optional().describe('URL for the user action if applicable'),
  testResult: z.record(z.unknown()).optional().describe('Test result data to display'),
  completed: z.boolean().describe('True if setup is fully complete'),
  error: z.string().optional(),
});

const SETUP_TOOLS = [
  firebaseValidatorTool,
  apiKeyTesterTool,
  firestoreSchemaDeployTool,
  connectionTesterTool,
  progressTrackerTool,
];

const SYSTEM_PROMPT = `You are the Orlode Setup Agent — a friendly, patient provisioning assistant.

YOUR ROLE: Guide the client through a 10-step BYOE (Bring Your Own Everything) setup.
The client is NOT a developer. Be clear, visual, step-by-step. Celebrate each completed step.

NEVER:
- Ask for API keys you don't need to test
- Store keys without testing them first
- Skip validation steps
- Use jargon without explaining it

ALWAYS:
- Confirm what you just did
- Tell the user EXACTLY what to click
- Offer a video tutorial link if they're stuck
- Celebrate with "✅ Step X complete!" when a step passes

SETUP STEPS:
0. Welcome — explain BYOE, benefits, 15-minute estimate
1. Firebase Project — guide to create project at console.firebase.google.com
2. Enable Services — Firestore, Storage, Auth, Blaze plan
3. Service Account — download JSON key
4. API Keys — Gemini (required), Claude (recommended), OpenAI (optional)
5. Validate Firebase — run firebase_validator tool
6. Deploy Schema — run firestore_schema_deploy tool
7. Test Connections — run test_all_connections tool
8. Summary — show full config summary
9. Launch — mark setup complete, redirect to dashboard

SECURITY REMINDERS you MUST say:
- "Your API keys will be encrypted before storage — we never see them in plaintext"
- "Your data stays 100% in YOUR Firebase project"
`;

export const setupAgentFlow = ai.defineFlow(
  { name: 'setupAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ companyId, message, step, context }): Promise<z.infer<typeof OUTPUT>> => {
    logger.info(`[SetupAgent] step=${step} companyId=${companyId} msg="${message.slice(0, 60)}"`);

    // ── Step-specific handling ─────────────────────────────────
    // Step 5: Validate Firebase
    if (step === 5 && context?.['serviceAccountKey'] && context?.['firebaseProjectId']) {
      const validationResult = await firebaseValidatorTool({
        projectId: context['firebaseProjectId'] as string,
        serviceAccountKey: context['serviceAccountKey'] as string,
      });

      if (!validationResult.success) {
        return {
          response: `❌ Firebase validation failed.\n\n${validationResult.error}\n\n💡 ${validationResult.suggestion ?? ''}`,
          requiresUserAction: true,
          completed: false,
          testResult: validationResult,
        };
      }

      await progressTrackerTool({ companyId, step: 5, stepData: context });
      return {
        response: `✅ Step 5 complete! Firebase project validated.\n\n${JSON.stringify(validationResult.checks, null, 2)}\n\nAll Firebase services are accessible. Ready to deploy the Orlode schema!`,
        nextStep: 6,
        requiresUserAction: false,
        completed: false,
        testResult: validationResult,
      };
    }

    // Step 6: Deploy Firestore schema
    if (step === 6 && context?.['serviceAccountKey'] && context?.['firebaseProjectId']) {
      const deployResult = await firestoreSchemaDeployTool({
        projectId: context['firebaseProjectId'] as string,
        serviceAccountKey: context['serviceAccountKey'] as string,
        companyName: (context['companyName'] as string | undefined) ?? 'My Company',
        companyId,
        adminEmail: (context['adminEmail'] as string | undefined) ?? '',
        plan: (context['plan'] as 'trial' | 'starter' | 'business' | 'enterprise' | undefined) ?? 'business',
      });

      if (!deployResult.success) {
        return {
          response: `❌ Schema deployment failed.\n\nErrors: ${deployResult.errors.join(', ')}`,
          requiresUserAction: false,
          completed: false,
          testResult: deployResult,
        };
      }

      await progressTrackerTool({ companyId, step: 6 });
      return {
        response: `✅ Step 6 complete! ${deployResult.collectionsCreated.length} collections created in your Firebase.\n\nOrlode schema is deployed. Now let's test all connections!`,
        nextStep: 7,
        requiresUserAction: false,
        completed: false,
        testResult: deployResult,
      };
    }

    // Step 7: Test all connections
    if (step === 7 && context?.['serviceAccountKey'] && context?.['geminiApiKey']) {
      const testResult = await connectionTesterTool({
        firebaseProjectId: context['firebaseProjectId'] as string,
        serviceAccountKey: context['serviceAccountKey'] as string,
        geminiApiKey: context['geminiApiKey'] as string,
        claudeApiKey: context['claudeApiKey'] as string | undefined,
        openaiApiKey: context['openaiApiKey'] as string | undefined,
      });

      if (!testResult.ready) {
        return {
          response: `⚠️ ${testResult.score}\n\nSome services need attention:\n${
            testResult.firebase.firestore !== 'ok' ? `❌ Firestore: ${testResult.firebase.firestoreError}\n` : ''
          }${
            testResult.firebase.storage !== 'ok' ? `❌ Storage: ${testResult.firebase.storageError}\n` : ''
          }${
            testResult.ai.gemini !== 'ok' ? `❌ Gemini: ${testResult.ai.geminiError}\n` : ''
          }`,
          requiresUserAction: true,
          completed: false,
          testResult,
        };
      }

      // Save BYOE config (encrypted) to host Firestore
      await tenantManager.saveBYOEConfig(companyId, {
        firebaseProjectId: context['firebaseProjectId'] as string,
        serviceAccountKey: context['serviceAccountKey'] as string,
        storageBucket: `${context['firebaseProjectId']}.firebasestorage.app`,
        region: (context['region'] as string | undefined) ?? 'europe-west1',
        geminiApiKey: context['geminiApiKey'] as string,
        claudeApiKey: context['claudeApiKey'] as string | undefined,
        openaiApiKey: context['openaiApiKey'] as string | undefined,
      });

      await progressTrackerTool({ companyId, step: 8 });
      return {
        response: `🎉 ${testResult.score}\n\nAll systems are GO! Your BYOE configuration has been encrypted and saved securely.\n\nYour API keys are now stored in your own Firebase, encrypted with AES-256-GCM. We never see them in plaintext.`,
        nextStep: 8,
        requiresUserAction: false,
        completed: false,
        testResult,
      };
    }

    // Steps 8-9: Summary + finalize
    if (step === 9) {
      await progressTrackerTool({ companyId, step: 10, completed: true });

      // Update onboarding as complete
      const db = getFirestore();
      await db.collection('companies').doc(companyId).update({
        onboardingCompleted: true,
        setupCompleted: true,
        updatedAt: new Date(),
      });

      return {
        response: `🚀 Your Orlode is ready!\n\nConfiguration saved. You can now:\n• Upload your company documents\n• Start chatting with your AI agents\n• Invite your team\n\nWelcome to Orlode!`,
        requiresUserAction: false,
        completed: true,
      };
    }

    // ── Default: use LLM for conversational guidance ──────────────
    const { text } = await ai.generate({
      model: GEMINI_PRO,
      system: SYSTEM_PROMPT,
      prompt: `Company: ${companyId}
Current step: ${step}/10
User message: ${message}
Context: ${JSON.stringify(context ?? {})}

Guide the user to the next action. Be specific, friendly, and concise.
Return a short response (2-4 sentences max) with exactly what to do next.`,
      tools: SETUP_TOOLS,
      config: { temperature: 0.3 },
    });

    await progressTrackerTool({ companyId, step, stepData: context });

    return {
      response: text,
      requiresUserAction: true,
      completed: false,
    };
  }
);

// Expose as a tool for the orchestrator
export const setupAgentTool = ai.defineTool(
  {
    name: 'callSetupAgent',
    description: 'Run the BYOE Setup Agent to provision a new company environment. Use when a user needs help configuring Firebase, API keys, or initial setup.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
  },
  (input) => setupAgentFlow(input)
);
