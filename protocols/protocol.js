/*
 * protocol.js
 * 
 * Copyright (c) 2013 James G Jenner
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/
 */


var SerialPort   = require("serialport").SerialPort
var net          = require('net');
var EventEmitter = require('events').EventEmitter;
var util         = require('util');
var uuid         = require('node-uuid');

var Attitude     = require('../videre-common/js/attitude');
var Point        = require('../videre-common/js/point');
var Position     = require('../videre-common/js/position');
var Telemetry    = require('../videre-common/js/telemetry');

module.exports = Protocol;

Protocol.DEFAULT_COMPORT = "/dev/ttyUSB0";
Protocol.DEFAULT_BAUD = 57600;
Protocol.LOCAL_HOST = "127.0.0.1";
Protocol.DEFAULT_PORT = "5760";

Protocol.CONNECTION_SERIAL = "Serial";
Protocol.CONNECTION_NETWORK = "Network";

Protocol.POSITION_MODE_NONE = 0;
Protocol.POSITION_MODE_DISTANCE = 1;
Protocol.POSITION_MODE_TIME = 2;

// setup Protocol as an emitter
util.inherits(Protocol, EventEmitter);

/**
 * define a new protocol 
 *
 * options            named array of options for the protocol instance, values available are as follows:
 *   debug            true debugging enabled, otherwise debugging is disabled, false is default
 *   debugLevel       the level of debuging that will be performed, higher the value means more details
 *   connectionMethod Protocol.CONNECTION_SERIAL or Protocol.CONNECTION_NETWORK, serial is default
 *   networkAddress   the network address if using network connection, default is local host.
 *   networkPort      the port used when using network connection, default is Protocol.DEFAULT_PORT
 *   serialPort       the serial port to connect when using serial connection, default is Protocol.DEFUALT_COMPORT
 *   serialBaud       the baud rate when using serial connection, default is Protocol.DEFAULT_BAUD
 */
function Protocol(options) {
    options = options || {};

    EventEmitter.call(this);

    this.name = options.name;
    this.debug = ((options.debug != null) ? options.debug : false);
    this.debugLevel = ((options.debugLevel != null) ? options.debugLevel : 0);

    /*
    this.autoDiscover = ((options.autoDiscover != null) ? options.autoDiscover : false);
    this.multiVehicle = ((options.multiVehicle != null) ? options.multiVehicle : false);
    */

    this.getVehicleIdFunction = ((options.getVehicleIdFunction != null) ? options.getVehicleIdFunction : function() {});
    this.getDeviceOptionsFunction = ((options.getDeviceOptionsFunction != null) ? options.getDeviceOptionsFunction : function() {});

    this.connectionMethod = ((options.connectionMethod != null) ? options.connectionMethod : Protocol.CONNECTION_SERIAL);

    this.networkAddress = ((options.networkAddress != null) ? options.networkAddress : Protocol.LOCAL_HOST);
    this.networkPort = ((options.networkPort != null) ? options.networkPort : Protocol.DEFAULT_PORT);

    this.serialPort = ((options.serialPort != null) ? options.serialPort : Protocol.DEFAULT_COMPORT);
    this.serialBaud = ((options.baud != null) ? options.baud : Protocol.DEFAULT_BAUD);

    if(this.connectionMethod === Protocol.CONNECTION_SERIAL) {
	this.id = this.serialPort;
    } else {
	this.id = this.networkAddress + ":" + networkPort;
    }

    // define the devices
    this.devices = [null, null];
}

/**
 * connect to the remote mavlink based device
 */
Protocol.prototype.connect = function() {
    if(this.connectionMethod === Protocol.CONNECTION_SERIAL) {
	this._initSerialPort();
    } else {
	this._initNetwork();
    }
}

/**
 * disconnect from the remote mavlink based device
 */
Protocol.prototype.disconnect = function() {
    if(this.connectionMethod === Protocol.CONNECTION_SERIAL) {
	this._closeSerialPort();
    } else {
	this._closeNetworkConnection();
    }
}

