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
var util         = require('util');
var Transform    = require('./transform/transform.js');

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

UnmannedVehicle._transform = new Transform();

UnmannedVehicle.CONNECTION_TYPE_SERIAL = 0;
UnmannedVehicle.CONNECTION_TYPE_NETWORK = 1;

UnmannedVehicle.POSITION_REPORTING_DISTANCE = 0;
UnmannedVehicle.POSITION_REPORTING_TIME = 1;




function UnmannedVehicle(options) {
    EventEmitter.call(this);
    options = options || {};

    this.id = ((options.id != null) ? options.id : "unknown");
    this.name = ((options.name != null) ? options.name : "Thunderbird 1");

    this.debug = ((options.debug != null) ? options.debug : false);
    this.debugLevel = ((options.debugLevel != null) ? options.debugLevel : 0);

    this.connectionType = ((options.connectionType != null) ? options.connectionType : UnmannedVehicle.CONNECTION_TYPE_SERIAL);
    this.networkAddress = ((options.networkAddress != null) ? options.networkAddress : "localhost");
    this.networkPort = ((options.networkPort != null) ? options.networkPort : "9001");
    this.serialPort = ((options.serialPort != null) ? options.serialPort : "/dev/ttyUSB0");
    this.serialBaud = ((options.baud != null) ? options.baud : 57600);
    this.positionReportingMode = ((options.positionReportingMode != null) ? options.positionReportingMode : UnmannedVehicle.POSITION_MODE_DISTANCE);
    this.positionReportingValue = ((options.positionReportingValue != null) ? options.positionReportingValue : 1);

    this.connectionState = UnmannedVehicle.COMMS_DISCONNECTED;
}

UnmannedVehicle.prototype._stateChanged = function(data) {
    this.emit('stateChanged', data);
};

UnmannedVehicle.prototype._waypointsRetrieved = function(data) {
    this.emit('waypointsRetrieved', data);
};

UnmannedVehicle.prototype._waypointsSetSuccessful = function() {
    this.emit('waypointsSetSuccessful');
};

UnmannedVehicle.prototype._waypointsSetFailed = function(data) {
    this.emit('waypointsSetFailed', data);
};

UnmannedVehicle.prototype._waypointTargeted = function(data) {
    this.emit('waypointTargeted', data);
};

UnmannedVehicle.prototype._waypointAchieved = function(data) {
    this.emit('waypointAchieved', data);
};

UnmannedVehicle.prototype._rcvdTelemetry = function(data) {
    this.emit('telemetry', data);
};

UnmannedVehicle.prototype._rcvdPayload = function(data) {
    this.emit('payload', data);
};

UnmannedVehicle.prototype._rcvdPosition = function(data) {
    this.emit('position', data);
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

UnmannedVehicle.prototype.transformTelemetry = function(d) {
    return UnmannedVehicle._transform.transformTelemetry(d);
};
