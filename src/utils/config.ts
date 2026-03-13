import fs from 'fs'
import path from 'path'

export interface AppConfig {
  apify_key: string;
  openai_key: string;
  anthropic_key: string;
  prospeo_key: string;
  personalization_prompt: string;
}

const configPath = path.join(process.cwd(), 'config.json')

export function getConfig(): AppConfig {
  const defaultPrompt = `System: You are a helpful, intelligent writing assistant.

User: Your task is to take, as input, a bunch of information about a prospect, and then generate a customized, one-line email icebreaker to imply that the rest of my communique is personalized.

You'll return your icebreakers in the following JSON format:

{"verdict":"true or false, string","icebreaker":"Hey {firstName}, Love {thing}—also work in {paraphrasedIndustry}. Wanted to run something by you.","shortenedCompanyName":"Shortened version of company name (more on this in a moment)"}

Rules:

- Write in a spartan/laconic tone of voice.

- Make sure to use the above format when constructing your icebreakers.

- Sometimes, the data provided will not be of a person. Instead, it will be of a company. If this is the case, return a "false" string for verdict.

- Shorten the company name wherever possible (say, “XYZ” instead of “XYZ Agency”. More examples: “Love AWS” instead of “Love AWS Professional Services”, “Love Mayo” instead of “Love Mayo Inc.” etc.)

- Do the same with locations. “San Fran” instead of “San Francisco”, “BC” instead of “British Columbia”, etc.

---

Input: {first name}, {last name}, {headline} {industry}, {organization_name}, {location}, {email} — these are your variables (pick whatever makes sense and insert them here).`;

  const defaultConfig: AppConfig = {
    apify_key: process.env.APIFY_API_KEY || '',
    openai_key: process.env.OPENAI_API_KEY || '',
    anthropic_key: process.env.ANTHROPIC_API_KEY || '',
    prospeo_key: process.env.PROSPEO_API_KEY || '',
    personalization_prompt: defaultPrompt,
  }

  try {
    if (fs.existsSync(configPath)) {
      const fileData = fs.readFileSync(configPath, 'utf8')
      const parsed = JSON.parse(fileData)
      return { ...defaultConfig, ...parsed }
    }
  } catch (err) {
    console.error('Error reading config.json', err)
  }
  
  return defaultConfig
}

export function saveLocalConfig(config: Partial<AppConfig>) {
  try {
    const current = getConfig()
    const updated = { ...current, ...config }
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8')
  } catch (err) {
    console.error('Error writing config.json', err)
    throw err
  }
}
