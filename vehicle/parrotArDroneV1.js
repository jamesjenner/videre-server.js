/*
 * parrotArDroneV1.js v0.1 alpha
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

var QuadCopter = require('./quadCopter.js');
var Telemetry = require('./telemetry.js');
var Attitude = require('./attitude.js');

var arDrone = require('ar-drone');

var util = require('util');

// TODO: not happy with reading in telemetry.js, need a better solution
// possibly should be done at a higher level? Maybe as a module to 
// encapsulate it?
// var fs = require('fs');

// load common js files shared with the videre client
// eval(fs.readFileSync('./videre-common/js/telemetry.js').toString());
// eval(fs.readFileSync('./videre-common/js/vehicle.js').toString());

module.exports = ParrotARDroneV1;

function ParrotARDroneV1(options) {
    ParrotARDroneV1.super_.call(this, options);  // call the super constructr

    options = options || {};

    this.address = options.address || "192.168.1.1";
    this.client = null;
    this.debug = ((options.debug != null) ? options.debug : false);
    this.debugLevel = options.debugLevel || 0;
}

util.inherits(ParrotARDroneV1, QuadCopter);

ParrotARDroneV1.prototype._processData = function(navData) {
    var d = navData.demo;
    var s = navData.droneState;

    if(d && !s) {
	if(this.debug && this.debugLevel > 0) {
	    console.log(
		(new Date()) + ' ' + this.name + 
                ' state: ' + 
		' flying: ' + s.flying);
	}
    }
    if(d && s) {
	if(this.debug && this.debugLevel > 0) {
	    console.log(
		(new Date()) + ' ' + this.name + 
		' state: ' + 
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

// TODO: add connection/disconnection and abort to the higher levels

QuadCopter.prototype.connect = function() {
    var self = this;
    this.client = arDrone.createClient(this.address);

    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' creating client for ' + this.address);
    }

    // capture nav data
    this.client.on('navdata', function(d) {
	self._processData(d);
    });

    // send all nav data, not just the demo version (which doesn't include velocity, pitch, roll, etc)
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' setting navdata demo to false');
    }
    this.client.config('general:navdata_demo', 'FALSE');
};

QuadCopter.prototype.disconnect = function() {
    // TODO: work out how to disconnect
    this.client = null;
};

QuadCopter.prototype.takeoff = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' takeoff ' + this.client);
    }
    this.client.takeoff();
};

QuadCopter.prototype.land = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' land');
    }
    if(this.client) {
	this.client.land();
    }
};

QuadCopter.prototype.abort = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' abort');
    }
    // the api for the parrot doesn't appear to support an emergency stop/abort, so just stop and land
    // TODO: turn the power off
    this.stop();
    this.land();
};

QuadCopter.prototype.stop = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' stop');
    }
    if(this.client) {
	this.client.stop();
    }
};

QuadCopter.prototype.reset = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' reset');
    }
    if(this.client) {
	this.client.disableEmergency();
    }
};

ParrotARDroneV1.prototype.testRun = function() {
    var self = this;

    // blink lites to show connection
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' Animating leds to show connection');
    }
    this.client.animateLeds('blinkGreenRed', 5, 1)

    this.takeoff();

    this.client
	.after(3500, function() {
	    self.land();
        });
        /*
    client
        .after(2000, function() {
	    if(self.debug) {
	      console.log((new Date()) + ' clockwise');
            }
	    this.clockwise(0.5);
        })
        .after(2000, function() {
	    if(self.debug) {
	      console.log((new Date()) + ' stop');
            }
	    this.stop();
	    if(self.debug) {
	      console.log((new Date()) + ' land');
            }
	    this.land();
        });
        */
};
