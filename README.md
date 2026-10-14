# Leads sites

Landing pages for lead generation. Each site lives in its own numbered folder and is
self-contained (HTML, CSS, JavaScript and images, no build step).

| Folder | Site |
|---|---|
| [`01/`](01/) | BlinQ demo request page ("See it in action"), dark theme |

`functions/api/demo-request.js` is shared by the sites: it emails the demo request form to a Gmail
inbox when the repo is hosted on Cloudflare Pages (see below).

## Hosting

- **GitHub Pages** (current): published from the `main` branch root, so each folder is served at
  `/<folder>/`, for example https://thimiraperera.github.io/leads-sites/01/. `.nojekyll` tells Pages to
  serve the files as they are. GitHub Pages can't run the form Function, so there the form offers an
  email link to support@blinq.com.au instead of sending.
- **Cloudflare Pages**: serves the same files *and* runs `functions/`, so the form sends. Set up below.

## Demo request form: Cloudflare Pages + Gmail

The form posts to `/api/demo-request`. That Cloudflare Pages Function checks the details and sends
them to your inbox through Gmail's SMTP server (smtp.gmail.com, port 465) with a Gmail **app
password**. Replies go straight to the person who filled in the form (it's set as Reply-To).

The email is HTML with a plain-text copy, sent to every `LEAD_TO` address as a blind copy (BCC), and
includes visitor details gathered only when the form is submitted: device, screen, language, time
zone, referring site, campaign tags, time on page and what they opened, plus IP address,
approximate location and network from Cloudflare. Nothing is stored. BlinQ's privacy policy should
mention that enquiries include these details. (The live copy of site 01 with the working form is
the private `blinq-leads-1` repo, on a Cloudflare Worker.)

### 1. Create a Gmail app password

1. Sign in to the Gmail account that should send the emails (a dedicated one such as
   `blinq.leads@gmail.com` is a good idea).
2. Turn on **2-Step Verification**: https://myaccount.google.com/security
3. Open https://myaccount.google.com/apppasswords, create one called "BlinQ leads site", and copy the
   16-character password. Keep it private: it only goes into Cloudflare as a secret (step 2.4), never
   into this repo.

### 2. Host the repo on Cloudflare Pages

1. Cloudflare dashboard > **Workers & Pages** > **Create** > **Pages** > **Connect to Git**, and pick
   `thimiraperera/leads-sites`.
2. Build settings (the same as the main BlinQ site's Pages project, which also serves `index.html`
   and `functions/` from the repository root):
   - Framework preset: **None**
   - Build command: `exit 0`
   - Build output directory: `/` (the repository root)
3. **Save and Deploy**. The site appears at `https://<project-name>.pages.dev/01/`.
4. In the project: **Settings** > **Variables and Secrets** > add (for Production):

   | Name | Type | Value |
   |---|---|---|
   | `GMAIL_USER` | Text | The Gmail address from step 1 |
   | `GMAIL_APP_PASSWORD` | Secret | The 16-character app password (spaces are fine) |
   | `LEAD_TO` | Text | Optional. Who receives requests: one address, or up to 10 separated by commas. Defaults to `GMAIL_USER` |
   | `SEND_FROM_NAME` | Text | Optional. Sender name in the inbox. Defaults to "BlinQ demo requests" |
   | `TIMEZONE` | Text | Optional. Time zone for "Received" in the email, e.g. `Australia/Sydney`. Defaults to UTC |

5. Variables only apply to new deployments: **Deployments** > latest > **Retry deployment** (or push
   any commit).

### 3. Test it

Open `https://<project-name>.pages.dev/01/`, choose a business type, fill in the form and send. Take a
few seconds: anything sent within 2.5 seconds of opening the form is treated as a bot and quietly
dropped. The email arrives as "New demo request: <name>, <business>".

If it doesn't arrive, check **Workers & Pages** > the project > **Functions** > **Real-time logs**
while you send. "login was refused (535 ...)" means the app password or `GMAIL_USER` is wrong.

### Spam protection

Built in: a hidden honeypot field, the 2.5-second minimum, server-side checks on every field, and a
light rate limit per visitor (5 requests per 10 minutes, on a custom domain). If spam still gets
through, switch on **Cloudflare Turnstile** (free):

1. Cloudflare dashboard > **Turnstile** > **Add widget** for your Pages domain; copy the site key and
   secret key.
2. Add `TURNSTILE_SITE_KEY` (Text) and `TURNSTILE_SECRET` (Secret) to the project and redeploy. The
   check then appears above the form's send button by itself.

### Limits

- A regular Gmail account can send roughly 500 emails a day through SMTP; Google Workspace accounts
  more. Each request is one email (per address in `LEAD_TO`).
- Emails are sent *from* the Gmail address; the visitor's address is the Reply-To.
- Changing the Google account password cancels its app passwords: create a new one and update
  `GMAIL_APP_PASSWORD`.

## Adding a site

Create the next folder (`02/`, `03/`, ...) with its own `index.html` and assets, add it to the
table above, commit and push. Both GitHub Pages and Cloudflare Pages republish automatically. To
reuse the form, post the same fields to `/api/demo-request` with your folder name as `site`.
