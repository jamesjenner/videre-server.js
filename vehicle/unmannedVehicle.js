/*
 * unmannedVehicle.js
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
var util = require('util');

module.exports = UnmannedVehicle;

util.inherits(UnmannedVehicle, EventEmitter);

UnmannedVehicle.STATE_LAUNCHING = 0;
UnmannedVehicle.STATE_LAUNCHED = 1;
UnmannedVehicle.STATE_LANDING = 2;
UnmannedVehicle.STATE_LANDED = 3;

UnmannedVehicle.COMMS_CONNECTING = 0;
UnmannedVehicle.COMMS_CONNECTED = 1;
UnmannedVehicle.COMMS_DISCONNECTING = 2;
UnmannedVehicle.COMMS_DISCONNECTED = 3;
UnmannedVehicle.COMMS_RECONNECTING = 4;

function UnmannedVehicle(options) {
    EventEmitter.call(this);
    options = options || {};

    this.debug = options.debug || false;
    // TODO: do we add in a uuid/guid as an id or use a singleton to create an incrementing number?
    // this.id = options.id || -1;
    this.name = options.name || "Thunderbird 1";
    this.id = options.id || "unknown";

    this.connectionState = UnmannedVehicle.COMMS_DISCONNECTED;
}

UnmannedVehicle.prototype._rcvdTelemetry = function(data) {
    this.emit('telemetry', data);
};

UnmannedVehicle.prototype._rcvdPayload = function(data) {
    this.emit('payload', data);
};

UnmannedVehicle.prototype._rcvdActiveState = function(data) {
    this.emit('activeState', data);
};

UnmannedVehicle.prototype._connectionState = function(state) {
    this.connectionState = state;
    this.emit('connectionState', this.connectionState);
};

UnmannedVehicle.prototype._processData = function(navData) {};

UnmannedVehicle.prototype.testRun = function() {};
UnmannedVehicle.prototype.demo = function() {};

UnmannedVehicle.prototype.reset = function() {};
UnmannedVehicle.prototype.connect = function() {};
UnmannedVehicle.prototype.disconnect = function() {};
UnmannedVehicle.prototype.reconnect = function() {};
