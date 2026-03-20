---
description: How to deploy the application to test and production servers
---

This workflow describes the steps to deploy the application sequentially to the test server and then to the production server.

## 1. Deploy to Test Server
First, deploy everything to the test server for verification.

// turbo
```powershell
firebase deploy -P test
```

## 2. Verify Changes on Test Server
Open the test server URL and verify that everything is working as expected.
- Check if meal data is being fetched correctly.
- Test admin functionality if applicable.

## 3. Deploy to Production Server
Once verified, deploy to the production server.

> [!IMPORTANT]
> Ensure that any environment-specific configurations (like `firebaseConfig` in `script.js`) are updated for production before running this step.

// turbo
```powershell
firebase deploy -P prod
```

## 4. Final Verification
Open the production server URL and perform a final check.
