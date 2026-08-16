# Piyu POS System

Offline-first point-of-sale and order management for a Windows laptop and Android phone. It stores text-only client, item, shipping, payment, request-date, and delivery-date details; synchronizes through Firebase Cloud Firestore; produces receipts; and exports business reports.

## Features

- Email/password admin login with `/users/{uid}` authorization and no public signup
- New-order form with structured, editable Order IDs, required primary mobile, optional WhatsApp number, multiple items, percentage item discounts, delivery fees, totals, paid amount, balance, and COD amount
- Request Date and Delivery Date on every order
- Realtime orders and customers on all signed-in devices
- Firestore persistent IndexedDB cache plus an app-owned IndexedDB snapshot mirror, offline writes, pending-sync indicators, and multi-tab support
- Four clear order states: Pending, Delivered, Canceled, and Returned (older status values are mapped safely)
- Append-only audit logs for order creation, editing, and status changes
- Customer directory and order history based on immutable customer snapshots in orders
- Dashboard, search/filterable orders, logs, reports, settings, CSV/JSON export, and client-side PDF report
- Customer details with priced items, delivery details, and full bill formats for 58 mm, 80 mm, or A4 printing
- WhatsApp invoice messages prefilled with the complete bill and customer/order details
- Administrator-only order deletion with a warning confirmation and retained audit log
- Installable responsive PWA with an application-shell service worker

## Technology

Next.js App Router, React, TypeScript, Tailwind CSS, Firebase Authentication/Firestore, React Hook Form, Zod, date-fns, Lucide, jsPDF, jspdf-autotable, and Vitest.

## 1. Local setup

Requirements: a current Node.js LTS release (Node 20+), npm, and a Firebase account.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The app cannot access business data until Firebase is configured and the first authorized user exists.

## 2. Create and link Firebase

