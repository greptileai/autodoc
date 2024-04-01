import dotenv from 'dotenv';
dotenv.config();

const env = (() => {
  const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || 'localhost';
  const GREPTILE_API_KEY = process.env.GREPTILE_API_KEY;
  const GREPTILE_API_URL = process.env.GREPTILE_API_URL;
  if (!GREPTILE_API_URL) {
    console.log('GREPTILE_API_URL must be defined');
    throw new Error('GREPTILE_API_URL and GREPTILE_CHAT_API_URL must be defined');
  }
  const GITHUB_APP_ID = parseInt(process.env.GITHUB_APP_ID || "0", 10)
  const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
    console.log('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be defined');
    throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be defined');
  }
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
  const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/webhook';
  if (!WEBHOOK_SECRET) {
    console.log('WEBHOOK_SECRET and PRIVATE_KEY must be defined');
    throw new Error('WEBHOOK_SECRET and PRIVATE_KEY must be defined');
  }
  const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME || 'users';
  const USERS_JSON_FILE = process.env.USERS_JSON_FILE || 'configDocs.json';

  // if (DEBUG_MODE) {
  //   console.log(
  //     'PORT:', PORT,
  //     'HOST:', HOST,
  //     'DEBUG_MODE:', DEBUG_MODE,
  //     'ACCESS_TOKEN:', ACCESS_TOKEN,
  //     'GREPTILE_API_URL:', GREPTILE_API_URL,
  //     'GREPTILE_CHAT_API_URL:', GREPTILE_CHAT_API_URL,
  //     'GITHUB_APP_ID:', GITHUB_APP_ID,
  //     'GITHUB_APP_PRIVATE_KEY:', GITHUB_APP_PRIVATE_KEY,
  //     'WEBHOOK_SECRET:', WEBHOOK_SECRET,
  //     'WEBHOOK_PATH:', WEBHOOK_PATH
  //   )
  // }

  return {
    PORT,
    HOST,
    DEBUG_MODE,
    GREPTILE_API_URL,
    GREPTILE_API_KEY,
    GITHUB_APP_PRIVATE_KEY,
    GITHUB_APP_ID,
    WEBHOOK_SECRET,
    WEBHOOK_PATH,
    USERS_JSON_FILE
  }
})()

export default env