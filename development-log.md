# Development Log

## 2025-12-30

### What we built
- JAN scanner PWA with camera/manual input, pick list, and completed list.
- Master CSV upload and server sync for all devices.
- Admin page for uploading master CSV (password protected).

### Steps and progress
1) Core scanning + pick list
   - Added camera/manual scanning, debounce, and pick list aggregation.
   - Added pick completion flow with a completed list and restore action.
2) Master mapping and display
   - CSV parsing for each-to-case mapping with product names.
   - Show case and each JAN in pick list, and show product name.
   - Auto-hide master section after setup with a toggle.
3) UI tuning
   - Enlarged JAN, product name, and quantity text.
   - Adjusted layout for mobile; buttons kept on one row and easier to tap.
4) Server-wide master updates
   - Cloudflare Pages Functions + KV to host latest CSV.
   - Admin upload page at `/admin` with password.
   - App loads `/data/masters/each-to-case.csv` on startup and shows updated time.
5) Deployment
   - GitHub connected to Cloudflare Pages.
   - Build: `npm run build`, output: `dist`.
   - KV binding: `MASTER_KV`, env var: `ADMIN_PASSWORD`.

### Notes
- Master CSV upload reflects across all devices after deployment.
- Update time is shown on the app screen and admin upload result.
