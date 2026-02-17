{
  "version": 2,
  "builds": [
    {
      "src": "api/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "handle": "filesystem"
    },
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/admin.html",
      "dest": "/admin.html"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
