import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let client = null;

/**
 * Initialize the Gemini AI client
 * @returns {boolean} Success status
 */
export function initializeGemini() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('GEMINI_API_KEY not found in environment variables');
    return false;
  }

  try {
    client = new GoogleGenAI({ apiKey: apiKey });
    console.log('Gemini AI initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Gemini AI:', error);
    return false;
  }
}

/**
 * Check if this is a gunsmith quest
 * @param {Object} quest - Quest data
 * @returns {boolean} True if gunsmith quest
 */
function isGunsuitQuest(quest) {
  return quest.name.toLowerCase().includes('gunsmith');
}

/**
 * Format quest requirements for the prompt
 * @param {Object} quest - Quest data
 * @returns {string} Formatted requirements
 */
function formatRequirements(quest) {
  const reqs = [];

  if (quest.minPlayerLevel) {
    reqs.push(`Player Level ${quest.minPlayerLevel}`);
  }

  if (quest.taskRequirements && quest.taskRequirements.length > 0) {
    const taskReqs = quest.taskRequirements
      .map(req => `${req.task.name}`)
      .join(', ');
    reqs.push(`Previous quests: ${taskReqs}`);
  }

  if (quest.traderLevelRequirements && quest.traderLevelRequirements.length > 0) {
    const traderReqs = quest.traderLevelRequirements
      .map(req => `${req.trader.name} Level ${req.level}`)
      .join(', ');
    reqs.push(`Trader levels: ${traderReqs}`);
  }

  return reqs.length > 0 ? reqs.join('\n') : 'None';
}

/**
 * Format quest rewards for the prompt
 * @param {Object} quest - Quest data
 * @returns {string} Formatted rewards
 */
function formatRewards(quest) {
  const rewards = [];

  if (quest.experience) {
    rewards.push(`${quest.experience.toLocaleString()} XP`);
  }

  if (quest.finishRewards) {
    if (quest.finishRewards.items && quest.finishRewards.items.length > 0) {
      const items = quest.finishRewards.items
        .slice(0, 5)
        .map(item => `${item.item.shortName} (x${item.count})`)
        .join(', ');
      rewards.push(`Items: ${items}`);
    }

    if (quest.finishRewards.traderStanding && quest.finishRewards.traderStanding.length > 0) {
      const standing = quest.finishRewards.traderStanding
        .map(s => `${s.trader.name} ${s.standing > 0 ? '+' : ''}${s.standing}`)
        .join(', ');
      rewards.push(`Reputation: ${standing}`);
    }

    if (quest.finishRewards.offerUnlock && quest.finishRewards.offerUnlock.length > 0) {
      const unlocks = quest.finishRewards.offerUnlock
        .slice(0, 3)
        .map(unlock => `${unlock.item.name}`)
        .join(', ');
      rewards.push(`Unlocks: ${unlocks}`);
    }
  }

  return rewards.length > 0 ? rewards.join('\n') : 'None';
}

/**
 * Build the LLM prompt for quest guide generation
 * @param {Object} quest - Quest data
 * @returns {string} Formatted prompt
 */
function buildQuestPrompt(quest) {
  let prompt = `You are an expert Escape from Tarkov guide writer. Create a concise, step-by-step quest guide for players.

Quest: ${quest.name}
Trader: ${quest.trader.name}
Map: ${quest.map?.name || 'Multiple/Various'}
Min Level: ${quest.minPlayerLevel}

Requirements:
${formatRequirements(quest)}

Objectives:
${quest.objectives.map((obj, idx) => `${idx + 1}. ${obj.description}${obj.optional ? ' (Optional)' : ''}`).join('\n')}

Rewards:
${formatRewards(quest)}
`;

  // Special handling for gunsmith quests
  if (isGunsuitQuest(quest)) {
    prompt += `\n\nIMPORTANT: This is a GUNSMITH quest. Please provide:
1. List ALL required attachments with exact names
2. Weapon build order (which parts to install first to avoid incompatibilities)
3. Note common mistakes (wrong variants, incompatible parts)
4. Suggest where to buy or find each attachment (traders vs flea market)
`;
  }

  prompt += `\n\nPlease provide:

1. **Brief Overview** (2-3 sentences summarizing what this quest involves)

2. **Step-by-Step Guide** for each objective:
   - Specific location details and landmarks
   - Recommended approach and tactics
   - Tips for survival and efficiency
   - Common mistakes to avoid
   - Recommended gear/loadout if relevant
   - For each step where an IMAGE would be helpful (map location, item picture, etc.), add [IMAGE: brief description]

3. **Priority Tips**:
   - What objectives to do first and why
   - Which objectives are optional and worth skipping
   - Best approach for new vs experienced players

Format your response in clean markdown. Be concise but informative. Focus on practical advice that helps players complete the quest efficiently.`;

  return prompt;
}

