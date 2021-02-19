// requires
var nconf = require("nconf");
var oz = require("oscillators");
var express = require("express");
var http = require("http");
// var serialport = require("serialport");
var wcttg = require("../rollyerown/node_modules/wcttg/wcttg.js");
var util = require("util");
var g = new wcttg();

// config
nconf.use("file", { file: "./config.json" });
nconf.load();
var config = nconf.get();

/* globals */
var startTime = Date.now();
var runMode = "manual"; // runtime, manual and sleep
var intervals = {
  system: null,
  x: null,
  y: null,
  z: null,
  a: null
};
var waves = {
  x: {
    freq: 10,
    amp: 0
  },
  y: {
    freq: 7,
    amp: 0
  },
  z: {
    freq: 6,
    amp: 0
  },
  a: {
    freq: 11,
    amp: 0
  }
};
var goals = {
  tinyg: {
    x_pos: 0,
    y_pos: 0,
    z_pos: 0,
    a_pos: 0
  }
};
var devices = {
  tinyg: {
    connection: 0,
    all_animate: false,
    x_pos: 0,
    x_min: 0,
    x_max: config.x_max,
    x_limit: false,
    x_animate: false,
    x_moving: false,
    y_pos: 0,
    y_min: 0,
    y_max: config.y_max,
    y_limit: false,
    y_animate: false,
    y_moving: false,
    z_pos: 0,
    z_min: 0,
    z_max: config.z_max,
    z_limit: false,
    z_animate: false,
    z_moving: false,
    a_pos: 0,
    a_min: 0,
    a_max: config.a_max,
    a_limit: false,
    a_animate: false,
    a_moving: false
  },
  mindflex: {
    port: null,
    connection: 200,
    attention: 0,
    meditation: 0
  }
};

// make sure to keep this order
var app = express();
app.use(express.static("public"));
var server = http.createServer(app);
var io = require("socket.io").listen(server);

// routes
app.get("/", function(req, res) {
  res.sendfile("public/index.html");
});
app.get("/manual", function(req, res) {
  res.sendfile("public/manual.html");
});
app.get("/sleep", function(req, res) {
  res.sendfile("public/sleep.html");
});
// start server
server.listen(config.http_port);

var manualUpdate = function(data) {
  data = JSON.parse(data);
  switch (data.command) {
    case "STOP":
      console.log("STOP");
      break;
    case "tinyg_position":
      console.log(
        "got request for axis: " + data.data.axis + " += " + data.data.offset
      );
      // record value in goals
      goals.tinyg[data.data.axis + "_pos"] += data.data.offset;
      if (goals.tinyg[data.data.axis + "_pos"] < 0) {
        goals.tinyg[data.data.axis + "_pos"] = 0;
      }
      // actually move the motor
      g.write("g0" + data.data.axis + goals.tinyg[data.data.axis + "_pos"]);
      break;
    case "tinyg_zero":
      console.log("got request to zero axis " + data.data.axis);
      // @todo evaluate this
      if (data.data.axis == "all") {
        goals.tinyg.x_pos = 0;
        goals.tinyg.y_pos = 0;
        goals.tinyg.z_pos = 0;
        goals.tinyg.a_pos = 0;
        // @todo this is not right, need to read the switches
        g.write("g0x0");
        g.write("g0y0");
        g.write("g0z0");
        g.write("g0a0");
      } else {
        goals.tinyg[data.data.axis + "_pos"] = 0;
        g.write("g0" + data.data.axis + "0");
      }
      break;
    case "tinyg_max":
      console.log("got request to max axis " + data.data.axis);
      if (data.data.axis == "all") {
        goals.tinyg.x_pos = devices.tinyg.x_max;
        goals.tinyg.y_pos = devices.tinyg.y_max;
        goals.tinyg.z_pos = devices.tinyg.z_max;
        goals.tinyg.a_pos = devices.tinyg.a_max;
        g.write("g0x" + goals.tinyg.x_pos);
        g.write("g0y" + goals.tinyg.y_pos);
        g.write("g0z" + goals.tinyg.z_pos);
        g.write("g0a" + goals.tinyg.a_pos);
      } else {
        goals.tinyg[data.data.axis + "_pos"] =
          devices.tinyg[data.data.axis + "_max"];
        g.write("g0" + data.data.axis + devices.tinyg[data.data.axis + "_max"]);
      }
      break;
    case "tinyg_record_max":
      console.log("got request to record axis max " + data.data.axis);
      devices.tinyg[data.data.axis + "_max"] =
        devices.tinyg[data.data.axis + "_pos"];
      nconf.set(
        data.data.axis + "_max",
        devices.tinyg[data.data.axis + "_max"]
      );
      nconf.save(function(err) {
        if (err) {
          console.error(err.message);
          return;
        }
        console.log("Configuration saved successfully.");
      });
      break;
    case "tinyg_animate":
      console.log(
        "got request set animation for axis " +
          data.data.axis +
          " to " +
          data.data.value
      );
      break;
  }
};

