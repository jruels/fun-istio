var express = require("express");
var app = express();
app.get("/test", (req, res) => {
  res.send("HELLO TEST");
});
app.get("/headers", function(req, res) {
  res.json(req.headers);     //sends request headers in json format
});
app.listen(8001, function() {
  console.log("Server running on port 8001");
});
