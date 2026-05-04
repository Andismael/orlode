"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyTesterTool = void 0;
/**
 * API Key Tester Tool
 * Tests AI API keys (Gemini, Claude, OpenAI) by making minimal test calls.
 * Keys are tested in-memory and never stored by this tool.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../../../config/genkit.config");
const INPUT = zod_1.z.object({
    provider: zod_1.z.enum(['gemini', 'claude', 'openai']),
    apiKey: zod_1.z.string().describe('The API key to test'),
});
const OUTPUT = zod_1.z.object({
    success: zod_1.z.boolean(),
    provider: zod_1.z.string(),
    modelsAvailable: zod_1.z.array(zod_1.z.string()).optional(),
    message: zod_1.z.string(),
    error: zod_1.z.string().optional(),
    suggestion: zod_1.z.string().optional(),
});
exports.apiKeyTesterTool = genkit_config_1.ai.defineTool({
    name: 'testApiKey',
    description: 'Test an AI API key (Gemini, Claude, or OpenAI) to verify it is valid and has correct permissions.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, async ({ provider, apiKey }) => {
    try {
        switch (provider) {
            case 'gemini': {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                const data = await response.json();
                if (data.models && data.models.length > 0) {
                    return {
                        success: true,
                        provider: 'Google AI (Gemini)',
                        modelsAvailable: data.models.slice(0, 5).map((m) => m.name),
                        message: `Gemini API key is valid! ${data.models.length} models available.`,
                    };
                }
                throw new Error(data.error?.message ?? 'No models returned — key may lack permissions');
            }
            case 'claude': {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'x-api-key': apiKey,
                        'content-type': 'application/json',
                        'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                        model: 'claude-haiku-4-5-20251001',
                        max_tokens: 5,
                        messages: [{ role: 'user', content: 'Hi' }],
                    }),
                });
                const data = await response.json();
                if (data.content) {
                    return {
                        success: true,
                        provider: 'Anthropic (Claude)',
                        message: 'Claude API key is valid! Connection established.',
                    };
                }
                throw new Error(data.error?.message ?? 'Invalid response');
            }
            case 'openai': {
                const response = await fetch('https://api.openai.com/v1/models', {
                    headers: { Authorization: `Bearer ${apiKey}` },
                });
                const data = await response.json();
                if (data.data && data.data.length > 0) {
                    return {
                        success: true,
                        provider: 'OpenAI',
                        modelsAvailable: data.data.slice(0, 5).map((m) => m.id),
                        message: 'OpenAI API key is valid!',
                    };
                }
                throw new Error(data.error?.message ?? 'Invalid response');
            }
        }
    }
    catch (err) {
        const message = String(err);
        return {
            success: false,
            provider,
            message: `${provider} API key test failed.`,
            error: message,
            suggestion: suggestFix(provider, message),
        };
    }
});
function suggestFix(provider, error) {
    if (error.includes('401') || error.includes('Unauthorized') || error.includes('invalid')) {
        return `Your ${provider} API key seems invalid. Check for typos or copy it again from the provider console.`;
    }
    if (error.includes('429') || error.includes('quota')) {
        return `Your ${provider} key hit a rate limit. Wait a minute and try again, or check your quota.`;
    }
    if (error.includes('403') || error.includes('permission')) {
        return `Your ${provider} key doesn't have the required permissions. Check that it's enabled and has no restrictions.`;
    }
    return `Check your ${provider} API key in their developer console.`;
}
//# sourceMappingURL=apiKeyTesterTool.js.map