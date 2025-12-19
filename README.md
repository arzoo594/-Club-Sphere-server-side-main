ClubSphere – Membership & Event Management Platform 
📌 ClubSphere

ClubSphere

🎯 Project Purpose

The backend of ClubSphere provides a secure, scalable REST API to support club discovery, memberships, event management, role-based dashboards, and Stripe payment processing.
It handles authentication verification, role-based authorization, database operations, and payment workflows.

This repository contains the server-side (backend) implementation of the ClubSphere project.

🌐 Live Server URL

🔗 Server Base URL: https://clubsphare.vercel.app/



🚀 Core Features
🔐 Authentication & Authorization

Firebase token verification middleware

JWT-based secure API access

Role-based authorization (Admin, Club Manager, Member)

Protected routes for dashboards and sensitive operations

👥 User Management

Store registered users in MongoDB

Default role: member

Admin can promote/demote users

Role validation for every protected endpoint

🏘 Club Management

Club creation by Club Managers

Admin approval/rejection system

Club status handling (pending / approved / rejected)

Search clubs by name

Filter clubs by category

Sort clubs by membership fee or creation date

🎟 Membership Management

Free and paid club memberships

Membership creation after successful payment

Track membership status (active, expired, pendingPayment)

Link memberships with Stripe payments

📅 Event Management

Event creation, update, and deletion by Club Managers

Free and paid events

Event registration system

Max attendee support

Event registration tracking

💳 Payment System

Stripe integration (Test Mode)

Membership payment handling

Event payment handling

Payment records stored in database

Revenue tracking for Admin and Club Managers

📊 Admin Monitoring

Total users, clubs, memberships, events

Payment history and revenue overview

Platform-wide statistics

Secure admin-only endpoints

🧩 Technologies Used
Backend Stack

Node.js

Express.js

MongoDB

Mongoose

Firebase Admin SDK

Stripe

JWT

CORS

dotenv

📦 Important NPM Packages
express
mongodb
mongoose
cors
dotenv
jsonwebtoken
firebase-admin
stripe

🗂 Database Design (Collections)
users
name
email
photoURL
role (admin | clubManager | member)
createdAt

clubs
clubName
description
category
location
bannerImage
membershipFee
status (pending | approved | rejected)
managerEmail
createdAt
updatedAt

memberships
userEmail
clubId
status (active | expired | pendingPayment)
paymentId
joinedAt
expiresAt

events
clubId
title
description
eventDate
location
isPaid
eventFee
maxAttendees
createdAt

eventRegistrations
eventId
userEmail
clubId
status (registered | cancelled)
paymentId
registeredAt

payments
userEmail
amount
type (membership | event)
clubId
eventId
transactionId
status
createdAt

🔐 Environment Variables

All sensitive credentials are secured using environment variables.

Create a .env file in the root directory and add:

PORT=5000
DB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

STRIPE_SECRET_KEY=your_stripe_secret_key

FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key


⚠️ Never push .env file to GitHub

📁 Project Structure (Server)
server/
│── index.js
│── config/
│── middleware/
│   ├── verifyToken.js
│   ├── verifyAdmin.js
│   ├── verifyManager.js
│── routes/
│   ├── users.routes.js
│   ├── clubs.routes.js
│   ├── memberships.routes.js
│   ├── events.routes.js
│   ├── payments.routes.js
│── controllers/
│── models/
│── utils/

🔒 API Security

Firebase token verification for all protected routes

Role-based middleware checks

Admin-only and Manager-only route protection

Stripe secret keys handled only on server

CORS configured for production domains

⚙️ Installation & Setup

Clone the repository

git clone https://github.com/your-username/clubsphere-server.git


Install dependencies

npm install


Run the server locally

npm run start

📈 Commit History Requirement

✅ Minimum 12 meaningful commits on the server side

Clear and descriptive commit messages used

🚀 Deployment Checklist

No CORS / 404 / 504 issues

API routes working correctly in production

Environment variables configured on server hosting

Firebase Admin SDK configured correctly

Stripe test mode enabled

Stable API response on reload and protected routes

🧪 Admin Test Account (For Evaluation)
Admin Email: admin@clubsphere.com
Admin Password: ********


(Provided as required for testing purposes)

🏁 Final Notes

The ClubSphere backend is designed to demonstrate:

Secure authentication and authorization

Real-world Stripe payment integration

Scalable MongoDB data modeling

Clean API architecture

Role-based access control

✨ Thank you for reviewing ClubSphere Backend!
If you find this project useful, feel free to ⭐ the repository.
