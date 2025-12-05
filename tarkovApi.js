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
          objectivesWithItem {
            description
            optional
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
