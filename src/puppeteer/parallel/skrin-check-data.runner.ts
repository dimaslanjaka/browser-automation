import { parallelSkrinCheck } from './skrin-check-data.js';

parallelSkrinCheck()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    // Do not close the browser here to allow inspection of the final state.
    // If you want to close it, you can uncomment the following lines:
    // endpointManager.releaseEndpointClaim(claimedEndpoint!, process.pid);
    process.exit(0);
  });
