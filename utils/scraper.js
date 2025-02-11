const axios = require('axios');
const cheerio = require('cheerio');
const bambisleepChalk = require('../models/bambisleepChalk');

async function scraper(url) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    const content = $('body').text();

    if (content.includes('bambisleep')) {
      console.log(bambisleepChalk.success(`Bambisleep content found on ${url}`));
      return true;
    } else {
      console.log(bambisleepChalk.error(`No Bambisleep content found on ${url}`));
      return false;
    }
  } catch (error) {
    console.error(bambisleepChalk.error(`Error scraping ${url}: ${error.message}`));
    return false;
  }
}

function scrapeWebsite(url) {
  return scraper(url);
}

module.exports = { scrapeWebsite };