Protocol.prototype._initSerialPort = function() {
    if(this.debug && this.debugLevel > 0) {
	console.log("Opening serial port " + this.serialPort + " baud: " + this.serialBaud);
    }

    this.serialDevice = new SerialPort(this.serialPort, {
	baudrate: this.serialBaud
    });

    var self = this;

    this.serialDevice.on("data", function (data) {
	if(self.debug && self.debugLevel > 9) {
	    console.log("Serial port, received data: " + data);
	}
	self.processData(data);
    });
}

Protocol.prototype._closeSerialPort = function() {
    if(this.debug && this.debugLevel > 0) {
	console.log("Closing serial port " + this.serialPort);
    }

    if(this.serialDevice) {
	this.serialDevice.close();
	this.serialDevice = null;
    }
}

Protocol.prototype._initNetwork = function() {
    if(this.debug && this.debugLevel > 0) {
	console.log("Connecting via network " + this.networkAddress + ":" + this.networkPort);
    }

    this.netConnection = net.createConnection(this.networkPort, this.networkAddress);

    var self = this;

    this.netConnection.on('data', function(data) {
	if(self.debug && self.debugLevel > 9) {
	    console.log("Network connection, received data: " + data);
	}
	self.processData(data);
    });
}

Protocol.prototype.processData = function(data) { }

Protocol.prototype._setupListeners = function() { }

Protocol.prototype._closeNetworkConnection = function() {
    if(this.netConnection) {
	this.netConnection.end();
	this.netConnection = null;
    }
}

/**
 * writes data to the mavlink connection
 *
 * data - the data to write to the mavlink connection
 *
 */
Protocol.prototype._writeMessage = function(data) {
    if(this.connectionMethod === Protocol.CONNECTION_SERIAL) {
	if(this.debug && this.debugLevel > 9) {
	    console.log("write: calling serialDevice.write: " + data);
	}
	this.serialDevice.write(data);
    } else {
	// TODO: set this up for network, need to check if below is correct...
	if(this.debug && this.debugLevel > 9) {
	    console.log("write: calling netConnection.write: " + data);
	}
        this.netConnection.write(data);
    }
}

Protocol.prototype.requestSetWaypoints = function(waypoints) { }

/**
 * request the waypoints from the drone
 *
 * returns  1 if request generated
 *         -1 if the system id is unknown
 *         -2 if currently processing waypoints
 */
Protocol.prototype.requestWaypoints = function() { }

/**
 * request that the target is set to the specified waypoint
 *
 * waypoint    the waypoint that is to be the target
 *
 * returns  1 if request generated
 *         -1 if the system id is unknown
 *         -2 if currently busy
 */
Protocol.prototype.requestSetTargetWaypoint = function(waypoint) { }

/**
 * request that the target is set to the specified waypoint
 *
 * waypoint    the waypoint that is to be the target
 *
 * returns  1 if request generated
 *         -1 if the system id is unknown
 *         -2 if currently busy
 */
Protocol.prototype.requestClearWaypoints = function() { }

// TODO: sort out debug options for the console.logs
Protocol.prototype._writeWithTimeout = function(options) {
    var self = this;

    self.devices[options.deviceId].timeoutIds[options.timeoutId] = setTimeout(function() {
	options.attempts++;

	if(options.attempts > 3) {
	    if(self.debug) {
		console.log("Message " + options.messageName + " response timed out, retries exceeded");
	    }

	    if(options.onMaxAttempts) {
		options.onMaxAttempts.call(self);
	    }
	} else {
	    if(self.debug && self.debugLevel > 1) {
		console.log("Message " + options.messageName + " timed out, retrying. Attempt: " + options.attempts);
	    }

	    self._writeWithTimeout.call(self, options);
	}
    }, options.timeout);

    self._writeMessage(options.message);
}