1. Go to [Firebase Console](https://console.firebase.google.com), choose **Add project**, and create a project (Spark/free plan is sufficient for light usage within its quotas).
2. In **Project settings → General → Your apps**, choose the Web (`</>`) app, name it `Piyu POS`, and register it. Firebase displays a `firebaseConfig` object.
3. Copy those values to `.env.local`:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

These web identifiers are not secrets; the Firestore rules and Authentication control access. Do not put admin-service credentials in the browser.

## 3. Authentication setup

1. Firebase Console → **Authentication → Get started → Sign-in method**.
2. Enable **Email/Password**.
3. Open **Users → Add user** and create the administrator email/password. There is deliberately no public registration page.
4. Copy the new user's UID.
5. Open **Firestore Database → Data**, create collection `users`, and a document whose ID is that exact UID:

```json
{
  "name": "Administrator",
  "email": "admin@example.com",
  "role": "admin",
  "active": true
}
```

Valid roles are `admin` and `staff`. Set `active` to `false` to block access. The first login on a new device must be online; Firebase then persists the session for trusted offline reopening.

## 4. Firestore setup and security

1. Firebase Console → **Firestore Database → Create database**.
2. Select the region nearest your users. The region cannot later be changed easily.
3. Install the Firebase CLI and log in:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
```

The included `firestore.rules` requires an authenticated, active `/users/{uid}` profile. Only a user whose profile has `role: "admin"` can delete orders, customers, or logs; log updates remain prohibited. The Settings cleanup tools also require the administrator to re-enter the current Firebase login password. Deploy updated rules with `firebase deploy --only firestore:rules`. `firestore.indexes.json` contains indexes for status and order-log queries.

Collections are created as they are used: `users`, `customers`, `orders`, `orderLogs`, and `settings`.

## 5. Run and verify

```bash
npm run dev       # development server
npm test          # calculations, validation, order-code tests
npm run lint      # ESLint
npm run build     # production build
npm start         # serve the production build
```

## PWA installation

PWA installation requires HTTPS (localhost is accepted during development).

- Windows Chrome/Edge: open the deployed app, use the install icon in the address bar, or browser menu → **Apps → Install**.
- Android Chrome: browser menu → **Add to Home screen / Install app**.
- Load the main pages once while online before expecting them to reopen offline.

The service worker caches only same-origin application assets/navigation. Firestore API responses are intentionally excluded: Firebase's SDK owns its IndexedDB cache and pending-write synchronization.

## Offline and realtime test checklist

1. Sign in online and create an order.
2. Confirm it appears in Firestore Console.
3. Sign in from another browser/device and confirm the realtime update appears.
4. Install the PWA and visit Dashboard, Orders, New Order, Customers, Logs, Reports, and Settings once.
5. Turn the internet off, fully close the installed app, and reopen it.
6. Confirm previously loaded data is visible. Create an offline order and change an order status.
7. Confirm **Waiting to Sync** is visible. Offline operation is normal; do not clear site data.
8. Restore internet and confirm indicators change to **Synced** and the second device receives updates.
9. From an order, print Customer Details & Items, Delivery Details, and Full Bill.
10. Generate a monthly PDF and export CSV/JSON.

## Printing

Configure the default size under **Settings**. Open an order and choose Delivery Details, Customer Details & Items, Full Bill, or all three. Printing uses the normal browser/operating-system print dialog.

## Firestore connection troubleshooting

The app stores writes in Firestore's persistent IndexedDB data first and synchronizes them automatically. It also keeps app-owned IndexedDB snapshots for faster local startup and receipt access. The app requests persistent-storage protection to reduce automatic eviction. **Waiting to sync** is safe while offline; do not clear the app/site data before synchronization completes.

After changing Firebase initialization or `.env.local`, completely stop `npm run dev`, start it again, and hard-refresh the browser. If the app stays in Offline mode while other websites work, allow these HTTPS hosts through the device firewall, antivirus web shield, proxy, and DNS filter:

- `firestore.googleapis.com`
- `*.googleapis.com`
- `*.firebaseio.com`
- `*.firebaseapp.com`

Deploy the updated deletion permission after this release:

```bash
firebase login
firebase use piyu-pos-system
firebase deploy --only firestore:rules,firestore:indexes
```

In Firestore, confirm the signed-in administrator's `users/{uid}` document contains `active: true` and `role: "admin"`; otherwise the Delete button is intentionally unavailable.

For a Bluetooth thermal printer:

- Pair/install it in Windows or Android first.
- Select it in the browser print dialog and match 58 mm/80 mm paper settings.
- Disable browser headers/footers and use minimum margins if the driver supports them.

Direct Web Bluetooth ESC/POS is intentionally not included in version one because browser/device support and printer protocols vary. A browser cannot silently select a printer; the print dialog is required. Android browser printing depends on the printer maker's print service or compatible OS driver.

## Deploy free on Vercel

1. Deploy the current Firestore rules and indexes before publishing the frontend:

   ```bash
   firebase login
   firebase use piyu-pos-system
   firebase deploy --only firestore:rules,firestore:indexes
   ```

2. Push this repository to GitHub and import it in Vercel with the **Next.js** framework preset. Keep the root directory as the repository root, Build Command as `next build`, and Output Directory as the Next.js default.
3. In Vercel **Project Settings → Environment Variables**, add all six `NEXT_PUBLIC_FIREBASE_*` variables from `.env.local`. Apply them to Production and Preview (and Development if using `vercel dev`). Never upload `.env.local` to GitHub.
4. Deploy once, then copy the stable production hostname, for example `piyu-pos-system.vercel.app`.
5. In Firebase Console → Authentication → Settings → **Authorized domains**, add only the hostname without `https://` or a trailing slash. Add the custom domain too if one is connected later.
6. If the Firebase Web API key has HTTP-referrer restrictions in Google Cloud Console, add `https://your-domain/*` and the production Vercel hostname there.
7. Redeploy after changing any `NEXT_PUBLIC_*` environment value because Next.js embeds public environment values during the build.
8. Test login, creating an online order, creating an offline order, restoring synchronization, Settings, WhatsApp invoice opening, all print formats, PWA installation, and a hard refresh on the production domain.

This repository pins Vercel builds to Node.js 22 through `package.json`. The service worker is served with no-cache headers so browsers can discover new PWA releases, while its versioned application cache continues to support offline reopening.

Vercel and Firebase free tiers have quotas and are not an unconditional guarantee of zero cost at every traffic level. Monitor Firebase usage/billing alerts. Back up business data regularly from Settings; browser IndexedDB is a cache, not a backup.

## Operational limitations

- Firestore uses document-level last-write-wins. Separate order documents, updated timestamps/users, and append-only logs reduce conflict risk, but two people editing the same order simultaneously can overwrite fields.
- Cached data is available only after it has been loaded on that browser/device. A completely new device cannot log in or download data while offline.
- A manually written service worker provides app-shell/offline navigation. Test cache updates after every deployment and instruct users to reload when a new version is released.
- PDF and CSV exports include the locally available dataset. For very large databases, add paginated/server-side archival reporting.
- Receipt printing is browser/driver based; direct ESC/POS and silent printing would need a separate native helper or supported printer integration.
