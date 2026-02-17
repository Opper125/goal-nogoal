{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    },
    {
      "src": "*.html",
      "use": "@vercel/static"
    },
    {
      "src": "css/**/*.css",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/admin(.*)",
      "dest": "/admin.html",
      "headers": {
        "X-Robots-Tag": "noindex"
      }
    },
    {
      "src": "/css/(.*)",
      "dest": "/css/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "JSONBIN_API_KEY": "$2a$10$G4ArcYwbjfH6p1wSxZtR3.w7VfM7HW8E5JRyXp/u7EWVaJZZe7vue",
    "BIN_USERS": "69946d1d43b1c97be985ec60",
    "BIN_DEPOSITS": "69946d3b43b1c97be985ec9f",
    "BIN_WITHDRAWALS": "69946d53d0ea881f40c14dbd",
    "BIN_PAYMENTS": "69946d6743b1c97be985ecfe",
    "BIN_GAME_VIDEOS": "69946d8243b1c97be985ed53",
    "BIN_GAME_CONTROLS": "69946d9943b1c97be985ed8b",
    "BIN_CONTACTS": "69946dabd0ea881f40c14eba",
    "TELEGRAM_BOT_TOKEN": "8532065930:AAHyQgfa-YQn3L4jK17mXf5XM_1YHbwmM_M",
    "TELEGRAM_ADMIN_ID": "1538232799",
    "GMAIL_API_KEY": "e9dca4286emsh4d7cdfebdedad21p12269cjsn0581391f6ed3"
  }
}