io.on("connection", function(socket) {
  socket.on("manual_update", function(data) {
    manualUpdate(data);
    //io.emit('oz_freq', oz_freq);
  });
  socket.on("request_update", function() {
    var data = JSON.stringify({
      tinyg: devices.tinyg,
      mindflex: devices.mindflex
    });
    io.emit("update", data);
  });
});

// service all functions
var heartbeat = function() {
  // stuff will indeed happen here
  // @todo fix this hack
  // devices.tinyg.x_pos = goals.tinyg.x_pos;
  // devices.tinyg.y_pos = goals.tinyg.y_pos;
  // devices.tinyg.z_pos = goals.tinyg.z_pos;
  // devices.tinyg.a_pos = goals.tinyg.a_pos;
};

// waveform stuff
function sineWave(freq) {
  var timenow = Date.now() - startTime; // given a time domain
  return oz.sine(timenow, (1 / freq) * config.oz_freq_scale); // return sine wave amplitude at given freq
}

// timer stuff
intervals.system = setInterval(function() {
  heartbeat();
}, config.system_interval);
intervals.x = setInterval(function() {
  waves.x.amp = sineWave(waves.x.freq);
}, config.oz_sample_speed);
intervals.y = setInterval(function() {
  waves.y.amp = sineWave(waves.y.freq);
}, config.oz_sample_speed);
intervals.z = setInterval(function() {
  waves.z.amp = sineWave(waves.z.freq);
}, config.oz_sample_speed);
intervals.a = setInterval(function() {
  waves.a.amp = sineWave(waves.a.freq);
}, config.oz_sample_speed);

// tinyg stuff
g.list(function(err, results) {
  if (err) {
    throw err;
  }

  for (var i = 0; i < results.length; i++) {
    var gport = results[i];
    console.log(" Found tinyg on %s", gport.comName);
  }
  // just use the last one found for now, since there's just 1
  g.on("open", function(data) {
    console.log("#### open");

    g.on("data", function(data) {
      // sometimes we get text back no matter what mode we're in
      if (data.charAt(0) == "{") {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.log("### Parse error -- %s", e);
        }
        console.log("#### JSON data received: " + util.inspect(data));
        if (data.hasOwnProperty("sr")) {
          console.log("#### Status report");
          if (data.sr.hasOwnProperty("posx")) {
            console.log("#### setting X value!");
            devices.tinyg.x_pos = data.sr.posx;
          }
          if (data.sr.hasOwnProperty("posy")) {
            console.log("#### setting Y value!");
            devices.tinyg.y_pos = data.sr.posy;
          }
          if (data.sr.hasOwnProperty("posz")) {
            console.log("#### setting Z value!");
            devices.tinyg.z_pos = data.sr.posz;
          }
          if (data.sr.hasOwnProperty("posa")) {
            console.log("#### setting A value!");
            devices.tinyg.a_pos = data.sr.posa;
          }
        }
      } else {
        // console.log("Plain text: " + data);
      }
    });

    g.on("close", function() {
      console.log("Closed!!");
      process.exit(0);
    });
    // set up basic operation
    g.factory_defaults = 1;
    g.mm_enabled = 1;
    g.status_report_interval = 50;
    g.write("g0x0");
  });
  g.open(gport.comName);
});

// serial port stuff
/*
var SerialPort = serialport.SerialPort; // localize object constructor
serialport.list(function (err, ports) {
    var msg = "Arduino port not found.";
    ports.forEach(function(port) {
        if (port.pnpId.indexOf("usb-FTDI_FT232R_USB_UART") > -1){
            config.serial_port_name = port.comName;
            msg = "Arduino found on port " + config.serial_port_name;
            devices.mindflex.port = new SerialPort(config.serial_port_name, {
                parser: serialport.parsers.readline("\n"),
                baudrate:9600
            });
            devices.mindflex.port.on('open', function(){
                console.log('Serial Port Opened');
                devices.mindflex.port.on('data', function(data){
                    var reading = JSON.parse(data);
                    switch(reading.type){
                        case 'attention':
                            devices.mindflex.attention = reading.value;
                            break;
                        case 'meditation':
                            devices.mindflex.meditation = reading.value;
                            break;
                    }
                });
            });
        }
    });
    console.log (msg);
});
*/
