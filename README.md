# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Running Locally

You can download this project and run it on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/) (version 20 or later recommended)
- [npm](https://www.npmjs.com/) (or another package manager like yarn or pnpm)
- A Firebase project. If you don't have one, create one at [firebase.google.com](https://firebase.google.com/).

### 1. Install Dependencies

Once you have downloaded the code, navigate to the project directory in your terminal and install the required packages:

```bash
npm install
```

### 2. Set Up Environment Variables

This project uses both Genkit (for AI) and Firebase (for authentication and database).

1.  Create a new file named `.env.local` in the root of your project.
2.  Add your API keys and Firebase configuration to this file.

#### Gemini API Key
You can get a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

#### Firebase Configuration
You can find your Firebase project's configuration in the Firebase console:
Go to Project settings > General > Your apps > Web app > SDK setup and configuration. Select "Config".

Your `.env.local` file should look like this:

```
# Genkit/Gemini
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_FIREBASE_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_FIREBASE_AUTH_DOMAIN"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_FIREBASE_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_FIREBASE_STORAGE_BUCKET"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_FIREBASE_MESSAGING_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_FIREBASE_APP_ID"
```

### 3. Configure Firebase Authentication

In the Firebase console, go to the "Authentication" section and enable the "Email/Password" sign-in provider.

### 4. Run the Development Server

Now you can start the Next.js development server:

```bash
npm run dev
```

The application will be available at [http://localhost:9002](http://localhost:9002).

### 5. Run the Genkit Inspector (Optional)

To inspect and test your AI flows, you can run the Genkit inspector in a separate terminal:

```bash
npm run genkit:watch
```

This will start the inspector, which is typically available at [http://localhost:4000](http://localhost:4000).
