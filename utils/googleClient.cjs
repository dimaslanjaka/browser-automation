'use strict';

require('../chunk-4IBVXDKH.cjs');
var localAuth = require('@google-cloud/local-auth');
var fs = require('fs-extra');
var path = require('upath');
var googleAuthLibrary = require('google-auth-library');
var dotenv = require('dotenv');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);
var dotenv__default = /*#__PURE__*/_interopDefault(dotenv);

dotenv__default.default.config();
const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];
const CREDENTIALS_PATH = path__default.default.join(process.cwd(), ".cache", "credentials.json");
const TOKEN_PATH = path__default.default.join(process.cwd(), ".cache", "token.json");
function saveToken(auth, customCredentials = null) {
  try {
    const tokenDir = path__default.default.dirname(TOKEN_PATH);
    fs__default.default.ensureDirSync(tokenDir);
    fs__default.default.writeFileSync(
      TOKEN_PATH,
      JSON.stringify(customCredentials ? customCredentials : auth.credentials, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("Failed to save token:", err);
  }
}
async function getClient() {
  const credentials = JSON.parse(fs__default.default.readFileSync(CREDENTIALS_PATH, "utf-8"));
  const { client_id, client_secret, redirect_uris } = credentials.installed;
  const oAuth2Client = new googleAuthLibrary.OAuth2Client(client_id, client_secret, redirect_uris[0]);
  if (!fs__default.default.existsSync(TOKEN_PATH)) {
    console.log("Token file does not exist, will need fresh authentication");
    return null;
  }
  try {
    const token = JSON.parse(fs__default.default.readFileSync(TOKEN_PATH, "utf-8"));
    oAuth2Client.setCredentials(token);
    const newToken = await oAuth2Client.getAccessToken();
    if ((newToken == null ? void 0 : newToken.token) !== token.access_token) {
      saveToken(oAuth2Client);
      console.log("Updated access token saved to", TOKEN_PATH);
    }
    return oAuth2Client;
  } catch (err) {
    console.error("Error loading token:", err.message);
    return null;
  }
}
async function authorize() {
  console.log("Authorizing with Google Sheets API...");
  let auth = await getClient();
  if (auth) {
    console.log("Using existing saved token.");
  } else {
    console.log("No valid saved token found. Performing fresh authentication...");
    auth = await localAuth.authenticate({
      keyfilePath: CREDENTIALS_PATH,
      scopes: SCOPES
    });
    saveToken(auth);
    console.log("New token saved to", TOKEN_PATH);
  }
  auth.on("tokens", (tokens) => {
    const combined = { ...auth.credentials, ...tokens };
    try {
      saveToken(auth, combined);
      console.log("Token updated and saved to", TOKEN_PATH);
    } catch (err) {
      console.error("Failed to write updated token:", err);
    }
  });
  const { expiry_date = false } = auth.credentials;
  const isExpired = !expiry_date || expiry_date <= Date.now();
  console.log(`Token expiry date: ${expiry_date ? new Date(expiry_date).toISOString() : "N/A"}`);
  console.log(`Token is ${isExpired ? "expired" : "valid"}.`);
  if (isExpired) {
    try {
      console.log("Refreshing expired access token...");
      const newToken = await auth.refreshAccessToken();
      auth.setCredentials(newToken.credentials);
      saveToken(auth);
      console.log("Access token refreshed and saved.");
    } catch (err) {
      console.error("Failed to refresh access token:", err);
      throw err;
    }
  } else {
    console.log("Cached access token is still valid.");
  }
  return auth;
}

exports.authorize = authorize;
//# sourceMappingURL=googleClient.cjs.map
//# sourceMappingURL=googleClient.cjs.map