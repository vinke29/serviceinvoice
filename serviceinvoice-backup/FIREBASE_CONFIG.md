# Firebase Configuration Setup

This document explains how to set up the required Firebase configuration for the email functionality.

## SendGrid API Key Setup

The email functionality requires setting up a SendGrid API key in Firebase Functions configuration. Follow these steps:

1. Create a SendGrid account and obtain an API key
2. Run the following command to set the API key in Firebase:

```
firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY"
```

3. To use the configuration locally, generate a local config file:

```
firebase functions:config:get > functions/.runtimeconfig.json
```

**Important**: Never commit the `.runtimeconfig.json` file to version control as it contains sensitive API keys.

## Email Verification

Make sure to verify your sender email address in SendGrid before using the email functionality. 