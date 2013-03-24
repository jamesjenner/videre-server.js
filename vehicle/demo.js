/*
 * playback.js
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

var util       = require('util');

var QuadCopter = require('./quadCopter.js');
var UnmannedVehicle = require('./unmannedVehicle.js');

var Attitude   = require('../videre-common/js/attitude');
var Telemetry  = require('../videre-common/js/telemetry');

module.exports = Demo;

function Demo(options) {
    Demo.super_.call(this, options);  // call the super constructr

    options = options || {};

    this.debug = ((options.debug != null) ? options.debug : false);
    this.debugLevel = options.debugLevel || 0;
    // this.lastState = -1;
}

util.inherits(Demo, QuadCopter);

// TODO: add connection/disconnection and abort to the higher levels

QuadCopter.prototype.connect = function() {
    var self = this;

    // setup thread to generate data
    /*
    var newState = 0;
    newState = UnmannedVehicle.STATE_LAUNCHED;
    newState = UnmannedVehicle.STATE_LAUNCHING;
    newState = UnmannedVehicle.STATE_LANDING;
    newState = UnmannedVehicle.STATE_LANDED;

    this.lastState = newState;
    this._rcvdActiveState(newState);

    var telemetry = new Telemetry({
	state: d.controlState,
	batteryCharge: d.batteryPercentage,
	attitude: new Attitude({ pitch: d.rotation.pitch, roll: d.rotation.roll, yaw: d.rotation.yaw }),
	altitude: d.altitude,
	velocity: {x: d.xVelocity, y: d.yVelocity, z: d.zVelocity},
    });

    this._rcvdTelemetry(telemetry);
    */

    this._connectionState(UnmannedVehicle.COMMS_CONNECTED);
};

QuadCopter.prototype.disconnect = function() {
    // remove/stop thread generating data, or perhaps not... all depends...
    this._connectionState(UnmannedVehicle.COMMS_DISCONNECTED);
};

QuadCopter.prototype.reconnect = function() {
    this.connect();
};

QuadCopter.prototype.reset = function() {
    // do we need this?
};

QuadCopter.prototype.takeoff = function() {
};

QuadCopter.prototype.land = function() {
};

QuadCopter.prototype.up = function(power) {
};

QuadCopter.prototype.down = function(power) {
};

QuadCopter.prototype.left = function(power) {
};

QuadCopter.prototype.right = function(power) {
};

QuadCopter.prototype.turnLeft = function(power) {
};

QuadCopter.prototype.turnRight = function(power) {
};

QuadCopter.prototype.forward = function(power) {
};

QuadCopter.prototype.reverse = function(power) {
};

QuadCopter.prototype.abort = function() {
};

QuadCopter.prototype.stop = function() {
};

QuadCopter.prototype.reset = function() {
};

Demo.prototype.testRun = function() {
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
