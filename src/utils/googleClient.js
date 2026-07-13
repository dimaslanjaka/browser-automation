import { authenticate } from '@google-cloud/local-auth';
import fs from 'fs-extra';
import path from 'upath';
import { OAuth2Client } from 'google-auth-library';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const CREDENTIALS_PATH = path.resolve(process.cwd(), '.cache', 'credentials.json');
const TOKEN_PATH = path.resolve(process.cwd(), '.cache', 'token.json');

/**
 * Saves the OAuth2 credentials (access token, refresh token, etc.) to a local file.
 *
 * @param {import('google-auth-library').OAuth2Client} auth - The authenticated OAuth2 client.
 * @param {import('google-auth-library').Credentials} customCredentials - Custom credentials to save.
 */
function saveToken(auth, customCredentials = null) {
  try {
    const tokenDir = path.dirname(TOKEN_PATH);
    fs.ensureDirSync(tokenDir);
    fs.writeFileSync(
      TOKEN_PATH,
      JSON.stringify(customCredentials ? customCredentials : auth.credentials, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('Failed to save token:', err);
  }
}

/**
 * Loads an OAuth2Client using saved credentials and refresh tokens.
 *
 * @async
 * @returns {Promise<OAuth2Client|null>} An authenticated OAuth2Client instance with refreshed access token if needed, or null if no token exists.
 */
async function getClient() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.log('Credentials file does not exist');
    return null;
  }
  let credentials;
  try {
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  } catch (err) {
    console.error('Failed to parse credentials file:', err.message);
    return null;
  }
  const clientInfo = credentials.installed || credentials.web;
  if (!clientInfo) {
    console.log('Credentials file does not contain "installed" or "web" section.');
    return null;
  }
  const { client_id, client_secret, redirect_uris } = clientInfo;
  const redirectUri = redirect_uris && redirect_uris[0] ? redirect_uris[0] : 'http://localhost';
  const oAuth2Client = new OAuth2Client(client_id, client_secret, redirectUri);
  if (!fs.existsSync(TOKEN_PATH)) {
    console.log('Token file does not exist, will need fresh authentication');
    return null;
  }
  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oAuth2Client.setCredentials(token);
    const newToken = await oAuth2Client.getAccessToken();
    if (newToken?.token !== token.access_token) {
      saveToken(oAuth2Client);
      console.log('Updated access token saved to', TOKEN_PATH);
    }
    return oAuth2Client;
  } catch (err) {
    console.error('Error loading token:', err.message);
    return null;
  }
}

/**
 * Obtains an authenticated OAuth2 client, reusing or refreshing tokens if available.
 *
 * @returns {Promise<import('google-auth-library').OAuth2Client>}
 */
export async function authorize() {
  console.log('Authorizing with Google Sheets API...');
  let auth = await getClient();
  if (auth) {
    console.log('Using existing saved token.');
  } else {
    console.log('No valid saved token found. Performing fresh authentication...');
    let credentials;
    try {
      credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    } catch (err) {
      throw new Error(`Failed to read credentials file at ${CREDENTIALS_PATH}: ${err.message}`);
    }
    const clientInfo = credentials.installed || credentials.web;
    if (!clientInfo) {
      throw new Error('Credentials file does not contain "installed" or "web" section.');
    }
    // Inject localhost redirect URI for local auth flow
    const LOCAL_REDIRECT_URI = 'http://localhost:3000/oauth2callback';
    if (!clientInfo.redirect_uris || !Array.isArray(clientInfo.redirect_uris)) {
      clientInfo.redirect_uris = [];
    }
    if (!clientInfo.redirect_uris.includes(LOCAL_REDIRECT_URI)) {
      // Put localhost URI first so the library uses it
      clientInfo.redirect_uris = [LOCAL_REDIRECT_URI, ...clientInfo.redirect_uris];
    } else {
      // Move localhost URI to the front
      clientInfo.redirect_uris = [
        LOCAL_REDIRECT_URI,
        ...clientInfo.redirect_uris.filter((u) => u !== LOCAL_REDIRECT_URI)
      ];
    }
    // Write temp credentials file with localhost redirect URI
    const TEMP_CREDENTIALS_PATH = path.resolve(process.cwd(), '.cache', 'credentials.local.json');
    try {
      fs.writeFileSync(TEMP_CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), 'utf-8');
    } catch (err) {
      throw new Error(`Failed to write temp credentials file: ${err.message}`);
    }

    try {
      auth = await authenticate({
        keyfilePath: TEMP_CREDENTIALS_PATH,
        scopes: SCOPES
      });
      saveToken(auth);
      console.log('New token saved to', TOKEN_PATH);
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(TEMP_CREDENTIALS_PATH);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
  auth.on('tokens', (tokens) => {
    const combined = { ...auth.credentials, ...tokens };
    try {
      saveToken(auth, combined);
      console.log('Token updated and saved to', TOKEN_PATH);
    } catch (err) {
      console.error('Failed to write updated token:', err);
    }
  });
  const { expiry_date = false } = auth.credentials;
  const isExpired = !expiry_date || expiry_date <= Date.now();
  console.log(`Token expiry date: ${expiry_date ? new Date(expiry_date).toISOString() : 'N/A'}`);
  console.log(`Token is ${isExpired ? 'expired' : 'valid'}.`);
  if (isExpired) {
    try {
      console.log('Refreshing expired access token...');
      const newToken = await auth.refreshAccessToken();
      auth.setCredentials(newToken.credentials);
      saveToken(auth);
      console.log('Access token refreshed and saved.');
    } catch (err) {
      console.error('Failed to refresh access token:', err);
      throw err;
    }
  } else {
    console.log('Cached access token is still valid.');
  }
  return auth;
}
