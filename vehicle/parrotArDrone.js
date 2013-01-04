/*
 * vehicle_comms.js v0.1 alpha
 *
 * Copyright (c) 2012 James G Jenner
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

var EventEmitter = require('events').EventEmitter;
var fs = require('fs');

// load common js files shared with the videre client
eval(fs.readFileSync('./videre-common/js/telemetry.js').toString());
// eval(fs.readFileSync('./videre-common/js/vehicle.js').toString());

var events = require('events');
var util = require('util');

module.exports = ParrotARDrone;

util.inherits(ParrotARDrone, EventEmitter);

function ParrotARDrone(options) {
    EventEmitter.call(this);
    options = options || {};

    this.address = options.address || "192.168.1.1";
    this.debug = options.debug || false;

    this.connected = false;
}

ParrotARDrone.prototype._rcvdTelemetry = function(data) {
    this.emit('telemetry', data);
};

ParrotARDrone.prototype._rcvdPayload = function(data) {
    this.emit('payload', data);
};

ParrotARDrone.prototype._processData = function(navData) {
    var d = navData.demo;
    var s = navData.droneState;

    if(d && !s) {
	if(this.debug) {
	    console.log(
		'state: ' + 
		' flying: ' + s.flying);
	}
    }
    if(d && s) {
	if(this.debug) {
	    console.log(
		'state: ' + 
		' flying: ' + s.flying +
		'  | nav: ' + 
		' ctrlState: ' + d.controlState + 
		' flyState: ' + d.flyState + 
		' battery: ' + d.batteryPercentage + 
		' Pitch: ' + d.rotation.pitch + 
		' Roll: ' + d.rotation.roll + 
		' Yaw: ' + d.rotation.yaw + 
		' Alti: ' + d.altitude + 
		' xVel: ' + d.xVelocity + 
		' yVel: ' + d.yVelocity + 
		' zVel: ' + d.zVelocity);
	}

	var telemetry = new Telemetry({
	    state: d.controlState,
	    batteryCharge: d.batteryPercentage,
	    attitude: new Attitude({ pitch: d.rotation.pitch, roll: d.rotation.roll, yaw: d.rotation.yaw }),
	    altitude: d.altitude,
	    velocity: {x: d.xVelocity, y: d.yVelocity, z: d.zVelocity},
	    });

	this._rcvdTelemetry(telemetry);
	// this._rcvdPayload(new Telemetry());
    }

    d = null;
    s = null;
};

ParrotARDrone.prototype.testRun = function() {
    var arDrone = require('ar-drone');
    var self = this;

    var client = arDrone.createClient(this.address);
    if(this.debug) {
	console.log('creating client for ' + this.address);
    }

    // capture nav data
    client.on('navdata', function(d) {
	self._processData(d);
    });

    // send all nav data, not just the demo version (which doesn't include velocity, pitch, roll, etc)
    if(this.debug) {
	console.log('setting navdata demo to false');
    }
    client.config('general:navdata_demo', 'FALSE');

    // blink lites to show connection
    if(this.debug) {
	console.log('Animating leds to show connection');
    }
    client.animateLeds('blinkGreenRed', 5, 1)

    if(this.debug) {
	console.log('takeoff');
    }
    client.takeoff();

    client
	.after(3500, function() {
	    if(self.debug) {
		console.log('land');
	    }
	    this.land();
        });
        /*
    client
        .after(2000, function() {
	    if(self.debug) {
	      console.log('clockwise');
            }
	    this.clockwise(0.5);
        })
        .after(2000, function() {
	    if(self.debug) {
	      console.log('stop');
            }
	    this.stop();
	    if(self.debug) {
	      console.log('land');
            }
	    this.land();
        });
        */
};
