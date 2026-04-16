const express = require("express");
const app = express();

require('dotenv/config');

const db = require("./src/db/db.js")
db.testConnection()

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set('trust proxy', 1);

const authRouter = require("./src/router/auth_router");
const adresRouter = require("./src/router/adres_router.js");
const talepRouter = require("./src/router/talep_router");

app.use("/", authRouter);
app.use("/", adresRouter);
app.use("/", talepRouter);

var serverPORT = process.env.PORT || 3000;
app.listen(serverPORT, () => {
  console.log("server is running on", serverPORT);
});