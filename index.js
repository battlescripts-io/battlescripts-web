const server = require('http-server');
let s = server.createServer({
  root: './docs'
});
s.listen(80);
console.log("Listening on http://localhost/");
