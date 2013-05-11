/*
 * transformParrotPx4.js
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

var fs        = require('fs');
var util      = require('util');

var Transform = require('./transform.js');
var Telemetry = require('../../videre-common/js/telemetry.js');

module.exports = TransformParrotPx4;

util.inherits(TransformParrotPx4, Transform);

function TransformParrotPx4() {
}

TransformParrotPx4.prototype.transformTelemetry = function(d) {
    var telemetry = new Telemetry();

    var data = {};

    telemetry.state = d.state;

    // speed is mm/s, so divide by 1000 to get m/s
    telemetry.speed = d.speed;

    // uknown uom, presuming mm/s (same as speed)
    /*
    telemetry.velocity.x = d.velocity.x / 1000;
    telemetry.velocity.y = d.velocity.y / 1000;
    telemetry.velocity.z = d.velocity.z / 1000;
    */

    // roll           Roll angle (rad, -pi..+pi)
    // pitch          Pitch angle (rad, -pi..+pi)
    // yaw            Yaw angle (rad, -pi..+pi)

    telemetry.attitude.pitch = rToP(d.attitude.pitch);
    telemetry.attitude.roll = rToP(d.attitude.roll);
    telemetry.attitude.yaw = rToP(d.attitude.yaw);
    telemetry.attitude.x = telemetry.attitude.pitch;
    telemetry.attitude.y = telemetry.attitude.roll;
    telemetry.attitude.z = telemetry.attitude.yaw;

    // TODO: sort this out
    telemetry.altitude = d.altitude;

    // uknown uom
    telemetry.temperature = d.temperature;

    // uknown, presuming it is not available in v1, so lets use yaw.
    // yaw is from -180 to +180, so convert, if < 0 abs and double, otherwise leave as is
    telemetry.heading = telemetry.attitude.yaw < 0 ? telemetry.attitude.yaw * -2 : telemetry.attitude.yaw;

    telemetry.vsi = d.vsi;

    telemetry.position.latitude = d.position.latitude;
    telemetry.position.longitude = d.position.longitude;

    // voltage is mV
    telemetry.batteryVoltage = d.batteryVoltage;

    // charge is percentage, 0 to 100
    telemetry.batteryCharge = d.batteryCharge;

    return telemetry;
}

function rToP(v) {
    return v * (180/Math.PI);
}