Protocol.prototype._reportAttitude = function(id, att, heading) {
    // don't report if the device is undefined
    if(this.devices[id] === undefined) {
	return;
    }

    var attitude = this.devices[id].attitude;

    if((attitude.pitch > att.pitch + this.devices[id].pitchAccuracy || attitude.pitch < att.pitch - this.devices[id].pitchAccuracy) ||
       (attitude.roll  > att.roll  + this.devices[id].rollAccuracy  || attitude.roll  < att.roll  - this.devices[id].rollAccuracy) ||
       (attitude.yaw   > att.yaw   + this.devices[id].yawAccuracy   || attitude.yaw   < att.yaw   - this.devices[id].yawAccuracy)) {

        // update the attitude
	this.devices[id].attitude.pitch = att.pitch;
	this.devices[id].attitude.roll = att.roll;
	this.devices[id].attitude.yaw = att.yaw;
	this.devices[id].attitude.x = att.x;
	this.devices[id].attitude.y = att.y;
	this.devices[id].attitude.z = att.z;
	this.devices[id].heading = heading;

	// TODO; do we need to know the speed of change?
	/*
	pitchspeed: message.pitchspeed,
	rollspeed: message.rollspeed,
	yawspeed: message.yawspeed
	*/

	// fire the event
	this.emit('attitude', this.id, id, this.devices[id].attitude, heading);
    }
}

Protocol.prototype._reportPosition = function(id, lat, lng, alt) {
    var reportPos = false;

    // don't report if the device is undefined
    if(this.devices[id] === undefined) {
	return;
    }

    var position = this.devices[id].position;

    switch(this.devices[id].positionMode) {
        case Protocol.POSITION_MODE_NONE:
	    reportPos = true;
	    break;

        case Protocol.POSITION_MODE_DISTANCE:
	    var diff = this.measurePoints(position.latitude, position.longitude, lat, lng) * 1000;
	    
	    if(this.measurePoints(position.latitude, position.longitude, lat, lng) * 1000 > this.devices[id].positionDiff) {
		reportPos = true;
	    }
	    break;

        case Protocol.POSITION_MODE_TIME:
            var currentTime = new Date().getTime();

	    if(currentTime - this.devices[id].positionTimer > this.devices[id].positionDiff * 1000) {
		reportPos = true;
		this.devices[id].positionTimer = currentTime;
	    }
	    break;
    }

    if(reportPos) {
	this.devices[id].position.latitude  = lat;
	this.devices[id].position.longitude = lng;
	this.devices[id].position.altitude  = alt;

	this.emit('positionGPSRawInt', self.id, id, this.devices[id].position);
    }
}

/*
 * measures the distance between to points in kilometers
 *
 * params:
 *    latitude1   latitude of the first point
 *    longitude1  longitude of the first point
 *    latitude2   latitude of the second point
 *    longitude2  longitude of the second point
 *    radius      radius to be used, defaults to 6371.
 *      
 * note that the following code is derived from code sourced from 
 * http://www.movable-type.co.uk/scripts/latlong.html
 * copyright belongs to Chris Veness 2002-2012. Chris has licenced the code under creative commons 
 * by attribution, refer http://creativecommons.org/licenses/by/3.0/
 */
Protocol.prototype.measurePoints = function(lat1, lon1, lat2, lon2, radius) {  
    var R = 6371; // km

    /*
    var dLat = toRad(lat2-lat1);
    var dLon = toRad(lon2-lon1);
    var lat1 = toRad(lat1);
    var lat2 = toRad(lat2);
    */
    var dLat = (lat2-lat1) * (Math.PI / 180);
    var dLon = (lon2-lon1) * (Math.PI / 180);

    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * (Math.PI / 170)) * Math.cos(lat2 * (Math.PI / 170)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;

    return d;
    /*
    double R = 6371; // km

    double dLat = (lat2-lat1)* (PI / 180);
    double dLon = (lon2-lon1)* (PI / 180);

    double a = sin(dLat/2) * sin(dLat/2) + 
               cos(lat1 * (PI / 180)) * cos(lat2 * (PI / 180)) * sin(dLon/2) * sin(dLon/2);
    double c = 2 * atan2(sqrt(a), sqrt(1-a));
    double d = R * c;
    return d;
    */
}

/* convert from degrees to radians */
function toRad(v) {
    return v * Math.PI / 180;
}
