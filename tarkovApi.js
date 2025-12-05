import fetch from 'node-fetch';

const TARKOV_API_URL = 'https://api.tarkov.dev/graphql';

/**
 * Query the Tarkov API for item information
 * @param {string} itemName - The name of the item to search for
 * @returns {Promise<Object>} Item data including prices, quests, and trader info
 */
export async function searchItem(itemName) {
  const query = `
    query SearchItem($name: String!) {
      items(name: $name, limit: 5) {
        id
        name
        shortName
        description
        basePrice
        avg24hPrice
        updated
        types
        wikiLink
        iconLink
        sellFor {
          vendor {
            name
          }
          price
          currency
          priceRUB
        }
        buyFor {
          vendor {
            name
          }
          price
          currency
          priceRUB
        }
        usedInTasks {
          id
          name
          trader {
            name
          }
          minPlayerLevel
        }
        receivedFromTasks {
          id
          name
          trader {
            name
          }
          minPlayerLevel
        }
        craftsFor {
          station {
            name
          }
          level
          duration
          requiredItems {
            item {
              name
            }
            count
          }
          rewardItems {
            item {
              name
            }
            count
          }
        }
        craftsUsing {
          station {
            name
          }
          level
          duration
          requiredItems {
            item {
              name
            }
            count
          }
          rewardItems {
            item {
              name
            }
            count
          }
        }
        bartersFor {
          trader {
            name
          }
          level
        }
      }
    }
  `;

  try {
    const response = await fetch(TARKOV_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { name: itemName },
      }),
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return null;
    }

    return data.data.items;
  } catch (error) {
    console.error('Error fetching from Tarkov API:', error);
    return null;
  }
}

/**
 * Format currency symbol
 * @param {string} currency - Currency code (RUB, USD, EUR)
 * @returns {string} Currency symbol
 */
export function getCurrencySymbol(currency) {
  const symbols = {
    'RUB': '₽',
    'USD': '$',
    'EUR': '€',
  };
  return symbols[currency] || currency;
}

/**
 * Format number with thousands separator
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(num) {
  return num?.toLocaleString('en-US') || '0';
}

/**
 * Search for quests by name
 * @param {string} questName - The name of the quest to search for
 * @returns {Promise<Object>} Quest data
 */
export async function searchQuest(questName) {
  const query = `
    query SearchQuests {
      tasks {
        id
        name
        trader {
          name
        }
        map {
          name
        }
        experience
        wikiLink
        minPlayerLevel
        taskRequirements {
          task {
            name
          }
          status
        }
        traderLevelRequirements {
          trader {
            name
          }
          level
        }
        objectives {
          id
          description
          optional
          type
        }
        startRewards {
          traderStanding {
            trader {
              name
            }
            standing
          }
        }
        finishRewards {
          offerUnlock {
            item {
              name
            }
            trader {
              name
            }
          }
          traderStanding {
            trader {
              name
            }
            standing
          }
          items {
            item {
              name
              shortName
            }
            count
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(TARKOV_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
      }),
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return null;
    }

    // Filter tasks by name (case-insensitive partial match)
    const allTasks = data.data.tasks;
    const searchLower = questName.toLowerCase();
    
    // First try exact substring match
    let matchingTasks = allTasks.filter(task => 
      task.name.toLowerCase().includes(searchLower)
    );

    // If no results, try matching all words individually
    if (matchingTasks.length === 0) {
      const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0);
      matchingTasks = allTasks.filter(task => {
        const taskNameLower = task.name.toLowerCase();
        return searchWords.every(word => taskNameLower.includes(word));
      });
    }

    console.log(`Searched for "${questName}", found ${matchingTasks.length} matches`);
    if (matchingTasks.length > 0) {
      console.log(`First match: ${matchingTasks[0].name}`);
    }

    return matchingTasks;
  } catch (error) {
    console.error('Error fetching from Tarkov API:', error);
    return null;
  }
}
