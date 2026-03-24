const express = require("express");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set('trust proxy', 1);

const authRouter = require("./src/router/auth_router");

app.use("/", authRouter);


var serverPORT = process.env.PORT || 3000;
app.listen(serverPORT, () => {
  console.log("server is running on", serverPORT);
});