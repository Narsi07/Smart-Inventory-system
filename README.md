# SMART_INVENTORY

A Next.js-based Smart Inventory Management System with AI-powered forecasting and analytics, built with Firebase and Gemini AI.

## Features

- AI-powered demand forecasting
- Inventory management and tracking
- Supplier management
- Purchase order automation
- Financial analytics
- Sales reporting
- Real-time inventory chatbot
- User and role management

## Tech Stack

- Next.js 14 with App Router
- Firebase (Authentication, Firestore)
- Gemini AI for intelligent features
- Tailwind CSS with Shadcn/UI
- TypeScript

## Setup and Installation

### Prerequisites

- Node.js (v20 or later)
- npm/yarn/pnpm
- Firebase project
- Gemini API key

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/Narsi07/SMART_INVENTORY.git
cd SMART_INVENTORY
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` with required keys:
```
# Gemini AI
GEMINI_API_KEY=your_key_here

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

4. Start the development server:
```bash
npm run dev
```

Visit http://localhost:9002 to see the application.
