
# KSHT Volunteer Log

This is a Next.js application built with Firebase Studio for tracking volunteer hours for organizations.

## Core Features

- User Authentication (Login/Signup)
- Organization creation and joining via invite links
- Role-based permissions (Owner vs. Member)
- Clock-in and Clock-out functionality
- Manual time entry for organization owners
- Daily time log table with the ability to view past dates
- Export daily logs to XLSX format

## Getting Started

To get started, make sure you have a `.env.local` file with your Firebase project credentials. Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The main application logic can be found in `src/app/page.tsx`.
