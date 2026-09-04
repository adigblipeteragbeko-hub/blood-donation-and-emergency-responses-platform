# BloodSOS Progressive Web App

## What Changed

The existing Vite React web application is now configured as a Progressive Web App (PWA). Supported browsers can install BloodSOS directly from the public website and launch it in a standalone app-like window.

The PWA is the same role-based web application. It does not replace the backend, database, authentication system, Socket.io realtime channel, notification system, or the existing Expo React Native donor app.

## Supported Roles

- `DONOR`
- `HOSPITAL_ADMIN`
- `ADMIN`

The manifest does not store a role. Role-based routing still comes from the authenticated backend session and the existing React protected routes.

## Installation

Android Chrome and compatible browsers:

1. Open the BloodSOS public website.
2. Use the browser install action or the BloodSOS install prompt when it appears.
3. Launch BloodSOS from the home-screen icon.

iPhone Safari:

1. Open the BloodSOS public website.
2. Tap Share.
3. Tap Add to Home Screen.

Browser support varies. The normal website remains fully usable without installing the PWA.

## Offline Limitations

BloodSOS is an emergency healthcare coordination system, so live operational data is intentionally not treated as offline-safe. The PWA caches the application shell, compiled static assets, icons, and safe public assets. It does not cache sensitive authenticated API data.

When offline, users see:

"You are currently offline. Live blood availability, emergency requests, appointments, notifications and real-time services require an internet connection."

## Security And Caching

Sensitive and transactional routes remain network-only, including:

- `/auth`
- `/inventory`
- `/blood-requests`
- `/appointments`
- `/notifications`
- `/donors`
- `/hospitals`
- `/donor-clinical-records`
- `/reports`
- `/sms`
- `/users`
- `/admin-dashboard`

The service worker must not cache JWTs, passwords, donor health submissions, emergency requests, inventory writes, transfer records, reports, private donor data, or administrative records.

## Updates

The PWA uses a prompted update flow. When a newer frontend build is available, the app shows a subtle message:

"A new version of BloodSOS is available."

Users can choose Update without refresh loops.

## Realtime And Notifications

Socket.io remains the realtime layer. In-app notifications, SMS workflows, notification badges, donor responses, inventory events, hospital transfer events, and emergency request updates continue to use the existing backend infrastructure.

Web Push is not implemented in this phase. It remains a future enhancement because the current in-app notification, SMS, and Socket.io system already covers the defense-ready workflow.

## HTTPS Requirement

Production PWA installation and service workers require HTTPS. Localhost is the browser-supported exception for development.

## Relationship To Expo Mobile App

The project now supports:

1. Standard responsive web application
2. Installable PWA
3. Existing Expo React Native donor mobile app

The Expo app remains in the `mobile` workspace and is not replaced by the PWA.

## Dissertation-Ready Paragraph

The web application was enhanced as a Progressive Web Application (PWA), allowing supported users to install the platform directly from a web browser and access it through a standalone, app-like interface. The PWA preserves the role-based functionality of the existing system, enabling donors and hospital administrators to securely access their respective services from mobile devices while maintaining the same backend, database, authentication and real-time communication infrastructure.
