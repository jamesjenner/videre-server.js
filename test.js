

var SerialPort = require("serialport").SerialPort
var mavlink = require('./implementations/mavlink_common_v1.0');

var COMPORT = "/dev/ttyUSB0";
var BAUD = 57600;

/*
connection = net.createConnection(5760, '127.0.0.1');
connection.on('data', function(data) {
            mavlink.parseBuffer(data);
});
*/

var mavlinkParser = new MAVLink();

var serialPort = new SerialPort(COMPORT, {
	baudrate: BAUD
});

// serialPort.write(message.buffer);

serialPort.on("data", function (data) {
    mavlinkParser.parseBuffer(data);
});

mavlinkParser.on('message', function(message) {
    console.log('Got a message of any type!');
    console.log(message);
});

mavlinkParser.on('HEARTBEAT', function(message) {
    console.log('Got a heartbeat message!');
    console.log(message);
});

