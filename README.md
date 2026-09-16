# Sermon Trainer

Sermon Trainer is a guided Bible-study and preaching-preparation workspace. AI is restricted to research assistance; it does **not** write the user's sermon or lesson.

## AI-enabled sections

AI Research Assist is available only for:

- **3. Original Context** — historical/cultural context, literary/biblical context, important words/concepts, questions to verify
- **4. Old Testament Foundation / Illustration**
- **5. New Testament Fulfilment / Development**
- **7. Illustrations** — six optional research leads (3 biblical + 3 historical) for the user to choose from

**Section 10 — Sermon / Lesson Structure — is deliberately user-authored.** The server guardrail blocks sermon outlines, preaching points, application, conclusions, prayers, and ready-to-deliver sermon prose.

## Preacher exports

The current browser prototype provides:

1. Dot Point Preacher Notes
2. Scriptures Used
3. Detailed Preacher Study
4. Combined Preacher Pack
5. Student / Participant handout

Print/export uses the browser's Print → Save as PDF function.

## Local run

```bash
cp .env.example .env
# Edit .env and add OPENAI_API_KEY
npm install
npm start
```

Then open http://localhost:3106.

## AWS Lightsail deployment

Recommended host path:

```bash
/home/ubuntu/apps/sermon-trainer
```

Recommended domain:

```text
https://sermon-trainer.eduappsplus.com.au
```

The sample Nginx configuration expects the Node process on **127.0.0.1:3106**.

### First deployment

```bash
cd ~/apps
git clone <YOUR_GITHUB_REPOSITORY_URL> sermon-trainer
cd sermon-trainer
cp .env.example .env
nano .env
```

Put the real OpenAI API key in `.env`; never commit it to GitHub.

Then:

```bash
npm install --omit=dev
pm2 start ecosystem.config.cjs
pm2 save
sudo cp nginx-sermon-trainer.conf /etc/nginx/sites-available/sermon-trainer
sudo ln -s /etc/nginx/sites-available/sermon-trainer /etc/nginx/sites-enabled/sermon-trainer
sudo nginx -t
sudo systemctl reload nginx
```

After the DNS A record for `sermon-trainer.eduappsplus.com.au` points to the Lightsail public IP:

```bash
sudo certbot --nginx -d sermon-trainer.eduappsplus.com.au
```

Check:

```bash
curl -s http://127.0.0.1:3106/health
pm2 logs sermon-trainer --lines 50
```

## Security notes

- `OPENAI_API_KEY` is server-side only.
- The `.env` file is excluded from Git.
- The app listens only on `127.0.0.1`; Nginx is the public entry point.
- The AI endpoint has a lightweight per-IP request limit.
- This prototype stores study form content in the user's browser local storage. A future authenticated version can move study data to PostgreSQL/RDS for cross-device access.
