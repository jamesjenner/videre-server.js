/*
 * unmannedVehicle.js v0.1 alpha
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
// var events = require('events');
var util = require('util');
//
// var fs = require('fs');

// load common js files shared with the videre client
// eval(fs.readFileSync('./videre-common/js/telemetry.js').toString());
// eval(fs.readFileSync('./videre-common/js/vehicle.js').toString());


module.exports = UnmannedVehicle;

util.inherits(UnmannedVehicle, EventEmitter);

function UnmannedVehicle(options) {
    EventEmitter.call(this);
    options = options || {};

    this.debug = options.debug || false;
    // TODO: do we add in a uuid/guid as an id or use a singleton to create an incrementing number?
    // this.id = options.id || -1;
    this.name = options.name || "Thunderbird 1";

    this.connected = false;
}

UnmannedVehicle.prototype._rcvdTelemetry = function(data) {
    this.emit('telemetry', data);
};

UnmannedVehicle.prototype._rcvdPayload = function(data) {
    this.emit('payload', data);
};

UnmannedVehicle.prototype._processData = function(navData) {
};

UnmannedVehicle.prototype.testRun = function() {
};

UnmannedVehicle.prototype.demo = function() {
};