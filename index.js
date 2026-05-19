const express = require("express");
const app = express();
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');

require('dotenv/config');

const db = require("./src/db/db.js")
db.testConnection()

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));
app.use(expressLayouts);
app.use(express.static(__dirname + '/src/_public'));

app.set('views', path.resolve(__dirname, './src/views'));
app.set('layout', __dirname + './src/views/layouts')
app.set('view engine', 'ejs');

const authRouter = require("./src/router/auth_router");
const adresRouter = require("./src/router/adres_router.js");
const talepRouter = require("./src/router/talep_router");
const adminRouter = require("./src/router/admin_router.js");

app.use("/api/", authRouter);
app.use("/api/", adresRouter);
app.use("/api/", talepRouter);
app.use("/", adminRouter);

var serverPORT = process.env.PORT || 3000;
app.listen(serverPORT, () => {
  console.log("server is running on", serverPORT);
});