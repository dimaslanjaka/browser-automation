import { authorize } from './googleClient.js';

async function main() {
  const auth = await authorize();
  console.log('Authenticated OAuth2 client:', auth);
}

main().catch((err) => {
  console.error('Error in main execution:', err);
  process.exit(1);
});
