/*
 * parrotArDroneV1.js
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

var util       = require('util');
var arDrone    = require('ar-drone');

var QuadCopter = require('./quadCopter.js');
var UnmannedVehicle = require('./unmannedVehicle.js');

var Attitude   = require('../videre-common/js/attitude');
var Telemetry  = require('../videre-common/js/telemetry');

module.exports = ParrotARDroneV1;

ParrotARDroneV1.CTRL_DEFAULT = "CTRL_DEFAULT";
ParrotARDroneV1.CTRL_INIT = "CTRL_INIT";
ParrotARDroneV1.CTRL_LANDED = "CTRL_LANDED";
ParrotARDroneV1.CTRL_FLYING = "CTRL_FLYING";
ParrotARDroneV1.CTRL_HOVERING = "CTRL_HOVERING";
ParrotARDroneV1.CTRL_TEST = "CTRL_TEST";
ParrotARDroneV1.CTRL_TRANS_TAKEOFF = "CTRL_TRANS_TAKEOFF";
ParrotARDroneV1.CTRL_TRANS_GOTOFIX = "CTRL_TRANS_GOTOFIX";
ParrotARDroneV1.CTRL_TRANS_LANDING = "CTRL_TRANS_LANDING";
ParrotARDroneV1.CTRL_TRANS_LOOPING = "CTRL_TRANS_LOOPING";

function ParrotARDroneV1(options) {
    ParrotARDroneV1.super_.call(this, options);  // call the super constructr

    options = options || {};

    this.address = options.address || "192.168.1.1";
    this.client = null;
    this.debug = ((options.debug != null) ? options.debug : false);
    this.debugLevel = options.debugLevel || 0;
    this.lastState = -1;
}

util.inherits(ParrotARDroneV1, QuadCopter);

ParrotARDroneV1.prototype._processData = function(navData) {
    var d = navData.demo;
    var s = navData.droneState;

    if(d && !s) {
	if(this.debug && this.debugLevel > 5) {
	    console.log(
		(new Date()) + ' ' + this.name + 
                ' state: ' + 
		' flying: ' + s.flying);
	}
    }
    if(d && s) {
	if(this.debug && this.debugLevel > 5) {
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

	// check if the state has changed, if so then fire seperate event for active state
	// note that the state is based on the videre's concept of state, not the AR Drone
	var newState = 0;
	switch(d.controlState) {
	    case ParrotARDroneV1.CTRL_FLYING:
	    case ParrotARDroneV1.CTRL_HOVERING:
	    case ParrotARDroneV1.CTRL_TRANS_GOTOFIX:
	    case ParrotARDroneV1.CTRL_TRANS_LOOPING:
		// flying
		newState = UnmannedVehicle.STATE_LAUNCHED;
		break;               

	    case ParrotARDroneV1.CTRL_TRANS_TAKEOFF:
		// taking off
		newState = UnmannedVehicle.STATE_LAUNCHING;
		break;               

	    case ParrotARDroneV1.CTRL_TRANS_LANDING:
		// landing
		newState = UnmannedVehicle.STATE_LANDING;
		break;               

	    case ParrotARDroneV1.CTRL_DEFAULT:
	    case ParrotARDroneV1.CTRL_INIT:
	    // case ParrotARDroneV1.CTRL_TEST: // uncertain when this can occur
	    case ParrotARDroneV1.CTRL_LANDED:
	    default:
		// landed
		newState = UnmannedVehicle.STATE_LANDED;
		break;            
	}

	if(newState != this.lastState) {
	    console.log(
		(new Date()) + ' ' + this.name + 
		' state: ' + newState);
	    this.lastState = newState;
	    this._rcvdActiveState(newState);
	}

	var telemetry = new Telemetry({
	    state: d.controlState,
	    batteryCharge: d.batteryPercentage,
	    attitude: new Attitude({ pitch: d.rotation.pitch, roll: d.rotation.roll, yaw: d.rotation.yaw }),
	    altitude: d.altitude,
	    velocity: {x: d.xVelocity, y: d.yVelocity, z: d.zVelocity},
	    });

	this._rcvdTelemetry(telemetry);
    }

    d = null;
    s = null;
};

// TODO: add connection/disconnection and abort to the higher levels

QuadCopter.prototype.connect = function() {
    var self = this;
    this.client = arDrone.createClient(this.address);

    // create video stream

    /* this only supports a png stream derived from a codec available with the V2 drone
     * TODO: implement a mpjeg stream for video based on the V1 API
     *
    var pngStream = this.client.createPngStream();

    pngStream.on('data', console.log);
    */

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
    // there is no specific way to disconnect via the api, possibly because it's UDP
    if(this.client) {
	// turn off nav data
	this.client.config('general:navdata_demo', 'TRUE');
    }
    // remove the client
    this.client = null;
};

QuadCopter.prototype.reconnect = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' reset');
    }
    if(this.client) {
	// resume clears all listeners and recreates them, this appears that it may do the job
	this.client.resume();
    } else {
	this.connect();
    }
};

QuadCopter.prototype.reset = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' reset');
    }
    if(this.client) {
	// reset will disable the emergency flag with the drone (when red leds are showing)
	this.client.disableEmergency();
    }
};

QuadCopter.prototype.takeoff = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' takeoff ' + this.client);
    }
    if(this.client) {
	this.client.takeoff();
    }
};

QuadCopter.prototype.land = function() {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' land');
    }
    if(this.client) {
	this.client.land();
    }
};

QuadCopter.prototype.up = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' up: ');
    }
    if(this.client) {
	this.client.up(power / 100);
    }
};

QuadCopter.prototype.down = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' down: ');
    }
    if(this.client) {
	this.client.down(power / 100);
    }
};

QuadCopter.prototype.left = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' left: ');
    }
    if(this.client) {
	this.client.left(power / 100);
    }
};

QuadCopter.prototype.right = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' right: ');
    }
    if(this.client) {
	this.client.right(power / 100);
    }
};

QuadCopter.prototype.turnLeft = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' turnLeft: ');
    }
    if(this.client) {
	this.client.counterClockwise(power / 100);
    }
};

QuadCopter.prototype.turnRight = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' turnRight: ');
    }
    if(this.client) {
	this.client.clockwise(power / 100);
    }
};

QuadCopter.prototype.forward = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' forward: ');
    }
    if(this.client) {
	this.client.front(power / 100);
    }
};

QuadCopter.prototype.reverse = function(power) {
    if(this.debug) {
	console.log((new Date()) + ' parrotArDroneV1: ' + this.name + ' reverse: ');
    }
    if(this.client) {
	this.client.back(power / 100);
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