/**
 * Parse the LLM response into structured data
 * @param {string} text - LLM response text
 * @param {Object} quest - Original quest data
 * @returns {Object} Structured guide data
 */
function parseLLMResponse(text, quest) {
  // Split response into sections
  const sections = {
    overview: '',
    objectives: [],
    tips: '',
    raw: text
  };

  try {
    // Extract overview (first section before objectives)
    const overviewMatch = text.match(/(?:Brief Overview|Overview)[:\s]*\n([\s\S]*?)(?=\n##|\n\*\*Step-by-Step|\nObjective)/i);
    if (overviewMatch) {
      sections.overview = overviewMatch[1].trim();
    }

    // Extract tips section
    const tipsMatch = text.match(/(?:Priority Tips|Tips)[:\s]*\n([\s\S]*?)$/i);
    if (tipsMatch) {
      sections.tips = tipsMatch[1].trim();
    }

    // Extract individual objective guides
    // Try to match numbered objectives or look for objective-specific content
    quest.objectives.forEach((obj, idx) => {
      const objectiveNum = idx + 1;
      // Try to find content for this specific objective
      const patterns = [
        new RegExp(`(?:Objective ${objectiveNum}|${objectiveNum}\\.)([\\s\\S]*?)(?=\\n(?:Objective ${objectiveNum + 1}|${objectiveNum + 1}\\.)|\\n##|Priority Tips|$)`, 'i'),
        new RegExp(`${obj.description.substring(0, 30)}[\\s\\S]{0,500}`, 'i')
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          sections.objectives[idx] = match[1] ? match[1].trim() : match[0].trim();
          break;
        }
      }

      // Fallback: if no specific guide found, use empty string
      if (!sections.objectives[idx]) {
        sections.objectives[idx] = '';
      }
    });

    // If no objectives were parsed, split the main guide section evenly
    if (sections.objectives.every(obj => obj === '')) {
      const guideSectionMatch = text.match(/Step-by-Step Guide[:\s]*\n([\s\S]*?)(?=\n##|Priority Tips|$)/i);
      if (guideSectionMatch) {
        const guideText = guideSectionMatch[1].trim();
        // Split by double newlines or numbered patterns
        const parts = guideText.split(/\n\n+|\n(?=\d+\.)/);
        quest.objectives.forEach((obj, idx) => {
          sections.objectives[idx] = parts[idx] || guideText;
        });
      }
    }
  } catch (error) {
    console.error('Error parsing LLM response:', error);
    // Fallback: use raw text for all objectives
    quest.objectives.forEach((obj, idx) => {
      sections.objectives[idx] = text;
    });
  }

  return sections;
}

/**
 * Generate an AI-powered quest guide using Gemini
 * @param {Object} quest - Quest data from Tarkov API
 * @returns {Promise<Object|null>} Generated guide or null on failure
 */
export async function generateQuestGuide(quest) {
  // Initialize if not already done
  if (!client) {
    const initialized = initializeGemini();
    if (!initialized) {
      console.error('Cannot generate quest guide: Gemini not initialized');
      return null;
    }
  }

  try {
    const prompt = buildQuestPrompt(quest);

    console.log(`Generating quest guide for "${quest.name}"...`);

    // Generate content with retry logic
    let result = null;
    let attempts = 0;
    const maxAttempts = 2;

    while (!result && attempts < maxAttempts) {
      attempts++;
      try {
        // Use the official API pattern
        // Using gemini-2.5-flash (latest model with billing enabled)
        result = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
      } catch (error) {
        console.error(`Attempt ${attempts} failed:`, error.message);
        if (attempts < maxAttempts) {
          // Wait 1 second before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!result) {
      throw new Error('Failed after maximum retry attempts');
    }

    const text = result.text || '';

    console.log(`Generated guide for "${quest.name}" (${text.length} characters)`);

    // Parse the response into structured data
    const guide = parseLLMResponse(text, quest);

    return guide;
  } catch (error) {
    console.error('Error generating quest guide:', error);
    return null; // Return null to trigger fallback to regular quest display
  }
}
