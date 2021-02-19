/**
 * Created by wct on 8/23/14.

var serial_port_name = '';
var tinyg_open = false;
/* requires
var serialport = require("serialport");

// serial port stuff
var SerialPort = serialport.SerialPort; // localize object constructor
serialport.list(function (err, ports) {
    var msg = "TinyG port not found.";
    ports.forEach(function(port) {
        if (port.pnpId == 'usb-FTDI_FT230X_Basic_UART_DA00FNTN-if00-port0'){
            serial_port_name = port.comName;
            msg = "TinyG found on port " + serial_port_name;
            // note that making a serial port opens it
            tinyg_port = new SerialPort(serial_port_name, {
                parser: serialport.parsers.readline("\n"),
                baudRate: 115200,
                flowcontrol: ['XON','XOFF']
            });
            tinyg_port.on('open', function(){
                tinyg_open = true;
                console.log('TinyG Serial Port Opened');
                tinyg_port.on('data', function(data){
                    console.log('#### data received: ' + data);
                });
            });
            tinyg_port.on('close', function() {
                console.log("Closed!!");
                process.exit(0);
            });

        }
    });
    console.log (msg);
});
*/

var wcttg = require('wcttg');
var util = require('util');
var g = new wcttg();
var command;

g.list(function (err, results) {
    if (err) {
        throw err;
    }

    for (var i = 0; i < results.length; i++) {
        var gport = results[i];
        console.log(' Found tinyg on %s', gport.comName);
    }
    // just use the last one found for now, since there's just 1
    g.on('open', function(data) {
        console.log('#### open');

        g.on('data', function(data) {
            // sometimes we get text back no matter what mode we're in
            if (data.charAt(0) == "{") {

                try {
                    data = JSON.parse(data);
                }
                catch (e) {
                    console.log("### Parse error -- %s", e);
                }
                console.log('#### JSON data received: ' + util.inspect(data));
            } else {
                // console.log("Plain text: " + data);
            }
        });

        g.on('close', function() {
            console.log("Closed!!");
            process.exit(0);
        });
        // set up basic operation
        g.factory_defaults = 1;
        g.mm_enabled = 1;
        g.status_report_interval = 50;
        g.write('g0x0');
        g.write('g0x10');
    });
    g.open(gport.comName);

});
