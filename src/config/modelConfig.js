// filepath: lm-studio-project/src/config/modelConfig.js
const modelConfig = {
  models: [
    {
      id: 'llama-3.2-3b-claude-3.7-sonnet-reasoning-distilled@q4_0',
      description: 'Tool-enabled model for analyzing and processing BambiSleep information.',
      systemPrompt: `
        Analyze and process all information related to BambiSleep.
        Store it in a cache for the next model.
        Clean up the information about BambiSleep.
        Create structured outputs to generate JSON schemas for the next model.
        Leverage in-depth knowledge for optimal performance.
      `,
      parameters: {
        maxTokens: 180,
        temperature: 0.95,
        topP: 0.95,
        frequencyPenalty: 0,
        presencePenalty: 0,
        topK: 40,
      }
    },
    {
      id: 'another-model-id', // Placeholder for the second model
      description: 'Description for the second model.',
      systemPrompt: 'System prompt for the second model.',
      parameters: {
        maxTokens: 150,
        temperature: 0.85,
        topP: 0.9,
        frequencyPenalty: 0,
        presencePenalty: 0,
        topK: 30,
      }
    }
  ]
};

export default modelConfig;