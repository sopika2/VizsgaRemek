const express     = require('express');
const session     = require('express-session');
const app         = express();
const port        = 3000;

app.use(express.static('public'));       // public/index.html a def.

app.use(session({ key:'user_sid', secret:'nagyontitkos', resave:true, saveUninitialized:true }));   /* https://www.js-tutorials.com/nodejs-tutorial/nodejs-session-example-using-express-session */
var session_data;

app.listen(port, function () { console.log(`progi app listening at http://localhost:${port}`); });