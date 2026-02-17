{
  "version": 2,
  "buildCommand": "",
  "installCommand": "npm install",
  "outputDirectory": "",
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    },
    {
      "src": "index.html",
      "use": "@vercel/static"
    },
    {
      "src": "admin.html",
      "use": "@vercel/static"
    },
    {
      "src": "css/**/*.css",
      "use": "@vercel/static"
    },
    {
      "src": "js/**/*.js",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/css/(.*)",
      "dest": "/css/$1"
    },
    {
      "src": "/js/(.*)",
      "dest": "/js/$1"
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
